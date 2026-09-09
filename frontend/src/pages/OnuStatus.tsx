import { lazy, Suspense, useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  MdContentCopy,
  MdDeleteForever,
  MdEdit,
  MdPeopleAlt,
  MdPersonAdd,
  MdPowerSettingsNew,
  MdQrCodeScanner,
  MdRefresh,
  MdRouter,
  MdVisibility,
  MdVisibilityOff,
  MdWifi,
} from 'react-icons/md'
import {
  ApiError,
  associarClienteOnu,
  atualizarInfoOnu,
  buscarClientes,
  buscarCpe,
  buscarOnu,
  reiniciarOnu,
  removerOnu,
  renomearOnu,
  type BuscaClienteResultado,
  type CpeComboDto,
  type CpeDto,
  type OnuDto,
} from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import { nivelSinalOnu, type NivelSinal } from '../utils/formatacao'
import './OnuStatus.css'

// Import tardio — @zxing/library sozinha soma ~470 KB ao bundle (decoders
// de todo formato de código que existe, não só os usados na etiqueta da
// ONU). Carregar só quando o técnico realmente abre o leitor evita esse
// peso em toda visita à tela de ONU.
const LeitorCodigoBarras = lazy(() => import('../components/LeitorCodigoBarras'))

/**
 * Faixa de sinal óptico (dBm) da OLT — mesma origem/critério de
 * nivelSinalOnu (utils/formatacao.ts), mas com cortes diferentes (não é
 * a mesma faixa da ONU, ver comentário lá).
 */
function nivelSinalOlt(rx: number | undefined): NivelSinal {
  if (rx == null) return 'desconhecida'
  if (rx >= -25) return 'boa'
  if (rx >= -27) return 'alerta'
  return 'critica'
}

// onu_info_timer — contador em ms desde a última coleta feita pelo
// Controllr (confirmado pelo usuário); zera só quando alguém clica em
// "Atualizar agora" (ver CONTROLLR_API_NOTES.md).
function formatarTempoDesdeColeta(ms: number | undefined): string | null {
  if (ms == null) return null
  const segundosTotais = Math.floor(ms / 1000)
  const minutos = Math.floor(segundosTotais / 60)
  const segundos = segundosTotais % 60
  if (minutos === 0) return `há ${segundos}s`
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  const minutosRestantes = minutos % 60
  return `há ${horas}h${minutosRestantes > 0 ? ` ${minutosRestantes}min` : ''}`
}

const TEXTO_SINAL: Record<NivelSinal, string> = {
  boa: 'Sinal normal',
  alerta: 'Sinal fraco — atenção',
  critica: 'Sinal crítico',
  desconhecida: 'Sinal não informado',
}

type ResultadoCombo = { tipo: 'serial'; item: OnuDto } | { tipo: 'usuario'; item: CpeDto }

