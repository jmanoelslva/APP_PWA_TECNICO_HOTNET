import { describe, expect, it } from 'vitest'
import { instanteDoServidor, quandoFoi, tempoRelativo } from './formatacao'

const agora = new Date(2026, 10, 5, 15, 0, 0).getTime()

describe('instanteDoServidor', () => {
  it('lê o formato do Controllr e recusa data vazia ou zerada', () => {
    expect(instanteDoServidor('2026-11-05 14:30:00')).toBe(new Date(2026, 10, 5, 14, 30, 0).getTime())
    expect(instanteDoServidor('0000-00-00 00:00:00')).toBeNull()
    expect(instanteDoServidor('')).toBeNull()
  })
})

describe('tempoRelativo', () => {
  it('agora, minutos, horas e dias', () => {
    expect(tempoRelativo(agora - 20_000, agora)).toBe('agora')
    expect(tempoRelativo(agora - 5 * 60_000, agora)).toBe('há 5 min')
    expect(tempoRelativo(agora - 3 * 3600_000, agora)).toBe('há 3 h')
    expect(tempoRelativo(agora - 24 * 3600_000, agora)).toBe('há 1 dia')
    expect(tempoRelativo(agora - 12 * 24 * 3600_000, agora)).toBe('há 12 dias')
  })
})

describe('quandoFoi', () => {
  it('relativo e absoluto juntos', () => {
    expect(quandoFoi('2026-11-05 12:00:00', agora)).toBe('há 3 h · 05/11/2026 12:00')
    expect(quandoFoi(null, agora)).toBe('')
  })
})
