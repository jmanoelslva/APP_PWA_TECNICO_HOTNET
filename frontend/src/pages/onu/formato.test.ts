import { describe, expect, it } from 'vitest'
import { formatarTempoDesdeColeta, formatarUltimaQueda, nivelSinalOlt } from './formato'

describe('ONU', () => {
  it('faixa de sinal da OLT', () => {
    expect([nivelSinalOlt(-24), nivelSinalOlt(-26), nivelSinalOlt(-28), nivelSinalOlt(undefined)]).toEqual([
      'boa', 'alerta', 'critica', 'desconhecida',
    ])
  })

  it('tempo desde a coleta e última queda', () => {
    expect(formatarTempoDesdeColeta(45000)).toBe('há 45s')
    expect(formatarTempoDesdeColeta(125000)).toBe('há 2 min')
    expect(formatarTempoDesdeColeta(3 * 3600000 + 5 * 60000)).toBe('há 3h 5min')
    expect(formatarUltimaQueda('2026-10-04 22:10:05 UTC-3')).toBe('04/10/2026 22:10:05')
    expect(formatarUltimaQueda('ontem')).toBe('ontem')
    expect(formatarUltimaQueda(undefined)).toBeNull()
  })
})