export default function OnuStatus() {
  const [params, setParams] = useSearchParams()
  const cpePkParam = params.get('cpe_pk')
  const usernameParam = params.get('username')
  const serialParam = params.get('serial')
  // Usuário PPPoE do CPE é o jeito confiável de achar a ONU de um
  // cliente (ver backend/app/routers/onu.py) — cpe_pk sozinho é
  // ambíguo em /fiber_ctl/onu/list e já causou mostrar a ONU de outro
  // cliente. Prioriza username quando os dois vierem informados.
  const temParametroInicial = !!usernameParam || !!serialParam || !!cpePkParam
  const { toast } = useToast()

  function buscarInicial() {
    if (usernameParam) return buscarOnu({ username: usernameParam })
    if (serialParam) return buscarOnu({ serial: serialParam })
    return buscarOnu({ cpe_pk: Number(cpePkParam) })
  }

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [onu, setOnu] = useState<OnuDto | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  // Reiniciar/Remover — achados lendo (sem disparar de verdade) o handler
  // real dos ícones de ação da tela "ONU - Registrado" do painel via
  // Ext.ComponentQuery; nunca documentados na doc oficial. Confirmação em
  // 2 passos sempre (mesmo padrão de "Fibra Onu" do próprio painel), já
  // que os dois afetam a conexão do cliente na hora.
  const [confirmandoAcao, setConfirmandoAcao] = useState<'reiniciar' | 'remover' | null>(null)
  const [executandoAcao, setExecutandoAcao] = useState(false)
  const [registrandoCliente, setRegistrandoCliente] = useState(false)
  // Renomear — mesmo endpoint achado lendo (sem disparar de verdade) o
  // handler do lápis "Renomear ONU" do painel (ver CONTROLLR_API_NOTES.md):
  // POST /fiber_ctl/onu/apply_rename com os identificadores OSPO + onu_name.
  const [renomeando, setRenomeando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [salvandoNome, setSalvandoNome] = useState(false)
  // Leitor de código de barras/QR pela câmera — alternativa a digitar o
  // serial na mão (etiqueta da ONU costuma ter o número em código de
  // barras). Ver LeitorCodigoBarras.tsx.
  const [lendoCodigo, setLendoCodigo] = useState(false)
  // Combobox único — busca por serial (/fiber_ctl/onu/list no formato
  // "wizard", confirmado ao vivo que filtra por PREFIXO: "ZTEG" já
  // filtrou de 2550 para 764 resultados) e por usuário PPPoE (/cpe/busca,
  // que suporta ILIKE parcial) em paralelo, e mistura os dois num só
  // dropdown — o técnico não precisa saber de antemão se tem o serial ou
  // o usuário em mãos. Selecionar um item de serial já é a própria ONU;
  // selecionar um item de usuário busca a ONU pelo usuário exato dele.
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ResultadoCombo[]>([])
  const [buscandoCombo, setBuscandoCombo] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)

  useEffect(() => {
    if (!temParametroInicial) {
      setCarregando(false)
      return
    }
    carregar(buscarInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpePkParam, usernameParam, serialParam])

  useEffect(() => {
    const valor = busca.trim()
    if (valor.length < 2) {
      setResultados([])
      return
    }
    let cancelado = false
    setBuscandoCombo(true)
    const temporizador = setTimeout(() => {
      Promise.all([
        buscarOnu({ serial: valor }).catch(() => ({ results: [] as OnuDto[] })),
        buscarCpe({ username: valor }).catch(() => ({ results: [] as CpeDto[] })),
      ])
        .then(([respostaOnu, respostaCpe]) => {
          if (cancelado) return
          setResultados([
            ...respostaOnu.results.map((item): ResultadoCombo => ({ tipo: 'serial', item })),
            ...respostaCpe.results.map((item): ResultadoCombo => ({ tipo: 'usuario', item })),
          ])
        })
        .finally(() => {
          if (!cancelado) setBuscandoCombo(false)
        })
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [busca])

  async function carregar(chamada: () => ReturnType<typeof buscarOnu>) {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await chamada()
      setOnu(resposta.results[0] ?? null)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar o status da ONU.')
    } finally {
      setCarregando(false)
    }
  }

  function selecionar(resultado: ResultadoCombo) {
    setListaAberta(false)
    setBusca('')
    if (resultado.tipo === 'serial' && resultado.item.sn) setParams({ serial: resultado.item.sn })
    else if (resultado.tipo === 'usuario' && resultado.item.username) setParams({ username: resultado.item.username })
  }

  function aoSubmeterBusca(evento: FormEvent) {
    evento.preventDefault()
    if (resultados.length === 1) selecionar(resultados[0])
  }

  function aoLerCodigo(valor: string) {
    setLendoCodigo(false)
    setListaAberta(false)
    setBusca('')
    setParams({ serial: valor.trim().toUpperCase() })
  }

  function tentarNovamente() {
    carregar(buscarInicial)
  }

  async function atualizarAgora() {
    // onu.pk (onu_pk) vem 0 pra ONU registrada na OLT mas ainda sem
    // cliente vinculado — 0 é um pk válido aqui, não "faltando". Usar
    // "!onu.pk" (falsy) tratava esse caso real como dado insuficiente.
    if (!onu || onu.pk == null || onu.olt_pk == null || !onu.sn || onu.slot == null || onu.pon == null || onu.id == null) {
      toast('Dados insuficientes para atualizar esta ONU.')
      return
    }
    setAtualizando(true)
    // Reconecta a OLT antes de reler (força ela a recarregar os dados) —
    // demora de propósito (~45s), ver backend/app/routers/onu.py.
    toast('Reconectando a OLT e aguardando atualizar — isso leva cerca de 1 minuto.', 'info')
    try {
      await atualizarInfoOnu(onu.pk, {
        olt_pk: onu.olt_pk,
        onu_serial: onu.sn,
        slot_id: onu.slot,
        port_id: onu.pon,
        onu_id: onu.id,
        frame_id: onu.frame ?? 1,
      })
      if (temParametroInicial) await carregar(buscarInicial)
      else if (onu.sn) await carregar(() => buscarOnu({ serial: onu.sn }))
      toast('ONU atualizada.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar a ONU.')
    } finally {
      setAtualizando(false)
    }
  }

  function dadosOspo() {
    if (!onu || onu.olt_pk == null || onu.slot == null || onu.pon == null || onu.id == null) return null
    return { olt_pk: onu.olt_pk, slot_id: onu.slot, port_id: onu.pon, onu_id: onu.id, frame_id: onu.frame ?? 1 }
  }

  // Antes de reiniciar/remover/associar, releem a ONU do zero — mesmo
  // efeito que o técnico buscar de novo manualmente (contornava um bug
  // observado em produção: os identificadores olt_pk/slot/port/onu_id
  // às vezes vêm incompletos na primeira leitura da ONU, e uma segunda
  // busca sempre trazia os dados corretos).
  const [atualizandoAntesDaAcao, setAtualizandoAntesDaAcao] = useState(false)

  async function recarregarOnuAtual(): Promise<OnuDto | null> {
    if (temParametroInicial) {
      const resposta = await buscarInicial()
      const atualizada = resposta.results[0] ?? null
      setOnu(atualizada)
      return atualizada
    }
    if (onu?.sn) {
      const resposta = await buscarOnu({ serial: onu.sn })
      const atualizada = resposta.results[0] ?? null
      setOnu(atualizada)
      return atualizada
    }
    return onu
  }

  async function abrirAcao(acao: 'reiniciar' | 'remover') {
    setAtualizandoAntesDaAcao(true)
    try {
      const atualizada = await recarregarOnuAtual()
      if (!atualizada) {
        toast('Não foi possível atualizar os dados da ONU.')
        return
      }
      setConfirmandoAcao(acao)
    } catch {
      toast('Não foi possível atualizar os dados da ONU.')
    } finally {
      setAtualizandoAntesDaAcao(false)
    }
  }

  async function abrirRegistrarCliente() {
    setAtualizandoAntesDaAcao(true)
    try {
      const atualizada = await recarregarOnuAtual()
      if (!atualizada) {
        toast('Não foi possível atualizar os dados da ONU.')
        return
      }
      setRegistrandoCliente(true)
    } catch {
      toast('Não foi possível atualizar os dados da ONU.')
    } finally {
      setAtualizandoAntesDaAcao(false)
    }
  }

  async function abrirRenomear() {
    setAtualizandoAntesDaAcao(true)
    try {
      const atualizada = await recarregarOnuAtual()
      if (!atualizada) {
        toast('Não foi possível atualizar os dados da ONU.')
        return
      }
      setNovoNome(atualizada.name ?? '')
      setRenomeando(true)
    } catch {
      toast('Não foi possível atualizar os dados da ONU.')
    } finally {
      setAtualizandoAntesDaAcao(false)
    }
  }

  async function confirmarRenomear() {
    const ospo = dadosOspo()
    const nome = novoNome.trim()
    if (!onu || onu.pk == null || !ospo || !nome) {
      toast('Informe um nome válido para a ONU.')
      return
    }
    setSalvandoNome(true)
    try {
      await renomearOnu(onu.pk, { ...ospo, onu_name: nome })
      setOnu((atual) => (atual ? { ...atual, name: nome } : atual))
      setRenomeando(false)
      toast('ONU renomeada.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível renomear a ONU.')
    } finally {
      setSalvandoNome(false)
    }
  }

  async function executarAcao() {
    const acao = confirmandoAcao
    const ospo = dadosOspo()
    // onu.pk (onu_pk) vem 0 pra ONU sem cliente vinculado — válido aqui,
    // não "faltando" (ver comentário em atualizarAgora).
    if (!acao || !onu || onu.pk == null || !ospo) {
      toast('Dados insuficientes para executar esta ação.')
      setConfirmandoAcao(null)
      return
    }
    setExecutandoAcao(true)
    try {
      if (acao === 'reiniciar') {
        await reiniciarOnu(onu.pk, ospo)
        toast('ONU reiniciada.', 'sucesso')
      } else {
        await removerOnu(onu.pk, ospo)
        toast('ONU removida do registro.', 'sucesso')
        setOnu(null)
        setParams({})
      }
      setConfirmandoAcao(null)
    } catch (excecao) {
      toast(
        excecao instanceof ApiError
          ? excecao.message
          : `Não foi possível ${acao === 'reiniciar' ? 'reiniciar' : 'remover'} a ONU.`,
      )
    } finally {
      setExecutandoAcao(false)
    }
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

  const statusOnu = nivelSinalOnu(onu?.omddm_rx_power)
  const statusOlt = nivelSinalOlt(onu?.olt_omddm_rx_power)
  const semSelecao = !temParametroInicial && !onu && !carregando

  return (
    <div className="onu-tela tela-entrada">
      <CabecalhoTela icone={MdRouter} cor={CORES.onu} titulo="ONU" subtitulo="Sinal óptico e status do equipamento." />

      <form className="onu-card onu-busca onu-combobox" onSubmit={aoSubmeterBusca}>
        <label htmlFor="onu-busca-input">Serial da ONU ou usuário PPPoE</label>
        <div className="onu-busca-campo">
          <input
            id="onu-busca-input"
            type="text"
            placeholder="Digite o serial ou o usuário"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setListaAberta(true)
            }}
            onFocus={() => setListaAberta(true)}
            onBlur={() => setTimeout(() => setListaAberta(false), 150)}
          />
          <button
            type="button"
            onClick={() => setLendoCodigo(true)}
            aria-label="Ler código de barras ou QR pela câmera"
            title="Ler código de barras ou QR pela câmera"
          >
            <MdQrCodeScanner size={20} />
          </button>
        </div>
        {listaAberta && busca.trim().length >= 2 && (
          <ul className="onu-combobox-lista">
            {buscandoCombo && <li className="onu-combobox-vazio">Buscando…</li>}
            {!buscandoCombo && resultados.length === 0 && <li className="onu-combobox-vazio">Nada encontrado.</li>}
            {!buscandoCombo &&
              resultados.map((resultado) => (
                <li key={`${resultado.tipo}-${resultado.item.pk}`}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selecionar(resultado)}>
                    {resultado.tipo === 'serial' ? (
                      <>
                        <strong>{resultado.item.sn}</strong>
                        {resultado.item.client_name && ` — ${resultado.item.client_name}`}
                      </>
                    ) : (
                      <>
                        <strong>{resultado.item.username}</strong>
                        {resultado.item.client_complete_name && ` — ${resultado.item.client_complete_name}`}
                      </>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </form>

      {semSelecao && !erro && (
        <EstadoVazio
          icone={MdRouter}
          titulo="Busque pelo serial da ONU ou pelo usuário PPPoE"
          subtitulo="Ou acesse esta tela a partir dos detalhes de um cliente."
        />
      )}

      {carregando && (
        <div className="onu-card">
          <Skeleton width="50%" height={16} />
          <Skeleton width="70%" height={13} />
        </div>
      )}

      {!carregando && erro && (
        <div className="onu-status-erro">
          <p>{erro}</p>
          <button className="botao botao-primario" style={{ '--botao-cor': CORES.onu } as CSSProperties} onClick={tentarNovamente}>
            Tentar novamente
          </button>
        </div>
      )}

      {temParametroInicial && !carregando && !erro && !onu && (
        <EstadoVazio icone={MdRouter} titulo="Nenhuma ONU encontrada para esta conexão." />
      )}

      {!carregando && !erro && onu && (
        <>
          <div className={`onu-card onu-sinal onu-sinal-${statusOnu}`}>
            <span className="onu-sinal-titulo">ONU — {TEXTO_SINAL[statusOnu]}</span>
            <div className="onu-sinal-grid">
              <div>
                <span>RX</span>
                <strong>{onu.omddm_rx_power != null ? `${onu.omddm_rx_power} dBm` : '—'}</strong>
              </div>
              <div>
                <span>TX</span>
                <strong>{onu.omddm_tx_power != null ? `${onu.omddm_tx_power} dBm` : '—'}</strong>
              </div>
            </div>
          </div>

          {(onu.olt_omddm_rx_power != null || onu.olt_omddm_tx_power != null) && (
            <div className={`onu-card onu-sinal onu-sinal-${statusOlt}`}>
              <span className="onu-sinal-titulo">OLT — {TEXTO_SINAL[statusOlt]}</span>
              <div className="onu-sinal-grid">
                <div>
                  <span>RX</span>
                  <strong>{onu.olt_omddm_rx_power != null ? `${onu.olt_omddm_rx_power} dBm` : '—'}</strong>
                </div>
                <div>
                  <span>TX</span>
                  <strong>{onu.olt_omddm_tx_power != null ? `${onu.olt_omddm_tx_power} dBm` : '—'}</strong>
                </div>
              </div>
            </div>
          )}

          {onu.wancfg_pppoe_username && (
            <div className="onu-card">
              <h2>Acesso PPPoE (ONU)</h2>
              <div className="onu-campo">
                <span>Usuário</span>
                <div className="onu-campo-valor">
                  <strong>{onu.wancfg_pppoe_username}</strong>
                  <Link
                    to={`/conexao?username=${encodeURIComponent(onu.wancfg_pppoe_username)}`}
                    className="onu-btn-link"
                    aria-label="Ver conexão deste usuário"
                    viewTransition
                  >
                    <MdWifi size={16} />
                  </Link>
                  <button onClick={() => copiar(onu.wancfg_pppoe_username, 'Usuário')} aria-label="Copiar usuário">
                    <MdContentCopy size={16} />
                  </button>
                </div>
              </div>
              {onu.wancfg_pppoe_passwd && (
                <div className="onu-campo">
                  <span>Senha</span>
                  <div className="onu-campo-valor">
                    <strong>{mostrarSenha ? onu.wancfg_pppoe_passwd : '••••••••'}</strong>
                    <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                      {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                    </button>
                    <button onClick={() => copiar(onu.wancfg_pppoe_passwd, 'Senha')} aria-label="Copiar senha">
                      <MdContentCopy size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {onu.wificfg_name && (
            <div className="onu-card">
              <h2>Wi-Fi</h2>
              <div className="onu-campo">
                <span>Rede (SSID)</span>
                <div className="onu-campo-valor">
                  <strong>{onu.wificfg_name}</strong>
                  <button onClick={() => copiar(onu.wificfg_name, 'Nome da rede')} aria-label="Copiar nome da rede">
                    <MdContentCopy size={16} />
                  </button>
                </div>
              </div>
              {onu.wificfg_password && (
                <div className="onu-campo">
                  <span>Senha</span>
                  <div className="onu-campo-valor">
                    <strong>{mostrarSenha ? onu.wificfg_password : '••••••••'}</strong>
                    <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                      {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                    </button>
                    <button onClick={() => copiar(onu.wificfg_password, 'Senha da rede')} aria-label="Copiar senha da rede">
                      <MdContentCopy size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="onu-card">
            <div className="onu-linha">
              <span>Cliente</span>
              {onu.client_pk ? (
                <Link to={`/clientes/${onu.client_pk}`} className="onu-link" viewTransition>
                  <MdPeopleAlt size={14} /> {onu.client_name ?? '—'}
                </Link>
              ) : (
                <button
                  type="button"
                  className="onu-btn-registrar-cliente"
                  onClick={abrirRegistrarCliente}
                  disabled={atualizandoAntesDaAcao}
                >
                  <MdPersonAdd size={14} /> Registrar cliente
                </button>
              )}
            </div>
            {(onu.contract_number ?? onu.contract_pk) != null && (
              <div className="onu-linha">
                <span>Contrato</span>
                <strong>{onu.contract_number ?? onu.contract_pk}</strong>
              </div>
            )}
            <div className="onu-linha">
              <span>Nome</span>
              <div className="onu-campo-valor">
                <strong>{onu.name ?? '—'}</strong>
                <button type="button" onClick={abrirRenomear} disabled={atualizandoAntesDaAcao} aria-label="Renomear ONU">
                  <MdEdit size={16} />
                </button>
              </div>
            </div>
            <div className="onu-linha">
              <span>Serial</span>
              <strong>{onu.sn ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Modelo</span>
              <strong>{onu.model ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Fabricante</span>
              <strong>{onu.vendor ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Estado</span>
              <strong>{onu.state ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              {/* onu_distance vem em KM, não metros (confirmado: exemplo
                  "0.931" na doc oficial só faz sentido para alcance de
                  GPON como km — 0.931 m seria o cliente colado na OLT). */}
              <span>Distância</span>
              <strong>{onu.distance != null ? `${onu.distance} km` : '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Temperatura</span>
              <strong>{onu.omddm_temperature != null ? `${onu.omddm_temperature} °C` : '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>IP</span>
              <strong>{onu.cpe_v4_ip_last ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>OLT</span>
              <strong>{onu.olt_name ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Splitter (DP)</span>
              <strong>{onu.dp_name ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Porta da CTO</span>
              <strong>{onu.cpe_dp_port ?? '—'}</strong>
            </div>
          </div>

          {!atualizando && formatarTempoDesdeColeta(onu.info_timer) && (
            <p className="onu-ultima-coleta">Dados coletados {formatarTempoDesdeColeta(onu.info_timer)}</p>
          )}
          <button className="onu-btn-atualizar" onClick={atualizarAgora} disabled={atualizando}>
            <MdRefresh size={18} className={atualizando ? 'onu-girando' : ''} /> {atualizando ? 'Reconectando OLT… (~1 min)' : 'Atualizar agora'}
          </button>

          <div className="onu-acoes-onu">
            <button
              type="button"
              className="botao botao-secundario"
              style={{ '--botao-cor': CORES.onu } as CSSProperties}
              onClick={() => abrirAcao('reiniciar')}
              disabled={executandoAcao || atualizandoAntesDaAcao}
            >
              <MdPowerSettingsNew size={16} /> Reiniciar ONU
            </button>
            <button
              type="button"
              className="botao botao-perigo"
              onClick={() => abrirAcao('remover')}
              disabled={executandoAcao || atualizandoAntesDaAcao}
            >
              <MdDeleteForever size={16} /> Remover ONU
            </button>
          </div>
        </>
      )}

      {confirmandoAcao && (
        <div className="onu-modal-fundo" onClick={() => !executandoAcao && setConfirmandoAcao(null)}>
          <div className="onu-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{confirmandoAcao === 'reiniciar' ? 'Reiniciar esta ONU?' : 'Remover esta ONU?'}</h2>
            <p className="onu-modal-texto">
              {confirmandoAcao === 'reiniciar'
                ? 'O equipamento vai reiniciar agora — o cliente fica sem conexão por alguns instantes.'
                : 'A ONU sai do registro do painel — o cliente fica sem conexão até ela ser cadastrada de novo.'}
            </p>
            <div className="onu-modal-acoes">
              <button className="botao botao-secundario" onClick={() => setConfirmandoAcao(null)} disabled={executandoAcao}>
                Cancelar
              </button>
              <button
                className="botao botao-primario"
                style={{ '--botao-cor': confirmandoAcao === 'remover' ? CORES.erro : CORES.onu } as CSSProperties}
                disabled={executandoAcao}
                onClick={executarAcao}
              >
                {executandoAcao ? 'Aguarde…' : confirmandoAcao === 'reiniciar' ? 'Reiniciar' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renomeando && (
        <div className="onu-modal-fundo" onClick={() => !salvandoNome && setRenomeando(false)}>
          <div className="onu-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Renomear ONU</h2>
            <input
              type="text"
              className="onu-modal-input"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              maxLength={64}
              autoFocus
            />
            <div className="onu-modal-acoes">
              <button className="botao botao-secundario" onClick={() => setRenomeando(false)} disabled={salvandoNome}>
                Cancelar
              </button>
              <button
                className="botao botao-primario"
                style={{ '--botao-cor': CORES.onu } as CSSProperties}
                disabled={salvandoNome || !novoNome.trim()}
                onClick={confirmarRenomear}
              >
                {salvandoNome ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {registrandoCliente && onu && (
        <ModalRegistrarCliente
          onu={onu}
          onFechar={() => setRegistrandoCliente(false)}
          onAssociado={(clientPk, clientNome) => {
            setRegistrandoCliente(false)
            setOnu((atual) => (atual ? { ...atual, client_pk: clientPk, client_name: clientNome } : atual))
            toast('ONU associada ao cliente com sucesso.', 'sucesso')
          }}
        />
      )}

      {lendoCodigo && (
        // Fallback com estilo inline (não via classe) de propósito: a CSS
        // do próprio componente só chega junto com o chunk carregado tardio
        // (ver import lazy acima) — uma classe daria um frame sem estilo
        // nenhum antes disso.
        <Suspense fallback={<div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 200 }} />}>
          <LeitorCodigoBarras onDetectado={aoLerCodigo} onFechar={() => setLendoCodigo(false)} />
        </Suspense>
      )}
    </div>
  )
}

function ModalRegistrarCliente({
  onu,
  onFechar,
  onAssociado,
}: {
  onu: OnuDto
  onFechar: () => void
  onAssociado: (clientPk: number, clientNome: string | undefined) => void
}) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<BuscaClienteResultado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [selecionado, setSelecionado] = useState<BuscaClienteResultado | null>(null)
  // Depois de escolher o cliente, o técnico ainda escolhe qual PPPoE
  // vincular (pedido explícito — o cliente pode ter mais de uma conexão
  // cadastrada, e nunca deve ser presumido automaticamente qual delas).
  const [cpeEscolhida, setCpeEscolhida] = useState<CpeComboDto | null>(null)
  const [associando, setAssociando] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const nome = busca.trim()
    if (nome.length < 2) {
      setResultados([])
      return
    }
    let cancelado = false
    setBuscando(true)
    const temporizador = setTimeout(() => {
      buscarClientes({ nome })
        .then((resposta) => {
          if (!cancelado) setResultados(resposta.results)
        })
        .catch(() => {
          if (!cancelado) setResultados([])
        })
        .finally(() => {
          if (!cancelado) setBuscando(false)
        })
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [busca])

  async function confirmar() {
    // onu.pk (onu_pk) vem 0 pra ONU sem cliente vinculado — exatamente o
    // caso mais comum de usar este modal — válido aqui, não "faltando"
    // (confirmado ao vivo: uma ONU recém-instalada tem pk=0 até ser
    // associada a um cliente pela primeira vez).
    if (
      !selecionado ||
      !cpeEscolhida?.cpe_pk ||
      onu.pk == null ||
      !onu.sn ||
      onu.olt_pk == null ||
      onu.slot == null ||
      onu.pon == null ||
      onu.id == null
    ) {
      toast('Dados insuficientes para associar esta ONU.')
      return
    }
    setAssociando(true)
    try {
      await associarClienteOnu(onu.pk, {
        client_pk: selecionado.client_pk,
        cpe_pk: cpeEscolhida.cpe_pk,
        olt_pk: onu.olt_pk,
        slot_id: onu.slot,
        port_id: onu.pon,
        onu_id: onu.id,
        onu_serial: onu.sn,
        frame_id: onu.frame ?? 1,
        wancfg_conntype: onu.wancfg_conntype,
        wan_tpl_pk: onu.wan_tpl_pk,
        wancfg_vlanid: onu.wancfg_vlanid,
        wancfg_user_vlanid: onu.wancfg_user_vlanid,
        wancfg_cos: onu.wancfg_cos,
        wancfg_tcont: onu.wancfg_tcont,
        wancfg_gemport: onu.wancfg_gemport,
        wancfg_svlan: onu.wancfg_svlan,
        wancfg_stpid: onu.wancfg_stpid,
        wancfg_scos: onu.wancfg_scos,
        wancfg_pon_profile: onu.wancfg_pon_profile,
        wancfg_pppoe_svcname: onu.wancfg_pppoe_svcname,
        wancfg_local_ip: onu.wancfg_local_ip,
      })
      onAssociado(selecionado.client_pk, selecionado.cliente.client_complete_name)
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível associar esta ONU ao cliente.')
    } finally {
      setAssociando(false)
    }
  }

  return (
    <div className="onu-modal-fundo" onClick={onFechar}>
      <div className="onu-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Registrar cliente nesta ONU</h2>
        {!selecionado && (
          <>
            <p className="onu-modal-texto">
              Busque o cliente pelo nome. Depois de escolher, será possível selecionar qual conexão (PPPoE) dele
              vincular a esta ONU.
            </p>
            <input
              type="text"
              className="onu-modal-input"
              placeholder="Nome do cliente"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
            />
            <ul className="onu-modal-lista">
              {buscando && <li className="onu-combobox-vazio">Buscando…</li>}
              {!buscando && busca.trim().length >= 2 && resultados.length === 0 && (
                <li className="onu-combobox-vazio">Nenhum cliente encontrado.</li>
              )}
              {!buscando &&
                resultados.map((resultado) => (
                  <li key={resultado.client_pk}>
                    <button type="button" onClick={() => setSelecionado(resultado)}>
                      {resultado.cliente.client_complete_name ?? `Cliente #${resultado.client_pk}`}
                    </button>
                  </li>
                ))}
            </ul>
            <div className="onu-modal-acoes">
              <button className="botao botao-secundario" onClick={onFechar}>Cancelar</button>
            </div>
          </>
        )}

        {selecionado && !cpeEscolhida && (
          <>
            <p className="onu-modal-texto">
              Qual conexão (usuário PPPoE) de <strong>{selecionado.cliente.client_complete_name}</strong> deseja
              vincular a esta ONU?
            </p>
            {selecionado.cpes.length === 0 ? (
              <p className="onu-modal-texto">Este cliente não tem nenhuma conexão (CPE) cadastrada.</p>
            ) : (
              <ul className="onu-modal-lista">
                {selecionado.cpes.map((cpe) => (
                  <li key={cpe.cpe_pk}>
                    <button type="button" onClick={() => setCpeEscolhida(cpe)}>
                      <strong>{cpe.cpe_username ?? `CPE #${cpe.cpe_pk}`}</strong>
                      {cpe.contract_number != null && ` — Contrato ${cpe.contract_number}`}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="onu-modal-acoes">
              <button className="botao botao-secundario" onClick={() => setSelecionado(null)}>Voltar</button>
            </div>
          </>
        )}

        {selecionado && cpeEscolhida && (
          <>
            <p className="onu-modal-texto">
              Associar esta ONU a <strong>{selecionado.cliente.client_complete_name}</strong>, usando o PPPoE{' '}
              <strong>{cpeEscolhida.cpe_username}</strong>?
            </p>
            <div className="onu-modal-acoes">
              <button className="botao botao-secundario" onClick={() => setCpeEscolhida(null)} disabled={associando}>
                Voltar
              </button>
              <button
                className="botao botao-primario"
                style={{ '--botao-cor': CORES.onu } as CSSProperties}
                disabled={associando}
                onClick={confirmar}
              >
                {associando ? 'Associando…' : 'Associar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
