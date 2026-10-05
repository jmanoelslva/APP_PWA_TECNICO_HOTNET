import type { NivelSinal } from '../../utils/formatacao'

/**
 * Faixa de sinal óptico (dBm) da OLT — mesma origem/critério de
 * nivelSinalOnu (utils/formatacao.ts), mas com cortes diferentes (não é
 * a mesma faixa da ONU, ver comentário lá).
 */
export function nivelSinalOlt(rx: number | undefined): NivelSinal {
  if (rx == null) return 'desconhecida'
  if (rx >= -25) return 'boa'
  if (rx >= -27) return 'alerta'
  return 'critica'
}

// onu_info_timer — contador em ms desde a última coleta feita pelo
// Controllr; zera só quando alguém clica em "Atualizar agora" (ver
// CONTROLLR_API_NOTES.md).
export function formatarTempoDesdeColeta(ms: number | undefined): string | null {
  if (ms == null) return null
  const segundosTotais = Math.floor(ms / 1000)
  const minutos = Math.floor(segundosTotais / 60)
  const segundos = segundosTotais % 60
  if (minutos === 0) return `há ${segundos}s`
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  const minutosRestantes = minutos % 60
  return `há ${horas}h${minutosRestantes > 0 ? ` ${minutosRestantes}min` : ''}`
}

// onu_last_down_time vem como "yyyy-mm-dd hh:mm:ss UTC-3" (hora local do
// servidor) — reformatado para dd/mm/yyyy hh:mm:ss sem conversão de fuso
// (o técnico está no mesmo fuso do servidor). Se o formato não bater com o
// esperado, exibe o valor cru em vez de esconder o dado.
export function formatarUltimaQueda(valor: string | undefined): string | null {
  if (!valor) return null
  const match = valor.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2}:\d{2})/)
  if (!match) return valor
  const [, ano, mes, dia, hora] = match
  return `${dia}/${mes}/${ano} ${hora}`
}

export const TEXTO_SINAL: Record<NivelSinal, string> = {
  boa: 'Sinal normal',
  alerta: 'Sinal fraco — atenção',
  critica: 'Sinal crítico',
  desconhecida: 'Sinal não informado',
}
