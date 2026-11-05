// Regras da tela Clientes Offline: quando caiu, em que grupo fica e CTOs
// com mais de um cliente offline (sinal de problema coletivo: fibra
// rompida, CTO ou splitter).

import { instanteDoServidor, tempoRelativo } from './formatacao'

export type GrupoOffline = 'hoje' | 'semana' | 'antigos' | 'nunca'

export const ROTULO_GRUPO: Record<GrupoOffline, string> = {
  hoje: 'Caiu hoje',
  semana: 'De 1 a 7 dias',
  antigos: 'Mais de 7 dias',
  nunca: 'Nunca conectou',
}

export const ORDEM_GRUPOS: GrupoOffline[] = ['hoje', 'semana', 'antigos', 'nunca']

const DIA_MS = 24 * 3600_000

/** Instante de uma data do Controllr (ver instanteDoServidor). */
export const instanteAutenticacao = instanteDoServidor

/**
 * Hora da queda: o último accounting da sessão (cpe_date_acct). Sem ele,
 * a última autenticação; sem nenhum dos dois, nunca conectou.
 */
export function instanteDaQueda(cpe: { date_acct?: string; date_auth?: string }): number | null {
  return instanteAutenticacao(cpe.date_acct) ?? instanteAutenticacao(cpe.date_auth)
}

/** Hoje = mesmo dia do calendário; semana = até 7 dias; depois, antigos. */
export function grupoOffline(instante: number | null, agora: number = Date.now()): GrupoOffline {
  if (instante == null) return 'nunca'
  const inicioDoDia = new Date(agora)
  inicioDoDia.setHours(0, 0, 0, 0)
  if (instante >= inicioDoDia.getTime()) return 'hoje'
  if (agora - instante <= 7 * DIA_MS) return 'semana'
  return 'antigos'
}

/** "caiu há 5 min", "caiu há 3 h", "caiu há 12 dias" (mesmo relativo do app todo). */
export function tempoOffline(instante: number | null, agora: number = Date.now()): string {
  if (instante == null) return 'Nunca conectou'
  return `caiu ${tempoRelativo(instante, agora)}`
}

export interface CtoComOffline {
  dpPk: number
  nome: string
  quantidade: number
}

/** CTOs com 2 ou mais clientes offline, da mais afetada para a menos. */
export function ctosComVariosOffline(itens: { dp_pk?: number; dp_name?: string }[]): CtoComOffline[] {
  const porCto = new Map<number, CtoComOffline>()
  for (const item of itens) {
    if (item.dp_pk == null) continue
    const atual = porCto.get(item.dp_pk) ?? { dpPk: item.dp_pk, nome: item.dp_name || `CTO #${item.dp_pk}`, quantidade: 0 }
    atual.quantidade += 1
    porCto.set(item.dp_pk, atual)
  }
  return [...porCto.values()]
    .filter((cto) => cto.quantidade >= 2)
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
}
