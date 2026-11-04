/**
 * Selo único de status do cliente (topo das telas do cliente) e o "há X
 * min" das leituras feitas pelo app.
 */

export type StatusCliente = 'verificando' | 'online' | 'offline' | 'bloqueado' | 'sem-cpe'

// contract_status 4 = Bloqueado (ver ROTULOS_STATUS_CONTRATO em formatacao.ts).
const CONTRATO_BLOQUEADO = 4

/**
 * Bloqueado vem primeiro (cliente bloqueado ainda pode autenticar e cair
 * na página de aviso); depois online se qualquer conexão tiver sessão.
 * `sessoes`: uma entrada por CPE — true/false quando já consultou, null
 * enquanto consulta ou se a consulta falhou.
 */
export function statusDoCliente(entrada: {
  contratos: Array<{ contract_status?: number | string | null }>
  sessoes: Array<boolean | null>
  carregando?: boolean
}): StatusCliente {
  if (entrada.contratos.some((c) => Number(c.contract_status) === CONTRATO_BLOQUEADO)) return 'bloqueado'
  if (entrada.sessoes.length === 0) return entrada.carregando ? 'verificando' : 'sem-cpe'
  if (entrada.sessoes.some((s) => s === true)) return 'online'
  if (entrada.sessoes.every((s) => s === false)) return 'offline'
  return 'verificando'
}

export const TEXTO_STATUS_CLIENTE: Record<StatusCliente, string> = {
  verificando: 'Verificando…',
  online: 'Online',
  offline: 'Offline',
  bloqueado: 'Bloqueado',
  'sem-cpe': 'Sem conexão',
}

/** "agora", "há 40s", "há 2 min", "há 1 h" — tempo desde uma leitura feita pelo app. */
export function tempoDesde(momento: number, agora: number = Date.now()): string {
  const segundos = Math.max(0, Math.floor((agora - momento) / 1000))
  if (segundos < 10) return 'agora'
  if (segundos < 60) return `há ${segundos}s`
  const minutos = Math.floor(segundos / 60)
  if (minutos < 60) return `há ${minutos} min`
  return `há ${Math.floor(minutos / 60)} h`
}
