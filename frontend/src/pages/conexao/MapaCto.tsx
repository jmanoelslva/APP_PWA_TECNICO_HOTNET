import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MdOpenInFull, MdCloseFullscreen, MdOpenInNew } from 'react-icons/md'
import { ApiError, buscarProjetoRede, type DpDto, type ItemProjetoDto } from '../../api/client'
import { distanciaMetros } from './localizacao'

export interface Ponto {
  lat: number
  lng: number
}

// Mesmas imagens do "Mapa - Informações" do painel do Controllr (Leaflet +
// satélite com ruas do Google, sem chave) — o técnico vê o mesmo mapa nos
// dois lugares.
const URL_SATELITE = 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}'
// Cor das CTOs sem dp_color e dos itens do projeto sem estilo no KMZ.
const COR_PADRAO_CTO = '#555555'
const COR_PADRAO_PROJETO = '#ffcc00'
// Raio pedido ao backend em volta do centro; só busca de novo quando o
// centro anda mais da metade disso.
const RAIO_PROJETO_M = 1500

// Leaflet põe tooltip de texto via innerHTML — nome vindo do Controllr ou
// do KMZ vai como texto puro, nunca como HTML.
function texto(conteudo: string): HTMLElement {
  const span = document.createElement('span')
  span.textContent = conteudo
  return span
}

function ocupacao(dp: DpDto): string {
  if (dp.ativos == null) return ''
  return dp.limite ? ` — ${dp.ativos}/${dp.limite}` : ` — ${dp.ativos} ativo(s)`
}

/**
 * Miniatura do mapa no bloco CTO: CTOs do Controllr (cor e ocupação do
 * próprio cadastro), a CTO escolhida em destaque, a localização do técnico,
 * o endereço do cliente e, quando o servidor tem o KMZ do projeto, os cabos
 * e caixas do projeto por baixo. Tocar numa CTO só a escolhe no campo —
 * gravar continua sendo no botão "Salvar CTO".
 */
