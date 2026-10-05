// Localização do técnico para sugerir a CTO mais próxima (CardCto.tsx).

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

export function obterMelhorLocalizacao(): Promise<GeolocationPosition> {
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
