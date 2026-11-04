import { describe, expect, it } from 'vitest'
import type { OrdemServicoDto } from '../api/client'
import { osFuturas, proximaOsFutura, quandoOsFutura } from './minhasOs'

const agora = new Date(2026, 10, 4, 10, 0) // 04/11/2026 10:00

describe('proximaOsFutura', () => {
  it('pega a primeira agendada depois de hoje, ignorando hoje e fechadas', () => {
    const ordens: OrdemServicoDto[] = [
      { op_pk: 1, op_date_sched: '2026-11-04 15:00:00' },
      { op_pk: 2, op_date_sched: '2026-11-07 08:00:00' },
      { op_pk: 3, op_date_sched: '2026-11-05 09:30:00', op_date_close: '2026-11-04 09:00:00' },
      { op_pk: 4, op_date_sched: '2026-11-06 08:00:00' },
    ]
    expect(proximaOsFutura(ordens, agora)?.op_pk).toBe(4)
  })

  it('sem OS futura devolve null', () => {
    expect(proximaOsFutura([{ op_pk: 1, op_date_sched: '2026-11-04 15:00:00' }], agora)).toBeNull()
  })
})

describe('quandoOsFutura', () => {
  it('dia da semana, data e hora', () => {
    expect(quandoOsFutura('2026-11-06 08:00:00')).toBe('sex 06/11 08:00')
  })
})

describe('osFuturas', () => {
  it('conta só as abertas depois de hoje', () => {
    const ordens: OrdemServicoDto[] = [
      { op_pk: 1, op_date_sched: '2026-11-04 15:00:00' },
      { op_pk: 2, op_date_sched: '2026-11-07 08:00:00' },
      { op_pk: 3, op_date_sched: '2026-11-05 09:30:00', op_date_cancel: '2026-11-04 09:00:00' },
      { op_pk: 4, op_date_sched: '2026-11-06 08:00:00' },
    ]
    expect(osFuturas(ordens, agora).map((os) => os.op_pk)).toEqual([4, 2])
  })
})