export default function MapaCto({
  centro,
  dps,
  selecionadaPk,
  minhaLocalizacao,
  cliente,
  onSelecionar,
}: {
  centro: Ponto
  dps: DpDto[]
  selecionadaPk: number | null
  minhaLocalizacao: Ponto | null
  cliente: Ponto | null
  onSelecionar: (dp: DpDto) => void
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<L.Map | null>(null)
  const camadasRef = useRef<{ projeto: L.LayerGroup; ctos: L.LayerGroup; posicoes: L.LayerGroup } | null>(null)
  const onSelecionarRef = useRef(onSelecionar)
  const ultimoCentroProjetoRef = useRef<Ponto | null>(null)
  const [ampliado, setAmpliado] = useState(false)
  const [avisoProjeto, setAvisoProjeto] = useState<string | null>(null)

  useEffect(() => {
    onSelecionarRef.current = onSelecionar
  }, [onSelecionar])

  useEffect(() => {
    if (!divRef.current) return
    const mapa = L.map(divRef.current, { zoomControl: true, attributionControl: true })
    L.tileLayer(URL_SATELITE, {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxNativeZoom: 20,
      maxZoom: 21,
      attribution: 'Imagens © Google',
    }).addTo(mapa)
    // Projeto numa camada abaixo das CTOs (cada uma com o próprio canvas),
    // senão um cabo redesenhado depois cobre as CTOs e rouba o toque.
    mapa.createPane('projeto').style.zIndex = '390'
    mapa.createPane('ctos').style.zIndex = '410'
    camadasRef.current = {
      projeto: L.layerGroup().addTo(mapa),
      ctos: L.layerGroup().addTo(mapa),
      posicoes: L.layerGroup().addTo(mapa),
    }
    mapaRef.current = mapa
    return () => {
      mapa.remove()
      mapaRef.current = null
      camadasRef.current = null
      ultimoCentroProjetoRef.current = null
    }
  }, [])

  useEffect(() => {
    mapaRef.current?.setView([centro.lat, centro.lng], 18)
  }, [centro.lat, centro.lng])

  useEffect(() => {
    mapaRef.current?.invalidateSize()
  }, [ampliado])

  // CTOs do Controllr
  useEffect(() => {
    const camadas = camadasRef.current
    if (!camadas) return
    camadas.ctos.clearLayers()
    const renderer = L.canvas({ pane: 'ctos' })
    let selecionada: L.CircleMarker | null = null
    for (const dp of dps) {
      if (dp.lat == null || dp.lng == null) continue
      const eSelecionada = dp.pk === selecionadaPk
      const marcador = L.circleMarker([dp.lat, dp.lng], {
        renderer,
        radius: eSelecionada ? 10 : 7,
        color: eSelecionada ? '#ffffff' : '#000000',
        weight: eSelecionada ? 3 : 1,
        fillColor: dp.cor || COR_PADRAO_CTO,
        fillOpacity: 0.95,
      })
      marcador.bindTooltip(texto(`${dp.name}${ocupacao(dp)}`), {
        permanent: eSelecionada,
        direction: 'top',
        offset: [0, -8],
      })
      marcador.on('click', () => onSelecionarRef.current(dp))
      marcador.addTo(camadas.ctos)
      if (eSelecionada) selecionada = marcador
    }
    selecionada?.bringToFront()
  }, [dps, selecionadaPk])

  // Técnico e endereço do cliente
  useEffect(() => {
    const camadas = camadasRef.current
    if (!camadas) return
    camadas.posicoes.clearLayers()
    if (cliente) {
      L.circleMarker([cliente.lat, cliente.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#2e9e44',
        fillOpacity: 1,
      })
        .bindTooltip('Endereço do cliente', { direction: 'top', offset: [0, -8] })
        .addTo(camadas.posicoes)
    }
    if (minhaLocalizacao) {
      L.circleMarker([minhaLocalizacao.lat, minhaLocalizacao.lng], {
        radius: 7,
        color: '#ffffff',
        weight: 2,
        fillColor: '#1a73e8',
        fillOpacity: 1,
      })
        .bindTooltip('Você', { direction: 'top', offset: [0, -8] })
        .addTo(camadas.posicoes)
    }
  }, [cliente, minhaLocalizacao])

  // Projeto da rede (KMZ no servidor). Só a busca mais recente desenha —
  // não cancela no cleanup, senão um centro que andou pouco (e por isso
  // não busca de novo) descartaria a resposta que ainda estava a caminho.
  const buscaProjetoRef = useRef(0)
  useEffect(() => {
    const anterior = ultimoCentroProjetoRef.current
    if (anterior && distanciaMetros(anterior.lat, anterior.lng, centro.lat, centro.lng) < RAIO_PROJETO_M / 2) return
    ultimoCentroProjetoRef.current = { lat: centro.lat, lng: centro.lng }
    const busca = ++buscaProjetoRef.current
    buscarProjetoRede(centro.lat, centro.lng, RAIO_PROJETO_M)
      .then((resposta) => {
        if (busca !== buscaProjetoRef.current || !camadasRef.current) return
        setAvisoProjeto(null)
        desenharProjeto(camadasRef.current.projeto, resposta.results)
      })
      .catch((erro) => {
        if (busca !== buscaProjetoRef.current) return
        ultimoCentroProjetoRef.current = null
        // 404 = servidor sem KMZ: o mapa segue só com as CTOs, sem aviso.
        setAvisoProjeto(erro instanceof ApiError && erro.status === 404 ? null : 'Projeto da rede indisponível.')
      })
  }, [centro.lat, centro.lng])

  const linkGoogleMaps = `https://www.google.com/maps/search/?api=1&query=${centro.lat},${centro.lng}`

  return (
    <div className="mapa-cto">
      <div ref={divRef} className={`mapa-cto-mapa${ampliado ? ' mapa-cto-mapa-ampliado' : ''}`} />
      <div className="mapa-cto-rodape">
        <span className="mapa-cto-legenda">
          <i style={{ background: '#1a73e8' }} /> Você <i style={{ background: '#2e9e44' }} /> Cliente
        </span>
        <button type="button" onClick={() => setAmpliado((valor) => !valor)}>
          {ampliado ? <MdCloseFullscreen size={14} /> : <MdOpenInFull size={14} />} {ampliado ? 'Reduzir' : 'Ampliar'}
        </button>
        <a href={linkGoogleMaps} target="_blank" rel="noopener noreferrer">
          <MdOpenInNew size={14} /> Google Maps
        </a>
      </div>
      {avisoProjeto && <span className="mapa-cto-aviso">{avisoProjeto}</span>}
    </div>
  )
}

function desenharProjeto(camada: L.LayerGroup, itens: ItemProjetoDto[]) {
  camada.clearLayers()
  const renderer = L.canvas({ pane: 'projeto' })
  for (const item of itens) {
    const cor = item.cor || COR_PADRAO_PROJETO
    const rotulo = item.pasta ? `${item.nome} (${item.pasta})` : item.nome
    let forma: L.Path
    if (item.tipo === 'linha') {
      forma = L.polyline(item.coords, { renderer, pane: 'projeto', color: cor, weight: 3, opacity: 0.9 })
    } else if (item.tipo === 'poligono') {
      forma = L.polygon(item.coords, { renderer, pane: 'projeto', color: cor, weight: 1, fillOpacity: 0.15 })
    } else {
      forma = L.circleMarker(item.coords[0], {
        renderer,
        pane: 'projeto',
        radius: 4,
        color: '#000000',
        weight: 1,
        fillColor: cor,
        fillOpacity: 0.9,
      })
    }
    if (rotulo) forma.bindTooltip(texto(rotulo), { sticky: item.tipo !== 'ponto' })
    forma.addTo(camada)
  }
}
