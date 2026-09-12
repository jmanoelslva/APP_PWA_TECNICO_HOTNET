import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  MdContentCopy,
  MdExpandLess,
  MdExpandMore,
  MdMyLocation,
  MdPeopleAlt,
  MdRefresh,
  MdRouter,
  MdSave,
  MdSearch,
  MdVisibility,
  MdVisibilityOff,
  MdWifi,
} from 'react-icons/md'
import {
  ApiError,
  atualizarDetalhesCpe,
  atualizarWifiCpe,
  buscarCpe,
  buscarHistoricoSessoesCpe,
  buscarOnu,
  buscarSessaoOnlineCpe,
  listarDps,
  type CpeDto,
  type DpDto,
  type OnuDto,
  type SessaoHistoricoDto,
} from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import PullToRefresh from '../components/PullToRefresh'
import EstadoVazio from '../components/EstadoVazio'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import { formatarDataHoraSegundos, formatarStatusContrato, OPCOES_CRIPTOGRAFIA_WIFI } from '../utils/formatacao'
import { calcularPeriodo, OPCOES_PERIODO, type PeriodoPreset } from '../utils/periodos'
import './Conexao.css'

const LIMITE_HISTORICO = 10

// Fórmula de Haversine — distância em linha reta (metros) entre a
// localização do técnico e a coordenada cadastrada da CTO. Suficiente
// para sugerir/ordenar por proximidade; não precisa de rota real.
function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const raioTerraM = 6371000
  const paraRad = (graus: number) => (graus * Math.PI) / 180
  const dLat = paraRad(lat2 - lat1)
  const dLng = paraRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(paraRad(lat1)) * Math.cos(paraRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * raioTerraM * Math.asin(Math.sqrt(a))
}

