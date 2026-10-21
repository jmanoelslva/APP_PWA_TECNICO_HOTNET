import { lazy, Suspense, useState, type CSSProperties } from 'react'
import { MdMyLocation, MdSave } from 'react-icons/md'
import { ApiError, atualizarDetalhesCpe, type CpeDto, type DpDto } from '../../api/client'
import { useToast } from '../../components/Toast/useToast'
import { CORES } from '../../utils/cores'
import {
  distanciaMetros,
  formatarDistancia,
  MARGEM_COORDENADA_CTO_M,
  obterMelhorLocalizacao,
  PRECISAO_MAXIMA_ACEITAVEL_M,
  useLocalizacaoAoVivo,
} from './localizacao'

// Leaflet só é baixado quando o bloco CTO aparece.
const MapaCto = lazy(() => import('./MapaCto'))

function coordenadaTexto(lat?: string, lng?: string): { lat: number; lng: number } | null {
  const la = Number(lat)
  const ln = Number(lng)
  return lat && lng && Number.isFinite(la) && Number.isFinite(ln) && (la || ln) ? { lat: la, lng: ln } : null
}

/**
 * dp_pk e cpe_dp_port (CTO/porta da CTO), doc oficial de /aaa_ctl/cpe/update.
 * A lista de CTOs vem do próprio sistema (GET /dp/lista), para selecionar em
 * vez de digitar um pk cru.
 */
export default function CardCto({
  cpe,
  dps,
  onAtualizado,
}: {
  cpe: CpeDto
  dps: DpDto[]
  onAtualizado: (parcial: Partial<CpeDto>) => void
}) {
  const { toast } = useToast()
  // dpBusca é o texto digitado no combobox (filtra a lista enquanto
  // digita); dpPk só muda quando o técnico clica numa CTO da lista filtrada.
  const [dpPk, setDpPk] = useState(cpe.dp_pk != null ? String(cpe.dp_pk) : '')
  const [dpBusca, setDpBusca] = useState(cpe.dp_name ?? '')
  const [dpListaAberta, setDpListaAberta] = useState(false)
  const [dpPorta, setDpPorta] = useState(cpe.dp_port != null ? String(cpe.dp_port) : '')
  const [salvando, setSalvando] = useState(false)
  // Localização do técnico (botão "Usar minha localização") — usada só
  // para sugerir/ordenar a CTO mais próxima por distância, nunca para
  // selecionar sozinha sem confirmação em caso de dúvida (ver critério em
  // usarLocalizacaoAtual). precisaoLocalizacaoM é o accuracy (em metros)
  // relatado pelo GPS na leitura usada — mostrado ao técnico para ele
  // avaliar a confiança da sugestão.
  const [minhaLocalizacao, setMinhaLocalizacao] = useState<{ lat: number; lng: number } | null>(null)
  const [precisaoLocalizacaoM, setPrecisaoLocalizacaoM] = useState<number | null>(null)
  const [localizando, setLocalizando] = useState(false)
  // GPS acompanhando o técnico desde que o bloco aparece: o "Você" do mapa
  // e as distâncias da lista se atualizam sozinhos. A sugestão automática
  // de CTO continua só no botão (leitura mais precisa, com confirmação).
  const aoVivo = useLocalizacaoAoVivo()
  const posicaoTecnico = aoVivo ?? minhaLocalizacao
  const precisaoTecnicoM = aoVivo?.precisaoM ?? precisaoLocalizacaoM
  // Primeira leitura ao vivo, fixa: centraliza o mapa uma vez só, em vez de
  // puxar a tela de volta a cada atualização do GPS.
  const [primeiraPosicao, setPrimeiraPosicao] = useState<{ lat: number; lng: number } | null>(null)
  if (aoVivo && !primeiraPosicao) setPrimeiraPosicao({ lat: aoVivo.lat, lng: aoVivo.lng })

  // Centro do mapa: a CTO escolhida; sem coordenada nela, o técnico; senão,
  // o endereço do cliente.
  const dpSelecionada = dps.find((dp) => String(dp.pk) === dpPk) ?? null
  const cliente = coordenadaTexto(cpe.address_latitude, cpe.address_longitude)
  const centroMapa =
    dpSelecionada?.lat != null && dpSelecionada.lng != null
      ? { lat: dpSelecionada.lat, lng: dpSelecionada.lng }
      : (minhaLocalizacao ?? cliente ?? primeiraPosicao)

  const dpsFiltradas = (
    dpBusca.trim() ? dps.filter((dp) => dp.name.toLowerCase().includes(dpBusca.trim().toLowerCase())) : dps
  )
    .map((dp) => ({
      ...dp,
      distanciaM:
        posicaoTecnico && dp.lat != null && dp.lng != null
          ? distanciaMetros(posicaoTecnico.lat, posicaoTecnico.lng, dp.lat, dp.lng)
          : null,
    }))
    .sort((a, b) => {
      if (a.distanciaM == null && b.distanciaM == null) return 0
      if (a.distanciaM == null) return 1
      if (b.distanciaM == null) return -1
      return a.distanciaM - b.distanciaM
    })

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

  async function salvar() {
    if (!cpe.pk) return
    setSalvando(true)
    try {
      const novoDpPk = dpPk.trim() ? Number(dpPk.trim()) : undefined
      const novaPorta = dpPorta.trim() ? Number(dpPorta.trim()) : undefined
      await atualizarDetalhesCpe(cpe.pk, { dp_pk: novoDpPk, cpe_dp_port: novaPorta })
      const dpEscolhida = dps.find((dp) => String(dp.pk) === dpPk.trim())
      onAtualizado({ dp_pk: novoDpPk, dp_port: novaPorta, dp_name: dpEscolhida?.name ?? cpe.dp_name })
      toast('CTO atualizada.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar a CTO.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="conexao-card">
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
        {posicaoTecnico && precisaoTecnicoM != null && (
          <span className="conexao-combobox-precisao">
            Sua localização: precisão de ±{Math.round(precisaoTecnicoM)} m
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
                  {dp.ativos != null && dp.limite != null && (
                    <span className="conexao-combobox-distancia">
                      {' '}
                      ({dp.ativos}/{dp.limite})
                    </span>
                  )}
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
      {centroMapa ? (
        <Suspense fallback={<div className="mapa-cto-mapa mapa-cto-carregando" />}>
          <MapaCto
            centro={centroMapa}
            dps={dps}
            selecionadaPk={dpSelecionada?.pk ?? null}
            minhaLocalizacao={posicaoTecnico}
            precisaoM={precisaoTecnicoM}
            cliente={cliente}
            onSelecionar={(dp) => {
              setDpPk(String(dp.pk))
              setDpBusca(dp.name)
              setDpListaAberta(false)
            }}
            onSemLocalizacao={usarLocalizacaoAtual}
          />
        </Suspense>
      ) : (
        <p className="conexao-sessao-vazio">
          Sem mapa: a CTO não tem coordenada e sua localização ainda não chegou. Toque em{' '}
          <MdMyLocation size={12} /> para usar sua localização.
        </p>
      )}
      <button
        className="botao botao-secundario botao-pequeno"
        style={{ '--botao-cor': CORES.conexao } as CSSProperties}
        onClick={salvar}
        disabled={salvando}
      >
        <MdSave size={14} /> {salvando ? 'Salvando…' : 'Salvar CTO'}
      </button>
    </div>
  )
}
