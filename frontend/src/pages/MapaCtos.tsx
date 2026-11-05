import { lazy, Suspense, useEffect, useState } from 'react'
import { LuMap } from 'react-icons/lu'
import { ApiError, listarDps, type DpDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Spinner from '../components/Spinner'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import { distanciaMetros, formatarDistancia, useLocalizacaoAoVivo } from './conexao/localizacao'
import './Conexao.css'
import './MapaCtos.css'

// Leaflet só é baixado quando a tela abre.
const MapaCto = lazy(() => import('./conexao/MapaCto'))

const QTD_MAIS_PROXIMAS = 5

/**
 * Mapa com as CTOs do Controllr e a posição do técnico ao vivo, sem
 * precisar abrir uma conexão — para ver a CTO mais próxima do cliente
 * antes do atendimento. Só consulta: escolher a CTO de um cliente continua
 * no bloco CTO da Conexão.
 */
export default function MapaCtos() {
  const { toast } = useToast()
  const [dps, setDps] = useState<DpDto[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionadaPk, setSelecionadaPk] = useState<number | null>(null)
  const aoVivo = useLocalizacaoAoVivo()
  // Primeira leitura do GPS, fixa: centraliza uma vez só, sem puxar o mapa
  // de volta a cada atualização.
  const [primeiraPosicao, setPrimeiraPosicao] = useState<{ lat: number; lng: number } | null>(null)
  if (aoVivo && !primeiraPosicao) setPrimeiraPosicao({ lat: aoVivo.lat, lng: aoVivo.lng })

  useEffect(() => {
    listarDps()
      .then((resposta) => setDps(resposta.results))
      .catch((excecao) => setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar as CTOs.'))
  }, [])

  const comCoordenada = (dps ?? []).filter(
    (dp): dp is DpDto & { lat: number; lng: number } => dp.lat != null && dp.lng != null,
  )
  const selecionada = comCoordenada.find((dp) => dp.pk === selecionadaPk) ?? null
  const maisProximas = aoVivo
    ? comCoordenada
        .map((dp) => ({ dp, distanciaM: distanciaMetros(aoVivo.lat, aoVivo.lng, dp.lat, dp.lng) }))
        .sort((a, b) => a.distanciaM - b.distanciaM)
        .slice(0, QTD_MAIS_PROXIMAS)
    : []
  // Centro: a CTO tocada; senão, o técnico; sem GPS, a primeira CTO.
  const centro = selecionada
    ? { lat: selecionada.lat, lng: selecionada.lng }
    : (primeiraPosicao ?? (comCoordenada[0] ? { lat: comCoordenada[0].lat, lng: comCoordenada[0].lng } : null))

  return (
    <div className="mapa-ctos-tela tela-entrada">
      <CabecalhoTela icone={LuMap} cor={CORES.conexao} titulo="Mapa de CTOs" subtitulo="CTOs perto de você." />

      {erro && <p className="mapa-ctos-aviso">{erro}</p>}
      {!erro && !dps && <Spinner />}
      {dps && !centro && <p className="mapa-ctos-aviso">Nenhuma CTO cadastrada tem coordenada.</p>}

      {dps && centro && (
        <Suspense fallback={<Spinner />}>
          <MapaCto
            centro={centro}
            dps={comCoordenada}
            selecionadaPk={selecionadaPk}
            minhaLocalizacao={aoVivo}
            precisaoM={aoVivo?.precisaoM ?? null}
            cliente={null}
            onSelecionar={(dp) => setSelecionadaPk(dp.pk)}
            onSemLocalizacao={() => toast('Aguardando a localização do GPS. Verifique se a permissão está liberada.')}
          />
        </Suspense>
      )}

      {dps && (
        <section className="mapa-ctos-proximas">
          <h2>Mais próximas</h2>
          {!aoVivo && <p className="mapa-ctos-aviso">Aguardando sua localização…</p>}
          {aoVivo && (
            <p className="mapa-ctos-precisao">Precisão do GPS: ±{Math.round(aoVivo.precisaoM)} m</p>
          )}
          <ul>
            {maisProximas.map(({ dp, distanciaM }) => (
              <li key={dp.pk}>
                <button
                  type="button"
                  className={dp.pk === selecionadaPk ? 'mapa-ctos-item ativo' : 'mapa-ctos-item'}
                  onClick={() => setSelecionadaPk(dp.pk)}
                >
                  <i style={{ background: dp.cor || '#555555' }} aria-hidden="true" />
                  <span className="mapa-ctos-nome">
                    <strong>{dp.name}</strong>
                    {dp.ativos != null && (
                      <span>{dp.limite ? `${dp.ativos}/${dp.limite} portas` : `${dp.ativos} ativo(s)`}</span>
                    )}
                  </span>
                  <span className="mapa-ctos-distancia">{formatarDistancia(distanciaM)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
