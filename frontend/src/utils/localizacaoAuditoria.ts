// Localização do técnico enviada junto com as ações (cabeçalho
// X-Localizacao), para a auditoria. Nunca segura a ação: vai a última
// leitura guardada; se estiver velha, pede outra em segundo plano para a
// próxima ação. Só lê o GPS com a permissão já concedida — não abre o
// pedido de permissão por conta própria. O servidor grava só nas ações de
// campo (OS, conexão, ONU, endereço).

export interface LeituraLocal {
  lat: number
  lng: number
  precisao: number
  em: number // Date.now() da leitura
}

const IDADE_RENOVAR_MS = 2 * 60 * 1000
// Leitura mais velha que isso não vai: o técnico já pode estar longe.
const IDADE_MAXIMA_ENVIO_MS = 30 * 60 * 1000

let ultima: LeituraLocal | null = null
let lendo = false
let permitido = false

/** Guarda uma leitura (também usada pelas telas que já leem o GPS). */
export function registrarLeituraLocal(pos: GeolocationPosition): void {
  const nova: LeituraLocal = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    precisao: pos.coords.accuracy,
    em: pos.timestamp || Date.now(),
  }
  // Mais recente vence; no mesmo minuto, a mais precisa.
  if (!ultima || nova.em - ultima.em > 60_000 || nova.precisao <= ultima.precisao) ultima = nova
  permitido = true
}

function renovar(): void {
  if (lendo || !permitido || typeof navigator === 'undefined' || !navigator.geolocation) return
  lendo = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      lendo = false
      registrarLeituraLocal(pos)
    },
    () => {
      lendo = false
    },
    { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 },
  )
}

/** Valor do cabeçalho: "lat;lng;precisão_m;idade_s", ou null. */
export function cabecalhoLocalizacao(agora = Date.now(), leitura = ultima): string | null {
  if (leitura === ultima && (!ultima || agora - ultima.em > IDADE_RENOVAR_MS)) renovar()
  if (!leitura) return null
  const idade = Math.max(0, agora - leitura.em)
  if (idade > IDADE_MAXIMA_ENVIO_MS) return null
  return `${leitura.lat.toFixed(6)};${leitura.lng.toFixed(6)};${Math.round(leitura.precisao)};${Math.round(idade / 1000)}`
}

/** Na abertura: lê o GPS só se a permissão já foi dada; renova ao voltar ao app. */
export function iniciarLocalizacaoAuditoria(): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions?.query) return
  navigator.permissions
    .query({ name: 'geolocation' })
    .then((estado) => {
      const aplicar = () => {
        permitido = estado.state === 'granted'
        if (permitido) renovar()
      }
      aplicar()
      estado.onchange = aplicar
    })
    .catch(() => {})
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && (!ultima || Date.now() - ultima.em > IDADE_RENOVAR_MS)) renovar()
  })
}

export type EstadoLocalizacao = 'permitida' | 'negada' | 'perguntar' | 'sem-suporte'

/** Estado da permissão de localização (Configurações). */
export async function estadoLocalizacao(): Promise<EstadoLocalizacao> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'sem-suporte'
  if (!navigator.permissions?.query) return permitido ? 'permitida' : 'perguntar'
  try {
    const estado = await navigator.permissions.query({ name: 'geolocation' })
    return estado.state === 'granted' ? 'permitida' : estado.state === 'denied' ? 'negada' : 'perguntar'
  } catch {
    return 'perguntar'
  }
}

/** Abre o pedido de permissão do navegador (só por toque do técnico). */
export function pedirLocalizacao(): Promise<EstadoLocalizacao> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve('sem-suporte')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        registrarLeituraLocal(pos)
        resolve('permitida')
      },
      (erro) => resolve(erro.code === erro.PERMISSION_DENIED ? 'negada' : 'permitida'),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 20_000 },
    )
  })
}
