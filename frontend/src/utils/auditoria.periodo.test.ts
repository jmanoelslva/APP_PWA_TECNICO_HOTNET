import { describe, expect, it } from 'vitest'
import { datasDoPeriodo } from './auditoria'

const agora = new Date(2026, 10, 4, 15, 0) // 04/11/2026

describe('datasDoPeriodo', () => {
  it('hoje, 7 e 30 dias contam o dia de hoje', () => {
    expect(datasDoPeriodo('hoje', { de: '', ate: '' }, agora)).toEqual({ de: '2026-11-04', ate: '2026-11-04' })
    expect(datasDoPeriodo('7', { de: '', ate: '' }, agora)).toEqual({ de: '2026-10-29', ate: '2026-11-04' })
    expect(datasDoPeriodo('30', { de: '', ate: '' }, agora)).toEqual({ de: '2026-10-06', ate: '2026-11-04' })
  })

  it('tudo não filtra; período usa as datas escolhidas', () => {
    expect(datasDoPeriodo('tudo', { de: 'x', ate: 'y' }, agora)).toEqual({ de: '', ate: '' })
    expect(datasDoPeriodo('periodo', { de: '2026-10-01', ate: '2026-10-15' }, agora)).toEqual({
      de: '2026-10-01',
      ate: '2026-10-15',
    })
  })
})
