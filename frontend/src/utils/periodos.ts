import { dataParaFormatoServidor } from './formatacao'

/**
 * Presets de período para o histórico de conexão (Conexao.tsx). Cálculo
 * de datas replica o do próprio painel Controllr (ver
 * CONTROLLR_API_NOTES.md, seção 7.5): semana vai de domingo a sábado;
 * mês/ano seguem o calendário normal.
 */
export type PeriodoPreset =
  | 'hoje'
  | 'ontem'
  | 'essa_semana'
  | 'semana_passada'
  | 'esse_mes'
  | 'mes_passado'
  | 'esse_ano'
  | 'ano_passado'
  | 'desde_o_inicio'
  | 'personalizado'

export const OPCOES_PERIODO: Array<{ valor: PeriodoPreset; rotulo: string }> = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'ontem', rotulo: 'Ontem' },
  { valor: 'essa_semana', rotulo: 'Essa semana' },
  { valor: 'semana_passada', rotulo: 'Semana passada' },
  { valor: 'esse_mes', rotulo: 'Esse mês' },
  { valor: 'mes_passado', rotulo: 'Mês passado' },
  { valor: 'esse_ano', rotulo: 'Esse ano' },
  { valor: 'ano_passado', rotulo: 'Ano passado' },
  { valor: 'desde_o_inicio', rotulo: 'Desde o início' },
  { valor: 'personalizado', rotulo: 'Intervalo personalizado' },
]

function inicioDia(data: Date): Date {
  const r = new Date(data)
  r.setHours(0, 0, 0, 0)
  return r
}

function fimDia(data: Date): Date {
  const r = new Date(data)
  r.setHours(23, 59, 59, 999)
  return r
}

// Semana domingo-sábado (ver CONTROLLR_API_NOTES.md).
function inicioSemana(data: Date): Date {
  const r = inicioDia(data)
  r.setDate(r.getDate() - r.getDay())
  return r
}

function fimSemana(data: Date): Date {
  const r = inicioSemana(data)
  r.setDate(r.getDate() + 6)
  return fimDia(r)
}

export interface Periodo {
  inicio: string
  fim: string
}

/**
 * Resolve um preset para { inicio, fim } no formato do servidor.
 * `null` para "desde_o_inicio" e "personalizado" — o primeiro não usa
 * faixa de data nenhuma (mesmo comportamento do painel Controllr:
 * session_date_close IS NOT NULL, sem limite), o segundo é resolvido à
 * parte com as datas escolhidas pelo técnico.
 */
export function calcularPeriodo(preset: PeriodoPreset, referencia: Date = new Date()): Periodo | null {
  switch (preset) {
    case 'hoje':
      return { inicio: dataParaFormatoServidor(inicioDia(referencia)), fim: dataParaFormatoServidor(fimDia(referencia)) }
    case 'ontem': {
      const d = new Date(referencia)
      d.setDate(d.getDate() - 1)
      return { inicio: dataParaFormatoServidor(inicioDia(d)), fim: dataParaFormatoServidor(fimDia(d)) }
    }
    case 'essa_semana':
      return { inicio: dataParaFormatoServidor(inicioSemana(referencia)), fim: dataParaFormatoServidor(fimSemana(referencia)) }
    case 'semana_passada': {
      const d = new Date(referencia)
      d.setDate(d.getDate() - 7)
      return { inicio: dataParaFormatoServidor(inicioSemana(d)), fim: dataParaFormatoServidor(fimSemana(d)) }
    }
    case 'esse_mes': {
      const inicio = new Date(referencia.getFullYear(), referencia.getMonth(), 1)
      const fim = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0)
      return { inicio: dataParaFormatoServidor(inicioDia(inicio)), fim: dataParaFormatoServidor(fimDia(fim)) }
    }
    case 'mes_passado': {
      const inicio = new Date(referencia.getFullYear(), referencia.getMonth() - 1, 1)
      const fim = new Date(referencia.getFullYear(), referencia.getMonth(), 0)
      return { inicio: dataParaFormatoServidor(inicioDia(inicio)), fim: dataParaFormatoServidor(fimDia(fim)) }
    }
    case 'esse_ano': {
      const inicio = new Date(referencia.getFullYear(), 0, 1)
      const fim = new Date(referencia.getFullYear(), 11, 31)
      return { inicio: dataParaFormatoServidor(inicioDia(inicio)), fim: dataParaFormatoServidor(fimDia(fim)) }
    }
    case 'ano_passado': {
      const inicio = new Date(referencia.getFullYear() - 1, 0, 1)
      const fim = new Date(referencia.getFullYear() - 1, 11, 31)
      return { inicio: dataParaFormatoServidor(inicioDia(inicio)), fim: dataParaFormatoServidor(fimDia(fim)) }
    }
    case 'desde_o_inicio':
    case 'personalizado':
      return null
  }
}