function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`
  return `${(metros / 1000).toFixed(1)} km`
}

// GPS urbano varia de ~5m (céu aberto) a 30m+ perto de muro/poste metálico
// — um limiar fixo de metros ignora essa variação: auto-seleciona errado
// quando o GPS está ruim e força confirmação manual à toa quando está
// ótimo. Os limiares abaixo usam a própria precisão (accuracy, em metros)
// relatada pelo GPS a cada leitura em vez de um número fixo.
const PRECISAO_MAXIMA_ACEITAVEL_M = 30
const MARGEM_COORDENADA_CTO_M = 5
// Uma única leitura pode pegar o GPS no pior instante — amostra por
// alguns segundos via watchPosition e fica com a leitura de menor
// accuracy da janela, em vez da primeira que chegar. Em área urbana o
// primeiro fix do GPS (com enableHighAccuracy, ou seja, rádio GPS em
// vez de posição por rede) costuma levar bem mais que alguns segundos
// — a janela precisa ser generosa o bastante pra isso, senão o técnico
// só vê "não foi possível obter localização" e precisa tentar de novo.
const JANELA_AMOSTRAGEM_LOCALIZACAO_MS = 10000

function obterMelhorLocalizacao(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let melhor: GeolocationPosition | null = null
    let ultimoErro: GeolocationPositionError | null = null

    // Sem "timeout" aqui (fica Infinity por padrão): quem decide quando
    // parar de esperar é só o setTimeout externo abaixo — evita que o
    // watchPosition erre por timeout individual bem no instante em que a
    // janela ia fechar de qualquer forma, perdendo uma leitura que
    // chegaria logo em seguida.
    const watchId = navigator.geolocation.watchPosition(
      (posicao) => {
        if (!melhor || posicao.coords.accuracy < melhor.coords.accuracy) melhor = posicao
      },
      (erro) => {
        ultimoErro = erro
      },
      { enableHighAccuracy: true, maximumAge: 0 },
    )

    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId)
      if (melhor) resolve(melhor)
      else reject(ultimoErro ?? new Error('Não foi possível obter a localização.'))
    }, JANELA_AMOSTRAGEM_LOCALIZACAO_MS)
  })
}

export default function Conexao() {
  const [params, setParams] = useSearchParams()
  const cpePkParam = params.get('cpe_pk')
  const contractPkParam = params.get('contract_pk')
  const usernameParam = params.get('username')
  // cpe_pk é o mais específico (sem ambiguidade de busca) — prioriza ele
  // quando vier mais de um parâmetro ao mesmo tempo.
  const temParametroInicial = !!cpePkParam || !!usernameParam || !!contractPkParam
  const { toast } = useToast()

  function buscarInicial() {
    if (cpePkParam) return buscarCpe({ cpe_pk: Number(cpePkParam) })
    if (usernameParam) return buscarCpe({ username: usernameParam })
    return buscarCpe({ contract_pk: Number(contractPkParam) })
  }

  // Busca por usuário PPPoE — igual ao combobox de CTO: digita um pedaço
  // do usuário e a lista vai filtrando ao vivo (busca no backend com
  // debounce), sem precisar do nome exato nem apertar buscar.
  const [buscaUsuario, setBuscaUsuario] = useState(usernameParam ?? '')
  const [resultadosBuscaUsuario, setResultadosBuscaUsuario] = useState<CpeDto[]>([])
  const [buscandoUsuario, setBuscandoUsuario] = useState(false)
  const [listaUsuarioAberta, setListaUsuarioAberta] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [cpe, setCpe] = useState<CpeDto | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  // Estado separado do PPPoE acima — são credenciais diferentes, e um
  // técnico pode querer conferir uma sem revelar a outra sem querer.
  const [mostrarSenhaRoteador, setMostrarSenhaRoteador] = useState(false)
  const [sessao, setSessao] = useState<Record<string, unknown> | null>(null)
  const [carregandoSessao, setCarregandoSessao] = useState(false)
  // Resumo da ONU vinculada ao cliente (se tiver) — busca pelo mesmo
  // usuário PPPoE do CPE, jeito confiável já usado na tela de ONU (ver
  // CONTROLLR_API_NOTES.md: cpe_pk sozinho é ambíguo em /fiber_ctl/onu/list).
  const [onuResumo, setOnuResumo] = useState<OnuDto | null>(null)
  const [carregandoOnuResumo, setCarregandoOnuResumo] = useState(false)
  // Campos editáveis de criptografia do Wi-Fi do CPE — pré-preenchidos
  // com o que o sistema fornecer ao carregar, e reenviados ao Controllr
  // só quando o técnico salvar.
  const [wifiTipo, setWifiTipo] = useState('')
  const [wifiSenha, setWifiSenha] = useState('')
  const [mostrarSenhaWifi, setMostrarSenhaWifi] = useState(false)
  const [salvandoWifi, setSalvandoWifi] = useState(false)
  // Observação do CPE — cpe_obs (/aaa_ctl/cpe/update). Card e Salvar
  // próprios, separados da CTO.
  const [obs, setObs] = useState('')
  const [salvandoObs, setSalvandoObs] = useState(false)
  // CTO/porta — dp_pk, cpe_dp_port (idem). dpBusca é o texto digitado no
  // combobox (filtra a lista enquanto digita); dpPk só muda quando o
  // técnico clica numa CTO da lista filtrada.
  const [dpPk, setDpPk] = useState('')
  const [dpBusca, setDpBusca] = useState('')
  const [dpListaAberta, setDpListaAberta] = useState(false)
  const [dpPorta, setDpPorta] = useState('')
  const [dps, setDps] = useState<DpDto[]>([])
  const [salvandoCto, setSalvandoCto] = useState(false)
  // Localização do técnico (botão "Usar minha localização") — usada só
  // para sugerir/ordenar a CTO mais próxima por distância, nunca para
  // selecionar sozinha sem confirmação em caso de dúvida (ver critério em
  // usarLocalizacaoAtual). precisaoLocalizacaoM é o accuracy (em metros)
  // relatado pelo GPS na leitura usada — mostrado ao técnico para ele
  // avaliar a confiança da sugestão.
  const [minhaLocalizacao, setMinhaLocalizacao] = useState<{ lat: number; lng: number } | null>(null)
  const [precisaoLocalizacaoM, setPrecisaoLocalizacaoM] = useState<number | null>(null)
  const [localizando, setLocalizando] = useState(false)
  // Acesso ao roteador, Observação do CPE e Wi-Fi do CPE são usados bem
  // menos que PPPoE/CTO/Rede — ficam recolhidos por padrão pra não
  // ocupar a tela à toa (mesmo padrão de "Contratos" em DetalheCliente).
  const [blocosAbertos, setBlocosAbertos] = useState<Set<'roteador' | 'obs' | 'wifi' | 'historico'>>(new Set())

  function alternarBloco(chave: 'roteador' | 'obs' | 'wifi' | 'historico') {
    setBlocosAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }
  const historicoAberto = blocosAbertos.has('historico')

  // Histórico de conexão (aaa_ctl/session_history/list) — recolhido por
  // padrão (ver alternarBloco acima) e só carregado quando o técnico
  // abrir o bloco, já que é uma consulta que a maioria das visitas não
  // precisa. Período default "Esse mês", mesmo default do painel
  // Controllr (ver CONTROLLR_API_NOTES.md, seção 7.5).
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('esse_mes')
  const [intervaloInicio, setIntervaloInicio] = useState('')
  const [intervaloFim, setIntervaloFim] = useState('')
  const [historico, setHistorico] = useState<SessaoHistoricoDto[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [temMaisHistorico, setTemMaisHistorico] = useState(false)
  const dpsFiltradas = (
    dpBusca.trim() ? dps.filter((dp) => dp.name.toLowerCase().includes(dpBusca.trim().toLowerCase())) : dps
  )
    .map((dp) => ({
      ...dp,
      distanciaM:
        minhaLocalizacao && dp.lat != null && dp.lng != null
          ? distanciaMetros(minhaLocalizacao.lat, minhaLocalizacao.lng, dp.lat, dp.lng)
          : null,
    }))
    .sort((a, b) => {
      if (a.distanciaM == null && b.distanciaM == null) return 0
      if (a.distanciaM == null) return 1
      if (b.distanciaM == null) return -1
      return a.distanciaM - b.distanciaM
    })
  // Acesso administrativo ao roteador — cpe_access_login/password/port,
  // agora editável (antes só era possível ver o que já vinha cadastrado).
  const [acessoLogin, setAcessoLogin] = useState('')
  const [acessoSenha, setAcessoSenha] = useState('')
  const [acessoPorta, setAcessoPorta] = useState('')
  const [salvandoAcesso, setSalvandoAcesso] = useState(false)

  useEffect(() => {
    listarDps()
      .then((resposta) => setDps(resposta.results))
      .catch(() => {
        /* lista de CTOs é só conveniência para o seletor — se falhar, o técnico ainda pode digitar o pk em outro lugar */
      })
  }, [])

  useEffect(() => {
    // Só busca ao vivo na tela de "sem conexão selecionada" (senão ficaria
    // buscando de novo toda vez que o campo de usuário já carregado muda
    // por outro motivo). Menos de 2 caracteres não busca — evita trazer
    // metade da base de usuários a cada tecla.
    if (temParametroInicial || buscaUsuario.trim().length < 2) {
      setResultadosBuscaUsuario([])
      return
    }
    let cancelado = false
    setBuscandoUsuario(true)
    const temporizador = setTimeout(() => {
      buscarCpe({ username: buscaUsuario.trim() })
        .then((resposta) => {
          if (!cancelado) setResultadosBuscaUsuario(resposta.results)
        })
        .catch(() => {
          if (!cancelado) setResultadosBuscaUsuario([])
        })
        .finally(() => {
          if (!cancelado) setBuscandoUsuario(false)
        })
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [buscaUsuario, temParametroInicial])

  useEffect(() => {
    if (!temParametroInicial) {
      setCarregando(false)
      return
    }
    carregar(buscarInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpePkParam, usernameParam, contractPkParam])

  async function carregar(chamada: () => ReturnType<typeof buscarCpe> = buscarInicial) {
    setCarregando(true)
    setErro(null)
    // Zera a sessão da busca anterior — sem isso, trocar de usuário/CPE
    // com o card "Sessão online" já carregado ficava mostrando a sessão
    // ANTIGA (só sumia depois de um pull-to-refresh, que por acaso
    // remonta a busca do zero). Some agora mesmo antes da nova consulta
    // (abaixo) responder.
    setSessao(null)
    setOnuResumo(null)
    setHistorico([])
    setBlocosAbertos((atual) => {
      if (!atual.has('historico')) return atual
      const novo = new Set(atual)
      novo.delete('historico')
      return novo
    })
    try {
      const resposta = await chamada()
      const cpeCarregado = resposta.results[0] ?? null
      setCpe(cpeCarregado)
      // Sem "não informado" no seletor — assume Nenhum (0) até o técnico
      // escolher outra coisa, para manter o estado igual ao que a tela mostra.
      setWifiTipo(cpeCarregado?.wifi_encryption_type != null ? String(cpeCarregado.wifi_encryption_type) : '0')
      setWifiSenha(cpeCarregado?.wifi_encryption_password ?? '')
      setObs(cpeCarregado?.obs ?? '')
      setDpPk(cpeCarregado?.dp_pk != null ? String(cpeCarregado.dp_pk) : '')
      setDpBusca(cpeCarregado?.dp_name ?? '')
      setDpPorta(cpeCarregado?.dp_port != null ? String(cpeCarregado.dp_port) : '')
      setAcessoLogin(cpeCarregado?.access_login ?? '')
      setAcessoSenha(cpeCarregado?.access_password ?? '')
      setAcessoPorta(cpeCarregado?.access_port != null ? String(cpeCarregado.access_port) : '')
      // Card "Sessão online" carrega junto com o resto dos dados, sem
      // exigir clique. Sem await de propósito: não trava o carregamento
      // do resto da tela por causa dessa consulta à parte.
      if (cpeCarregado?.pk != null) void carregarSessaoOnline(cpeCarregado.pk)
      if (cpeCarregado?.username) void carregarOnuResumo(cpeCarregado.username)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar os dados de conexão.')
    } finally {
      setCarregando(false)
    }
  }

  function buscarPorUsuarioAtual() {
    const usuario = buscaUsuario.trim()
    if (!usuario) return
    // Guarda na URL (?username=...) — mesmo motivo da busca de cliente:
    // sair para outra tela e voltar não deve perder a busca.
    setParams({ username: usuario })
  }

  function aoBuscarUsuario(evento: FormEvent) {
    evento.preventDefault()
    buscarPorUsuarioAtual()
  }

  function tentarNovamente() {
    if (temParametroInicial) carregar(buscarInicial)
    else buscarPorUsuarioAtual()
  }

  async function salvarObs() {
    if (!cpe?.pk) return
    setSalvandoObs(true)
    try {
      await atualizarDetalhesCpe(cpe.pk, { cpe_obs: obs })
      setCpe((atual) => (atual ? { ...atual, obs } : atual))
      toast('Observação atualizada.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar a observação.')
    } finally {
      setSalvandoObs(false)
    }
  }

  async function usarLocalizacaoAtual() {
    if (!navigator.geolocation) {
      toast('Este dispositivo/navegador não oferece localização.')
      return
    }
    setLocalizando(true)
    try {
      const posicao = await obterMelhorLocalizacao()
      const minhaLat = posicao.coords.latitude
      const minhaLng = posicao.coords.longitude
      const precisaoM = posicao.coords.accuracy
      setMinhaLocalizacao({ lat: minhaLat, lng: minhaLng })
      setPrecisaoLocalizacaoM(precisaoM)

      const comCoordenada = dps
        .filter((dp): dp is DpDto & { lat: number; lng: number } => dp.lat != null && dp.lng != null)
        .map((dp) => ({ dp, distanciaM: distanciaMetros(minhaLat, minhaLng, dp.lat, dp.lng) }))
        .sort((a, b) => a.distanciaM - b.distanciaM)

      const maisProxima = comCoordenada[0]
      const segundaMaisProxima = comCoordenada[1]
      const precisaoRuim = precisaoM > PRECISAO_MAXIMA_ACEITAVEL_M
      // Só seleciona sozinho quando o GPS está confiável e não há
      // ambiguidade real: a CTO mais próxima precisa estar dentro do
      // raio de erro do GPS (senão o técnico só está "perto", não "na"
      // CTO), e o "círculo de incerteza" da leitura não pode alcançar a
      // segunda CTO mais próxima. Em qualquer outro caso é melhor abrir
      // a lista ordenada por distância e deixar o técnico confirmar.
      const semAmbiguidade =
        !precisaoRuim &&
        !!maisProxima &&
        maisProxima.distanciaM < precisaoM + MARGEM_COORDENADA_CTO_M &&
        (!segundaMaisProxima || segundaMaisProxima.distanciaM - maisProxima.distanciaM > 2 * precisaoM)

      setDpBusca('')
      if (semAmbiguidade && maisProxima) {
        setDpPk(String(maisProxima.dp.pk))
        setDpBusca(maisProxima.dp.name)
        setDpListaAberta(false)
        toast(
          `CTO mais próxima selecionada: ${maisProxima.dp.name} (${formatarDistancia(maisProxima.distanciaM)}, GPS ±${Math.round(precisaoM)} m).`,
          'sucesso',
        )
      } else {
        setDpPk('')
        setDpListaAberta(true)
        if (precisaoRuim) {
          toast(
            `Localização imprecisa (±${Math.round(precisaoM)} m). CTOs ordenadas pela sua distância — confira e selecione na lista.`,
          )
        } else if (maisProxima) {
          toast(
            `CTOs ordenadas pela sua distância. Mais próxima: ${maisProxima.dp.name} (${formatarDistancia(maisProxima.distanciaM)}, GPS ±${Math.round(precisaoM)} m). Confira e selecione na lista.`,
            'sucesso',
          )
        } else {
          toast('Nenhuma CTO cadastrada tem coordenada para comparar com sua localização.')
        }
      }
    } catch (erro) {
      toast(
        erro instanceof GeolocationPositionError && erro.code === erro.PERMISSION_DENIED
          ? 'Permissão de localização negada. Habilite a localização para o navegador e tente novamente.'
          : 'Não foi possível obter sua localização.',
      )
    } finally {
      setLocalizando(false)
    }
  }

  async function salvarCto() {
    if (!cpe?.pk) return
    setSalvandoCto(true)
    try {
      await atualizarDetalhesCpe(cpe.pk, {
        dp_pk: dpPk.trim() ? Number(dpPk.trim()) : undefined,
        cpe_dp_port: dpPorta.trim() ? Number(dpPorta.trim()) : undefined,
      })
      const dpEscolhida = dps.find((dp) => String(dp.pk) === dpPk.trim())
      setCpe((atual) =>
        atual
          ? {
              ...atual,
              dp_pk: dpPk.trim() ? Number(dpPk.trim()) : undefined,
              dp_port: dpPorta.trim() ? Number(dpPorta.trim()) : undefined,
              dp_name: dpEscolhida?.name ?? atual.dp_name,
            }
          : atual,
      )
      toast('CTO atualizada.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar a CTO.')
    } finally {
      setSalvandoCto(false)
    }
  }

  async function salvarAcessoRoteador() {
    if (!cpe?.pk) return
    setSalvandoAcesso(true)
    try {
      await atualizarDetalhesCpe(cpe.pk, {
        cpe_access_login: acessoLogin,
        cpe_access_password: acessoSenha,
        cpe_access_port: acessoPorta.trim() ? Number(acessoPorta.trim()) : undefined,
      })
      setCpe((atual) =>
        atual
          ? { ...atual, access_login: acessoLogin, access_password: acessoSenha, access_port: acessoPorta.trim() ? Number(acessoPorta.trim()) : undefined }
          : atual,
      )
      toast('Acesso ao roteador atualizado.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar o acesso ao roteador.')
    } finally {
      setSalvandoAcesso(false)
    }
  }

  const wifiSemCriptografia = wifiTipo === '0'

  async function salvarWifi() {
    if (!cpe?.pk) return
    setSalvandoWifi(true)
    try {
      // Tipo 0 (Nenhum) não tem senha — se a criptografia é "Nenhum", o
      // Controllr não deve receber senha nenhuma.
      const senhaParaEnviar = wifiSemCriptografia ? '' : wifiSenha
      await atualizarWifiCpe(cpe.pk, {
        wifi_encryption_type: wifiTipo.trim() ? Number(wifiTipo.trim()) : undefined,
        wifi_encryption_password: senhaParaEnviar,
      })
      setWifiSenha(senhaParaEnviar)
      setCpe((atual) =>
        atual
          ? { ...atual, wifi_encryption_type: wifiTipo.trim() ? Number(wifiTipo.trim()) : undefined, wifi_encryption_password: senhaParaEnviar }
          : atual,
      )
      toast('Wi-Fi do CPE atualizado.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar o Wi-Fi.')
    } finally {
      setSalvandoWifi(false)
    }
  }

  async function carregarSessaoOnline(cpePk: number) {
    setCarregandoSessao(true)
    try {
      const resposta = await buscarSessaoOnlineCpe(cpePk)
      setSessao(resposta.results[0] ?? {})
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível consultar a sessão online.')
    } finally {
      setCarregandoSessao(false)
    }
  }

  function verSessaoOnline() {
    if (!cpe?.pk) return
    carregarSessaoOnline(cpe.pk)
  }

  async function carregarOnuResumo(username: string) {
    setCarregandoOnuResumo(true)
    try {
      const resposta = await buscarOnu({ username })
      setOnuResumo(resposta.results[0] ?? null)
    } catch {
      // Resumo é só conveniência — sem cliente vinculado a nenhuma ONU o
      // card nem aparece, e um erro aqui não deveria travar o resto da tela.
      setOnuResumo(null)
    } finally {
      setCarregandoOnuResumo(false)
    }
  }

  // "personalizado" só resolve quando as duas datas estiverem preenchidas;
  // os demais presets são calculados aqui mesmo (ver utils/periodos.ts) —
  // "desde_o_inicio" devolve null de propósito (sem faixa, mesmo
  // comportamento do painel Controllr).
  function periodoAtual(): { inicio: string; fim: string } | null {
    if (periodoPreset === 'personalizado') {
      if (!intervaloInicio || !intervaloFim) return null
      return { inicio: `${intervaloInicio} 00:00:00`, fim: `${intervaloFim} 23:59:59` }
    }
    return calcularPeriodo(periodoPreset)
  }

  async function carregarHistorico(pagina: number) {
    if (!cpe?.pk) return
    setCarregandoHistorico(true)
    try {
      const periodo = periodoAtual()
      const resposta = await buscarHistoricoSessoesCpe(cpe.pk, {
        username: cpe.username,
        dataInicio: periodo?.inicio,
        dataFim: periodo?.fim,
        page: pagina,
        limit: LIMITE_HISTORICO,
      })
      setHistorico((atual) => (pagina === 1 ? resposta.results : [...atual, ...resposta.results]))
      setTemMaisHistorico(resposta.results.length === LIMITE_HISTORICO)
    } catch (excecao) {
      if (pagina === 1) setHistorico([])
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível consultar o histórico de conexão.')
    } finally {
      setCarregandoHistorico(false)
    }
  }

  useEffect(() => {
    if (!historicoAberto || !cpe?.pk) return
    if (periodoPreset === 'personalizado' && (!intervaloInicio || !intervaloFim)) return
    carregarHistorico(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicoAberto, cpe?.pk, periodoPreset, intervaloInicio, intervaloFim])

  function rotuloEncerramento(causa: number | undefined): string {
    // Só os códigos abaixo têm tradução conhecida (ver
    // CONTROLLR_API_NOTES.md, seção 7.5) — para qualquer outro código
    // (RFC 2866 Acct-Terminate-Cause) mostra o número cru em vez de
    // arriscar uma tradução não confirmada.
    if (causa == null || causa === 0) return '—'
    if (causa === 2) return 'Lost Carrier'
    return `Código ${causa}`
  }

  async function copiar(valor: string | undefined, rotulo: string) {
    if (!valor) return
    try {
      await navigator.clipboard.writeText(valor)
      toast(`${rotulo} copiado.`, 'sucesso')
    } catch {
      toast('Não foi possível copiar.')
    }
  }

  // /aaa_ctl/session_online/list não tem documentação oficial. Campos de
  // uma sessão (usados aqui): session_callingid (MAC), contract_status,
  // nas_name/nas_addr, session_nas_port_id, session_v4_ip, session_v6_px/pd,
  // session_acct_time (segundos conectado) e stats.total.rx_byte/tx_byte —
  // esses dois últimos vêm aninhados dentro de "stats.total", com o valor
  // em KB (não bytes, apesar do nome). Candidatos alternativos ficam como
  // fallback caso o formato mude.
  function formatarBytes(valor: unknown): string {
    const n = Number(valor)
    if (!Number.isFinite(n)) return String(valor)
    if (n < 1024) return `${n} B`
    const unidades = ['KB', 'MB', 'GB', 'TB']
    let i = -1
    let v = n
    do {
      v /= 1024
      i++
    } while (v >= 1024 && i < unidades.length - 1)
    return `${v.toFixed(v < 10 ? 2 : 1)} ${unidades[i]}`
  }

  function formatarDuracaoSegundos(segundos: number): string {
    const total = Math.max(0, Math.floor(segundos))
    const dias = Math.floor(total / 86400)
    const horas = Math.floor((total % 86400) / 3600)
    const minutos = Math.floor((total % 3600) / 60)
    const s = total % 60
    // Sessões de dias exibidas em "60h 26min" ficam difíceis de ler —
    // acima de 24h passa para dd/hh/mm com zero à esquerda (ex.:
    // "02d 12h 26m"), como um cronômetro.
    if (dias > 0) {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${pad(dias)}d ${pad(horas)}h ${pad(minutos)}m`
    }
    if (horas > 0) return `${horas}h ${minutos}min`
    if (minutos > 0) return `${minutos}min ${s}s`
    return `${s}s`
  }

  function formatarTempoConectado(valor: unknown, chave: string): string {
    const chaveMin = chave.toLowerCase()
    const n = Number(valor)
    if (chaveMin.includes('start') || chaveMin.includes('inicio')) {
      // valor é um instante (início da sessão), não uma duração — calcula
      // o tempo decorrido até agora. Aceita epoch (segundos) ou ISO.
      const inicioMs = /^\d+$/.test(String(valor)) ? n * 1000 : new Date(String(valor)).getTime()
      if (!Number.isFinite(inicioMs)) return String(valor)
      return formatarDuracaoSegundos((Date.now() - inicioMs) / 1000)
    }
    if (Number.isFinite(n)) return formatarDuracaoSegundos(n)
    return String(valor)
  }

  interface ValorEncontrado {
    valor: unknown
    chave: string
  }

  interface CampoDesejado {
    rotulo: string
    extrair: (sessao: Record<string, unknown>) => ValorEncontrado | undefined
    formatar?: (valor: unknown, chave: string) => string
  }

  function porCandidatos(candidatos: string[]): (sessao: Record<string, unknown>) => ValorEncontrado | undefined {
    return (sessao) => {
      const chavesPorNomeMinusculo = new Map(Object.keys(sessao).map((chave) => [chave.toLowerCase(), chave]))
      for (const candidato of candidatos) {
        const chave = chavesPorNomeMinusculo.get(candidato)
        if (chave !== undefined) return { valor: sessao[chave], chave }
      }
      return undefined
    }
  }

  function porConsumo(direcao: 'rx' | 'tx'): (sessao: Record<string, unknown>) => ValorEncontrado | undefined {
    const chaveAninhada = direcao === 'rx' ? 'rx_byte' : 'tx_byte'
    const candidatosPlanos = direcao === 'rx'
      ? ['session_input_octets', 'session_rx_bytes', 'rx_bytes', 'input_octets']
      : ['session_output_octets', 'session_tx_bytes', 'tx_bytes', 'output_octets']
    return (sessao) => {
      const stats = (sessao as { stats?: { total?: Record<string, unknown> } }).stats?.total
      const valorAninhado = stats?.[chaveAninhada]
      if (valorAninhado != null && valorAninhado !== '') {
        // stats.total.rx_byte/tx_byte vêm em KB, não bytes — converte antes de formatar.
        return { valor: Number(valorAninhado) * 1024, chave: chaveAninhada }
      }
      return porCandidatos(candidatosPlanos)(sessao)
    }
  }

  const CAMPOS_DESEJADOS: CampoDesejado[] = [
    { rotulo: 'Usuário PPPoE', extrair: porCandidatos(['session_username', 'cpe_username', 'username']) },
    { rotulo: 'MAC da CPE', extrair: porCandidatos(['session_callingid', 'cpe_mac', 'session_calling_station_id', 'mac']) },
    {
      rotulo: 'Status do contrato',
      extrair: porCandidatos(['contract_status', 'contract_status_name', 'client_contract_status']),
      formatar: (valor) => formatarStatusContrato(valor as number | string),
    },
    { rotulo: 'NAS (nome/identificador)', extrair: porCandidatos(['nas_name', 'session_nas_identifier', 'nas_identifier']) },
    { rotulo: 'NAS (endereço/IP)', extrair: porCandidatos(['nas_addr', 'session_nas_ip', 'nas_ip_address', 'nas_address']) },
    { rotulo: 'NAS (porta)', extrair: porCandidatos(['session_nas_port_id', 'nas_port_id']) },
    { rotulo: 'Circuit ID', extrair: porCandidatos(['session_circuit_id', 'cpe_circuit_id']) },
    { rotulo: 'IPv4', extrair: porCandidatos(['session_v4_ip', 'v4_ip']) },
    { rotulo: 'IPv6 (PX)', extrair: porCandidatos(['session_v6_px', 'v6_px']) },
    { rotulo: 'IPv6 (PD)', extrair: porCandidatos(['session_v6_pd', 'v6_pd']) },
    {
      rotulo: 'Tempo conectado',
      extrair: porCandidatos(['session_acct_time', 'session_uptime', 'session_duration', 'session_time']),
      formatar: formatarTempoConectado,
    },
    // rx/tx aqui são do ponto de vista do NAS (padrão RADIUS accounting):
    // rx_byte = recebido PELO NAS vindo do cliente = upload do cliente;
    // tx_byte = enviado PELO NAS para o cliente = download do cliente.
    { rotulo: 'Consumo (download)', extrair: porConsumo('tx'), formatar: formatarBytes },
    { rotulo: 'Consumo (upload)', extrair: porConsumo('rx'), formatar: formatarBytes },
  ]

  function camposSessao(): Array<[string, string]> {
    if (!sessao) return []
    const resultado: Array<[string, string]> = []
    for (const campo of CAMPOS_DESEJADOS) {
      const encontrado = campo.extrair(sessao)
      if (!encontrado) continue
      const { valor, chave } = encontrado
      if (valor == null || valor === '') continue
      resultado.push([campo.rotulo, campo.formatar ? campo.formatar(valor, chave) : String(valor)])
    }
    return resultado
  }

  return (
    <PullToRefresh aoAtualizar={carregar}>
      <div className="conexao-tela tela-entrada">
        <CabecalhoTela icone={MdWifi} cor={CORES.conexao} titulo="Conexão" subtitulo="Dados de acesso e sessão do cliente." />

        {!temParametroInicial && (
          <>
            <form className="conexao-card conexao-busca conexao-combobox" onSubmit={aoBuscarUsuario}>
              <label htmlFor="conexao-usuario-input">Usuário PPPoE</label>
              <div className="conexao-busca-campo">
                <input
                  id="conexao-usuario-input"
                  type="text"
                  placeholder="Digite o usuário"
                  value={buscaUsuario}
                  onChange={(e) => setBuscaUsuario(e.target.value)}
                  onFocus={() => setListaUsuarioAberta(true)}
                  onBlur={() => setTimeout(() => setListaUsuarioAberta(false), 150)}
                />
                <button type="submit" aria-label="Buscar">
                  <MdSearch size={20} />
                </button>
              </div>
              {listaUsuarioAberta && buscaUsuario.trim().length >= 2 && (
                <ul className="conexao-combobox-lista">
                  {buscandoUsuario && <li className="conexao-combobox-vazio">Buscando…</li>}
                  {!buscandoUsuario && resultadosBuscaUsuario.length === 0 && (
                    <li className="conexao-combobox-vazio">Nenhum usuário encontrado.</li>
                  )}
                  {!buscandoUsuario &&
                    resultadosBuscaUsuario.map((resultado) => (
                      <li key={resultado.pk}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setListaUsuarioAberta(false)
                            if (resultado.pk) setParams({ cpe_pk: String(resultado.pk) })
                          }}
                        >
                          <strong>{resultado.username}</strong>
                          {resultado.client_complete_name && ` — ${resultado.client_complete_name}`}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </form>
            {!erro && (
              <EstadoVazio
                icone={MdWifi}
                titulo="Busque pelo usuário PPPoE"
                subtitulo="Ou acesse esta tela a partir dos detalhes de um cliente."
              />
            )}
          </>
        )}

        {carregando && (
          <div className="conexao-card">
            <Skeleton width="50%" height={16} />
            <Skeleton width="70%" height={13} />
            <Skeleton width="40%" height={13} />
          </div>
        )}

        {!carregando && erro && (
          <div className="conexao-status">
            <p>{erro}</p>
            <button className="botao botao-primario" style={{ '--botao-cor': CORES.conexao } as CSSProperties} onClick={tentarNovamente}>
              Tentar novamente
            </button>
          </div>
        )}

        {temParametroInicial && !carregando && !erro && !cpe && (
          <EstadoVazio icone={MdWifi} titulo="Nenhuma conexão encontrada." />
        )}

        {!carregando && !erro && cpe && (
          <>
            <div className="conexao-card">
              <div className="conexao-linha">
                <span>Cliente</span>
                {cpe.client_pk ? (
                  <Link to={`/clientes/${cpe.client_pk}`} className="conexao-link" viewTransition>
                    <MdPeopleAlt size={14} /> {cpe.client_complete_name ?? '—'}
                  </Link>
                ) : (
                  <strong>{cpe.client_complete_name ?? '—'}</strong>
                )}
              </div>
              <div className="conexao-linha">
                <span>Contrato</span>
                {/* Sem Link de propósito — mesmo destino do link "Cliente"
                    acima (/clientes/{client_pk}), então já dava para chegar
                    lá clicando no nome; um segundo link redundante aqui só
                    confundia. */}
                <strong>{cpe.contract_number ?? cpe.contract_pk ?? '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>Plano</span>
                <strong>{cpe.plan_name ?? '—'}</strong>
              </div>
            </div>

            <div className="conexao-card">
              <h2>Acesso PPPoE (login do cliente)</h2>
              <div className="conexao-campo">
                <span>Usuário</span>
                <div className="conexao-campo-valor">
                  <strong>{cpe.username ?? '—'}</strong>
                  {cpe.username && (
                    <Link to={`/onu?username=${encodeURIComponent(cpe.username)}`} className="conexao-btn-link" aria-label="Ver ONU deste usuário" viewTransition>
                      <MdRouter size={16} />
                    </Link>
                  )}
                  <button onClick={() => copiar(cpe.username, 'Usuário')} aria-label="Copiar usuário">
                    <MdContentCopy size={16} />
                  </button>
                </div>
              </div>
              <div className="conexao-campo">
                <span>Senha</span>
                <div className="conexao-campo-valor">
                  <strong>{mostrarSenha ? cpe.password ?? '—' : '••••••••'}</strong>
                  <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                    {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                  </button>
                  <button onClick={() => copiar(cpe.password, 'Senha')} aria-label="Copiar senha">
                    <MdContentCopy size={16} />
                  </button>
                </div>
              </div>
            </div>

            <div className="conexao-card">
              {/* Credencial diferente do PPPoE acima — acesso administrativo
                  ao próprio roteador/CPE, não o login de internet do cliente
                  (cpe_access_login/password/port, doc oficial do
                  Controllr). Editável. Recolhido por padrão. */}
              <button
                type="button"
                className="conexao-card-toggle"
                onClick={() => alternarBloco('roteador')}
                aria-expanded={blocosAbertos.has('roteador')}
              >
                <h2>Acesso ao roteador (admin)</h2>
                {blocosAbertos.has('roteador') ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
              </button>
              {blocosAbertos.has('roteador') && (
                <>
                  <div className="conexao-campo">
                    <span>Usuário</span>
                    <input className="conexao-input" value={acessoLogin} onChange={(e) => setAcessoLogin(e.target.value)} placeholder="Não informado" />
                  </div>
                  <div className="conexao-campo">
                    <span>Senha</span>
                    <div className="conexao-campo-valor">
                      <input
                        className="conexao-input"
                        type={mostrarSenhaRoteador ? 'text' : 'password'}
                        value={acessoSenha}
                        onChange={(e) => setAcessoSenha(e.target.value)}
                        placeholder="Não informado"
                      />
                      <button
                        onClick={() => setMostrarSenhaRoteador((v) => !v)}
                        aria-label={mostrarSenhaRoteador ? 'Ocultar senha do roteador' : 'Mostrar senha do roteador'}
                      >
                        {mostrarSenhaRoteador ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="conexao-campo">
                    <span>Porta</span>
                    <input
                      className="conexao-input"
                      type="number"
                      value={acessoPorta}
                      onChange={(e) => setAcessoPorta(e.target.value)}
                      placeholder="Não informado"
                    />
                  </div>
                  <button
                    className="botao botao-secundario botao-pequeno"
                    style={{ '--botao-cor': CORES.conexao } as CSSProperties}
                    onClick={salvarAcessoRoteador}
                    disabled={salvandoAcesso}
                  >
                    <MdSave size={14} /> {salvandoAcesso ? 'Salvando…' : 'Salvar acesso'}
                  </button>
                </>
              )}
            </div>

            <div className="conexao-card">
              {/* cpe_obs, doc oficial de /aaa_ctl/cpe/update. Recolhido por
                  padrão. */}
              <button
                type="button"
                className="conexao-card-toggle"
                onClick={() => alternarBloco('obs')}
                aria-expanded={blocosAbertos.has('obs')}
              >
                <h2>Observação do CPE</h2>
                {blocosAbertos.has('obs') ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
              </button>
              {blocosAbertos.has('obs') && (
                <>
                  <div className="conexao-campo">
                    <textarea
                      className="conexao-input conexao-textarea"
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      placeholder="Sem observação"
                      rows={3}
                    />
                  </div>
                  <button
                    className="botao botao-secundario botao-pequeno"
                    style={{ '--botao-cor': CORES.conexao } as CSSProperties}
                    onClick={salvarObs}
                    disabled={salvandoObs}
                  >
                    <MdSave size={14} /> {salvandoObs ? 'Salvando…' : 'Salvar observação'}
                  </button>
                </>
              )}
            </div>

            <div className="conexao-card">
              {/* cpe_wifi_encryption_type/password (doc oficial do Controllr;
                  valores: 0 Nenhum, 1 WEP, 2 WPA, 3 EAP). Com "Nenhum" não
                  faz sentido ter
                  senha — o campo fica desabilitado e é limpo nesse caso.
                  Pré-preenchido com o que o sistema fornecer; só é enviado
                  ao Controllr quando o técnico clicar em Salvar. Recolhido
                  por padrão. */}
              <button
                type="button"
                className="conexao-card-toggle"
                onClick={() => alternarBloco('wifi')}
                aria-expanded={blocosAbertos.has('wifi')}
              >
                <h2>Wi-Fi do CPE (criptografia)</h2>
                {blocosAbertos.has('wifi') ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
              </button>
              {blocosAbertos.has('wifi') && (
                <>
                  <div className="conexao-campo">
                    <span>Tipo de criptografia</span>
                    <select
                      className="conexao-input"
                      value={wifiTipo}
                      onChange={(e) => {
                        setWifiTipo(e.target.value)
                        if (e.target.value === '0') setWifiSenha('')
                      }}
                    >
                      {OPCOES_CRIPTOGRAFIA_WIFI.map((opcao) => (
                        <option key={opcao.valor} value={opcao.valor}>
                          {opcao.rotulo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="conexao-campo">
                    <span>Senha do Wi-Fi</span>
                    <div className="conexao-campo-valor">
                      <input
                        className="conexao-input"
                        type={mostrarSenhaWifi ? 'text' : 'password'}
                        value={wifiSemCriptografia ? '' : wifiSenha}
                        onChange={(e) => setWifiSenha(e.target.value)}
                        disabled={wifiSemCriptografia}
                        placeholder={wifiSemCriptografia ? 'Sem criptografia — sem senha' : 'Não informado'}
                      />
                      <button
                        onClick={() => setMostrarSenhaWifi((v) => !v)}
                        disabled={wifiSemCriptografia}
                        aria-label={mostrarSenhaWifi ? 'Ocultar senha do Wi-Fi' : 'Mostrar senha do Wi-Fi'}
                      >
                        {mostrarSenhaWifi ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                      </button>
                    </div>
                  </div>
                  <button
                    className="botao botao-secundario botao-pequeno"
                    style={{ '--botao-cor': CORES.conexao } as CSSProperties}
                    onClick={salvarWifi}
                    disabled={salvandoWifi}
                  >
                    <MdSave size={14} /> {salvandoWifi ? 'Salvando…' : 'Salvar Wi-Fi'}
                  </button>
                </>
              )}
            </div>

            <div className="conexao-card">
              {/* dp_pk e cpe_dp_port (CTO/porta da CTO), doc oficial de
                  /aaa_ctl/cpe/update. A lista de CTOs vem do
                  próprio sistema (GET /dp/lista), para selecionar em vez de
                  digitar um pk cru. */}
              <h2>CTO</h2>
              <div className="conexao-campo conexao-combobox">
                <span>CTO</span>
                <div className="conexao-campo-valor">
                  <input
                    className="conexao-input"
                    type="text"
                    value={dpBusca}
                    placeholder="Digite para buscar a CTO"
                    onChange={(e) => {
                      setDpBusca(e.target.value)
                      setDpPk('')
                      setDpListaAberta(true)
                    }}
                    onFocus={() => setDpListaAberta(true)}
                    onBlur={() => setTimeout(() => setDpListaAberta(false), 150)}
                  />
                  <button
                    type="button"
                    onClick={usarLocalizacaoAtual}
                    disabled={localizando}
                    aria-label="Usar minha localização para sugerir a CTO mais próxima"
                    title={localizando ? 'Obtendo localização mais precisa…' : 'Usar minha localização para sugerir a CTO mais próxima'}
                  >
                    <MdMyLocation size={16} />
                  </button>
                </div>
                {minhaLocalizacao && precisaoLocalizacaoM != null && (
                  <span className="conexao-combobox-precisao">
                    Sua localização: precisão de ±{Math.round(precisaoLocalizacaoM)} m
                  </span>
                )}
                {dpListaAberta && (
                  <ul className="conexao-combobox-lista">
                    {dpsFiltradas.length === 0 && <li className="conexao-combobox-vazio">Nenhuma CTO encontrada.</li>}
                    {dpsFiltradas.map((dp) => (
                      <li key={dp.pk}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setDpPk(String(dp.pk))
                            setDpBusca(dp.name)
                            setDpListaAberta(false)
                          }}
                        >
                          {dp.name}
                          {dp.distanciaM != null && (
                            <span className="conexao-combobox-distancia"> — {formatarDistancia(dp.distanciaM)}</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="conexao-campo">
                <span>Porta da CTO</span>
                <input
                  className="conexao-input"
                  type="number"
                  value={dpPorta}
                  onChange={(e) => setDpPorta(e.target.value)}
                  placeholder="Não informado"
                />
              </div>
              <button
                className="botao botao-secundario botao-pequeno"
                style={{ '--botao-cor': CORES.conexao } as CSSProperties}
                onClick={salvarCto}
                disabled={salvandoCto}
              >
                <MdSave size={14} /> {salvandoCto ? 'Salvando…' : 'Salvar CTO'}
              </button>
            </div>

            <div className="conexao-card">
              <h2>Rede</h2>
              <div className="conexao-linha">
                <span>IP</span>
                <strong>{cpe.v4_ip ?? cpe.v4_ip_last ?? '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>MAC</span>
                <strong>{cpe.mac ?? cpe.mac_last ?? '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>Última autenticação</span>
                <strong>{cpe.date_auth ? formatarDataHoraSegundos(cpe.date_auth) : '—'}</strong>
              </div>

              <button
                type="button"
                className="conexao-card-toggle conexao-historico-toggle"
                onClick={() => alternarBloco('historico')}
                aria-expanded={historicoAberto}
              >
                <span>Histórico de conexão</span>
                {historicoAberto ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
              </button>
              {historicoAberto && (
                <>
                  <div className="conexao-campo">
                    <span>Período</span>
                    <select
                      className="conexao-input"
                      value={periodoPreset}
                      onChange={(e) => setPeriodoPreset(e.target.value as PeriodoPreset)}
                    >
                      {OPCOES_PERIODO.map((opcao) => (
                        <option key={opcao.valor} value={opcao.valor}>
                          {opcao.rotulo}
                        </option>
                      ))}
                    </select>
                  </div>
                  {periodoPreset === 'personalizado' && (
                    <div className="conexao-historico-intervalo">
                      <input
                        className="conexao-input"
                        type="date"
                        value={intervaloInicio}
                        onChange={(e) => setIntervaloInicio(e.target.value)}
                      />
                      <input
                        className="conexao-input"
                        type="date"
                        value={intervaloFim}
                        onChange={(e) => setIntervaloFim(e.target.value)}
                      />
                    </div>
                  )}
                  {carregandoHistorico && historico.length === 0 && <Skeleton width="60%" height={14} />}
                  {!carregandoHistorico && historico.length === 0 && (
                    <p className="conexao-sessao-vazio">Nenhuma sessão encontrada no período.</p>
                  )}
                  {historico.map((sessao, indice) => (
                    <div className="conexao-historico-item" key={`${sessao.session_date_close ?? ''}-${indice}`}>
                      <div className="conexao-linha">
                        <span>Início</span>
                        <strong>{sessao.session_date_start ? formatarDataHoraSegundos(sessao.session_date_start) : '—'}</strong>
                      </div>
                      <div className="conexao-linha">
                        <span>Fim</span>
                        <strong>{sessao.session_date_close ? formatarDataHoraSegundos(sessao.session_date_close) : 'Em andamento'}</strong>
                      </div>
                      <div className="conexao-linha">
                        <span>Duração</span>
                        <strong>{sessao.session_acct_time != null ? formatarDuracaoSegundos(sessao.session_acct_time) : '—'}</strong>
                      </div>
                      <div className="conexao-linha">
                        <span>Consumo (download / upload)</span>
                        <strong>
                          {sessao.session_tx_byte != null && sessao.session_rx_byte != null
                            ? `${formatarBytes(sessao.session_tx_byte * 1024)} / ${formatarBytes(sessao.session_rx_byte * 1024)}`
                            : '—'}
                        </strong>
                      </div>
                      <div className="conexao-linha">
                        <span>IPv4</span>
                        <strong>{sessao.session_v4_ip ?? '—'}</strong>
                      </div>
                      <div className="conexao-linha">
                        <span>IPv6 PX</span>
                        <strong>{sessao.session_v6_px || '—'}</strong>
                      </div>
                      <div className="conexao-linha">
                        <span>IPv6 PD</span>
                        <strong>{sessao.session_v6_pd || '—'}</strong>
                      </div>
                      <div className="conexao-linha">
                        <span>NAS Port ID</span>
                        <strong>{sessao.session_nas_port_id ?? '—'}</strong>
                      </div>
                      <div className="conexao-linha">
                        <span>Encerrada por</span>
                        <strong>{rotuloEncerramento(sessao.session_terminate_cause)}</strong>
                      </div>
                    </div>
                  ))}
                  {temMaisHistorico && (
                    <button
                      className="botao botao-secundario botao-pequeno"
                      style={{ '--botao-cor': CORES.conexao } as CSSProperties}
                      onClick={() => carregarHistorico(Math.floor(historico.length / LIMITE_HISTORICO) + 1)}
                      disabled={carregandoHistorico}
                    >
                      <MdExpandMore size={14} /> {carregandoHistorico ? 'Carregando…' : 'Carregar mais'}
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="conexao-card">
              <div className="conexao-sessao-topo">
                <h2>Sessão online</h2>
                <button
                  className="botao botao-secundario botao-pequeno"
                  style={{ '--botao-cor': CORES.conexao } as CSSProperties}
                  onClick={verSessaoOnline}
                  disabled={carregandoSessao}
                >
                  <MdRefresh size={14} /> {carregandoSessao ? 'Consultando…' : 'Atualizar'}
                </button>
              </div>
              {carregandoSessao && !sessao && <Skeleton width="60%" height={14} />}
              {sessao && camposSessao().length === 0 && (
                <p className="conexao-sessao-vazio">Cliente sem sessão online no momento.</p>
              )}
              {sessao &&
                camposSessao().map(([rotulo, valor]) => (
                  <div className="conexao-linha" key={rotulo}>
                    <span>{rotulo}</span>
                    <strong>{valor}</strong>
                  </div>
                ))}
              {!carregandoSessao && !sessao && (
                <p className="conexao-sessao-vazio">Não foi possível consultar a sessão online agora.</p>
              )}
            </div>

            {carregandoOnuResumo && (
              <div className="conexao-card">
                <h2>ONU</h2>
                <Skeleton width="60%" height={14} />
              </div>
            )}
            {!carregandoOnuResumo && onuResumo && (
              <div className="conexao-card">
                <div className="conexao-sessao-topo">
                  <h2>ONU</h2>
                  <Link
                    to={`/onu?username=${encodeURIComponent(cpe.username ?? '')}`}
                    className="botao botao-secundario botao-pequeno"
                    style={{ '--botao-cor': CORES.onu } as CSSProperties}
                    viewTransition
                  >
                    <MdRouter size={14} /> Detalhes
                  </Link>
                </div>
                <div className="conexao-linha">
                  <span>Estado</span>
                  <strong>{onuResumo.state ?? '—'}</strong>
                </div>
                <div className="conexao-linha">
                  <span>Sinal RX</span>
                  <strong>{onuResumo.omddm_rx_power != null ? `${onuResumo.omddm_rx_power} dBm` : '—'}</strong>
                </div>
                <div className="conexao-linha">
                  <span>Modelo</span>
                  <strong>{onuResumo.model ?? '—'}</strong>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PullToRefresh>
  )
}
