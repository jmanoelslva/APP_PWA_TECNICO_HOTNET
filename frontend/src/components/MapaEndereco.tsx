import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Mesmas imagens de satélite do mapa do bloco CTO (conexao/MapaCto.tsx).
const URL_SATELITE = 'https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}'
const COR_PONTO = '#c94300'

/**
 * Miniatura do ponto do endereço na edição de endereço: o técnico confere
 * no satélite se a coordenada caiu na casa certa antes de salvar. O
 * círculo mostra a precisão da captura feita agora (sem círculo quando a
 * coordenada veio do cadastro).
 */
export default function MapaEndereco({ lat, lng, precisaoM }: { lat: number; lng: number; precisaoM: number | null }) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapaRef = useRef<L.Map | null>(null)
  const pontoRef = useRef<L.CircleMarker | null>(null)
  const circuloRef = useRef<L.Circle | null>(null)

  useEffect(() => {
    if (!divRef.current) return
    const mapa = L.map(divRef.current, { zoomControl: false, attributionControl: true })
    L.tileLayer(URL_SATELITE, {
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      maxNativeZoom: 20,
      maxZoom: 21,
      attribution: 'Imagens © Google',
    }).addTo(mapa)
    mapaRef.current = mapa
    return () => {
      mapa.remove()
      mapaRef.current = null
      pontoRef.current = null
      circuloRef.current = null
    }
  }, [])

  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa) return
    const posicao = L.latLng(lat, lng)

    if (precisaoM !== null) {
      if (circuloRef.current) circuloRef.current.setLatLng(posicao).setRadius(precisaoM)
      else
        circuloRef.current = L.circle(posicao, {
          radius: precisaoM,
          color: COR_PONTO,
          weight: 1,
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(mapa)
    } else if (circuloRef.current) {
      circuloRef.current.remove()
      circuloRef.current = null
    }

    if (pontoRef.current) pontoRef.current.setLatLng(posicao)
    else
      pontoRef.current = L.circleMarker(posicao, {
        radius: 8,
        color: '#ffffff',
        weight: 3,
        fillColor: COR_PONTO,
        fillOpacity: 1,
        interactive: false,
      }).addTo(mapa)

    mapa.setView(posicao, 19)
  }, [lat, lng, precisaoM])

  return <div ref={divRef} className="mapa-endereco" role="img" aria-label="Posição do endereço no mapa" />
}
