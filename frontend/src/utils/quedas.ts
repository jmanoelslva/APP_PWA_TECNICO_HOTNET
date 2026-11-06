import type { SessaoHistoricoDto } from '../api/client'

/** Acct-Terminate-Cause 2 = Lost Carrier: a ONU/roteador perdeu o link (fibra, energia). */
const PERDA_DE_LINK = 2

export const DIAS_QUEDAS = 7

export interface ResumoQuedas {
  total: number
  perdaDeLink: number
  nivel: 'normal' | 'atencao' | 'critico'
}

/** "YYYY-MM-DD HH:MM:SS" no horário local, o formato do filtro do Controllr. */
export function dataControllr(data: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())} ${p(data.getHours())}:${p(data.getMinutes())}:${p(data.getSeconds())}`
}

/** Período dos últimos DIAS_QUEDAS dias até agora. */
export function periodoQuedas(agora: Date = new Date()): { dataInicio: string; dataFim: string } {
  const inicio = new Date(agora.getTime() - DIAS_QUEDAS * 24 * 60 * 60 * 1000)
  return { dataInicio: dataControllr(inicio), dataFim: dataControllr(agora) }
}

/**
 * Sessões encerradas no período = quedas. A partir de 3 em 7 dias pede
 * atenção; a partir de 10, crítico. `total` vem do servidor (período
 * inteiro); a lista pode ser só a primeira página.
 */
export function resumirQuedas(sessoes: SessaoHistoricoDto[], total?: number): ResumoQuedas {
  const quantidade = total ?? sessoes.length
  const perdaDeLink = sessoes.filter((s) => s.session_terminate_cause === PERDA_DE_LINK).length
  const nivel = quantidade >= 10 ? 'critico' : quantidade >= 3 ? 'atencao' : 'normal'
  return { total: quantidade, perdaDeLink, nivel }
}
