// Localização do técnico para sugerir a CTO mais próxima (CardCto.tsx).

import { useEffect, useRef, useState } from 'react'

export interface PosicaoAoVivo {
  lat: number
  lng: number
  precisaoM: number
}

/**
 * Posição do técnico em tempo real enquanto o componente está na tela —
 * o "Você" do mapa anda junto com ele, sem precisar tocar no botão de
 * localizar. Permissão negada ou GPS indisponível: fica null, em silêncio
 * (o botão de localizar continua mostrando o motivo).
 */
export function useLocalizacaoAoVivo(): PosicaoAoVivo | null {
  const [posicao, setPosicao] = useState<PosicaoAoVivo | null>(null)
  const ultimaRef = useRef<PosicaoAoVivo | null>(null)
  useEffect(() => {
    if (!navigator.geolocation) return
    const watchId = navigator.geolocation.watchPosition(
      (leitura) => {
        const nova = {
          lat: leitura.coords.latitude,
          lng: leitura.coords.longitude,
          precisaoM: leitura.coords.accuracy,
        }
        // Parado, o GPS manda leituras quase iguais a cada segundo; cada uma
        // re-renderizava a tela e o mapa à toa. Só atualiza quando muda de fato.
        if (!mudouOSuficiente(ultimaRef.current, nova)) return
        ultimaRef.current = nova
        setPosicao(nova)
      },
      () => {},
      // maximumAge 0: sempre leitura nova do GPS, nunca uma guardada.
      { enableHighAccuracy: true, maximumAge: 0 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [])
  return posicao
}

// Limiares da atualização ao vivo. Precisão vem primeiro: qualquer leitura
// mais precisa (1 m ou mais) é mostrada na hora; movimento de 3 m também.
// Só o tremor do GPS parado (leituras quase iguais, sem ganho de precisão)
// é ignorado. Piora da precisão aparece a partir de 5 m, para o círculo
// não mentir quando o sinal cai.
export const MOVIMENTO_MINIMO_M = 3
export const MELHORA_PRECISAO_MINIMA_M = 1
export const PIORA_PRECISAO_MINIMA_M = 5

export function mudouOSuficiente(anterior: PosicaoAoVivo | null, nova: PosicaoAoVivo): boolean {
  if (!anterior) return true
  const ganho = anterior.precisaoM - nova.precisaoM
  return (
    ganho >= MELHORA_PRECISAO_MINIMA_M ||
    -ganho >= PIORA_PRECISAO_MINIMA_M ||
    distanciaMetros(anterior.lat, anterior.lng, nova.lat, nova.lng) >= MOVIMENTO_MINIMO_M
  )
}

// Fórmula de Haversine — distância em linha reta (metros) entre a
// localização do técnico e a coordenada cadastrada da CTO. Suficiente
// para sugerir/ordenar por proximidade; não precisa de rota real.
export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const raioTerraM = 6371000
  const paraRad = (graus: number) => (graus * Math.PI) / 180
  const dLat = paraRad(lat2 - lat1)
  const dLng = paraRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(paraRad(lat1)) * Math.cos(paraRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * raioTerraM * Math.asin(Math.sqrt(a))
}

export function formatarDistancia(metros: number): string {
  if (metros < 1000) return `${Math.round(metros)} m`
  return `${(metros / 1000).toFixed(1)} km`
}

// GPS urbano varia de ~5m (céu aberto) a 30m+ perto de muro/poste metálico
// — um limiar fixo de metros ignora essa variação: auto-seleciona errado
// quando o GPS está ruim e força confirmação manual à toa quando está
// ótimo. Os limiares abaixo usam a própria precisão (accuracy, em metros)
// relatada pelo GPS a cada leitura em vez de um número fixo.
export const PRECISAO_MAXIMA_ACEITAVEL_M = 30
export const MARGEM_COORDENADA_CTO_M = 5
// Uma única leitura pode pegar o GPS no pior instante — amostra por
// alguns segundos via watchPosition e fica com a leitura de menor
// accuracy da janela, em vez da primeira que chegar. Em área urbana o
// primeiro fix do GPS (com enableHighAccuracy, ou seja, rádio GPS em
// vez de posição por rede) costuma levar bem mais que alguns segundos
// — a janela precisa ser generosa o bastante pra isso, senão o técnico
// só vê "não foi possível obter localização" e precisa tentar de novo.
const JANELA_AMOSTRAGEM_LOCALIZACAO_MS = 10000

// Abaixo disso o GPS do celular quase não melhora: esperar o resto da janela
// só atrasa o técnico.
export const PRECISAO_SUFICIENTE_M = 5

export interface OpcoesMelhorLocalizacao {
  // Encerra antes da janela quando a melhor leitura chega a esta precisão.
  pararComPrecisaoM?: number
  // Chamado a cada leitura que melhora a precisão (para exibir ao vivo).
  aoMelhorar?: (posicao: GeolocationPosition) => void
}

export function obterMelhorLocalizacao(opcoes: OpcoesMelhorLocalizacao = {}): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let melhor: GeolocationPosition | null = null
    let ultimoErro: GeolocationPositionError | null = null
    let encerrado = false
    let temporizador: ReturnType<typeof setTimeout> | undefined

    function encerrar() {
      if (encerrado) return
      encerrado = true
      clearTimeout(temporizador)
      navigator.geolocation.clearWatch(watchId)
      if (melhor) resolve(melhor)
      else reject(ultimoErro ?? new Error('Não foi possível obter a localização.'))
    }

    // Sem "timeout" aqui (fica Infinity por padrão): quem decide quando
    // parar de esperar é só o setTimeout externo abaixo — evita que o
    // watchPosition erre por timeout individual bem no instante em que a
    // janela ia fechar de qualquer forma, perdendo uma leitura que
    // chegaria logo em seguida.
    const watchId = navigator.geolocation.watchPosition(
      (posicao) => {
        if (encerrado) return
        if (!melhor || posicao.coords.accuracy < melhor.coords.accuracy) {
          melhor = posicao
          opcoes.aoMelhorar?.(posicao)
          if (opcoes.pararComPrecisaoM !== undefined && posicao.coords.accuracy <= opcoes.pararComPrecisaoM) encerrar()
        }
      },
      (erro) => {
        ultimoErro = erro
      },
      { enableHighAccuracy: true, maximumAge: 0 },
    )

    temporizador = setTimeout(encerrar, JANELA_AMOSTRAGEM_LOCALIZACAO_MS)
  })
}
