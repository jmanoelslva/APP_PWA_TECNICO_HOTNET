import type { QuedaOnu } from '../api/client'

/** Textos dos dados do Coletor de OLTs (histórico da ONU), usados na tela da ONU e na de Conexão. */

export function dataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function duracao(s: number): string {
  if (s < 60) return `${Math.round(s)} s`
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`
  return `${Math.floor(h / 24)} dias`
}

export function haQuanto(iso: string | null | undefined, agora: number): string {
  if (!iso) return 'sem leitura'
  const min = Math.round((agora - Date.parse(iso)) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  return `há ${duracao(min * 60)}`
}

// "ONU caiu: falta de energia (dying gasp)" → "Falta de energia (dying gasp)"
export function motivoCurto(motivo: string): string {
  const texto = motivo.replace(/^ONU caiu:?\s*/i, '').replace(/^ONU\s+/i, '')
  return texto ? texto[0].toUpperCase() + texto.slice(1) : 'Queda'
}

export function classeQueda(q: QuedaOnu): 'energia' | 'sinal' | 'outra' {
  if (q.codigos.includes('dgi')) return 'energia'
  if (q.codigos.some((c) => c === 'losi' || c === 'lofi')) return 'sinal'
  return 'outra'
}

export function voltaTexto(q: QuedaOnu, aindaFora: boolean): string {
  if (q.duracao_s != null) return q.duracao_s < 5 ? 'Voltou na hora (oscilação)' : `Ficou fora ${duracao(q.duracao_s)}`
  return aindaFora ? 'Ainda fora' : 'Volta não registrada'
}

// Quedas do mesmo tipo com menos de 15 min entre si viram uma linha só
// ("oscilou N vezes") — senão uma ONU instável enche a tela.
const JANELA_OSCILACAO_MS = 15 * 60_000

export interface GrupoQuedas {
  q: QuedaOnu
  n: number
  primeira: string
}

export function agruparQuedas(quedas: QuedaOnu[]): GrupoQuedas[] {
  const grupos: GrupoQuedas[] = []
  for (const q of quedas) {
    const g = grupos[grupos.length - 1]
    if (g && classeQueda(g.q) === classeQueda(q) && Date.parse(g.primeira) - Date.parse(q.caiu_em) <= JANELA_OSCILACAO_MS) {
      g.n += 1
      g.primeira = q.caiu_em
    } else {
      grupos.push({ q, n: 1, primeira: q.caiu_em })
    }
  }
  return grupos
}

export function resumirQuedas(quedas: QuedaOnu[]): string {
  if (quedas.length === 0) return ''
  const energia = quedas.filter((q) => classeQueda(q) === 'energia').length
  const sinal = quedas.filter((q) => classeQueda(q) === 'sinal').length
  const partes = [`${quedas.length} no período`]
  if (energia) partes.push(`${energia} por energia`)
  if (sinal) partes.push(`${sinal} sem sinal`)
  return partes.join(', ')
}
