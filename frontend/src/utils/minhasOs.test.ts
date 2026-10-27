import { describe, expect, it } from 'vitest'
import type { OrdemServicoDto } from '../api/client'
import { agruparPorDia, horarioOs, linkRota, osAtrasada, osDoDia, primeiroTelefone, quandoOs } from './minhasOs'

const AGORA = new Date(2026, 9, 5, 9, 30) // 05/10/2026 09:30, hora local

function os(pk: number, sched: string | undefined, extra: Partial<OrdemServicoDto> = {}): OrdemServicoDto {
  return { op_pk: pk, ticket_pk: pk, op_date_sched: sched, ...extra }
}

describe('osDoDia', () => {
  it('fica só com OS de hoje e atrasadas, da mais antiga para a mais nova', () => {
    const lista = osDoDia(
      [
        os(1, '2026-10-05 14:00:00'),
        os(2, '2026-10-06 08:00:00'), // amanhã: fora
        os(3, '2026-10-03 10:00:00'), // atrasada
        os(4, '2026-10-05 08:00:00'),
        os(5, undefined), // sem agendamento: fora
      ],
      AGORA,
    )
    expect(lista.map((i) => i.os.op_pk)).toEqual([3, 4, 1])
    // 09:30 agora: a de ontem e a de hoje 08:00 já passaram; a das 14:00 ainda não.
    expect(lista.map((i) => i.atrasada)).toEqual([true, true, false])
    expect(lista.map((i) => i.diaAnterior)).toEqual([true, false, false])
  })

  it('descarta OS fechada ou cancelada', () => {
    const lista = osDoDia(
      [
        os(1, '2026-10-05 08:00:00', { op_date_close: '2026-10-05 09:00:00' }),
        os(2, '2026-10-05 09:00:00', { op_date_cancel: '2026-10-05 09:10:00' }),
        os(3, '2026-10-05 10:00:00'),
      ],
      AGORA,
    )
    expect(lista.map((i) => i.os.op_pk)).toEqual([3])
  })
})

describe('horarioOs', () => {
  it('hoje mostra só a hora; dia anterior mostra dia e hora', () => {
    expect(horarioOs({ os: os(1, '2026-10-05 08:00:00'), atrasada: true, diaAnterior: false })).toBe('08:00')
    expect(horarioOs({ os: os(1, '2026-10-03 10:30:00'), atrasada: true, diaAnterior: true })).toBe('03/10 10:30')
  })
})

describe('linkRota', () => {
  it('usa as coordenadas quando houver', () => {
    const link = linkRota({ address_latitude: '-5.1', address_longitude: '-42.8' }, os(1, undefined))
    expect(link).toBe('https://www.google.com/maps/dir/?api=1&destination=-5.1%2C-42.8')
  })

  it('sem coordenadas, usa o endereço escrito da OS', () => {
    const link = linkRota(
      null,
      os(1, undefined, { address: 'Rua A', address_number: '10', address_neighborhood: 'Centro', address_province: 'Teresina' }),
    )
    expect(link).toContain(encodeURIComponent('Rua A, 10, Centro, Teresina'))
  })

  it('sem nada para onde ir, não há rota', () => {
    expect(linkRota(null, os(1, undefined))).toBeNull()
  })
})

describe('primeiroTelefone', () => {
  it('prefere o telefone cadastrado e limpa a máscara', () => {
    expect(primeiroTelefone([{ phone_number: '(86) 99999-1234' }], '1#-#86 3222-0000')).toBe('86999991234')
  })

  it('cai para client_phones quando não há telefone cadastrado válido', () => {
    expect(primeiroTelefone([{ phone_number: '-' }], 'Celular#-#86 98888-7777')).toBe('86988887777')
  })

  it('sem telefone, null', () => {
    expect(primeiroTelefone([], null)).toBeNull()
  })
})

describe('quandoOs', () => {
  it('hoje, amanhã, ontem e outros dias', () => {
    expect(quandoOs('2026-10-05 14:00:00', AGORA)).toBe('Hoje 14:00')
    expect(quandoOs('2026-10-06 08:30:00', AGORA)).toBe('Amanhã 08:30')
    expect(quandoOs('2026-10-04 10:00:00', AGORA)).toBe('Ontem 10:00')
    expect(quandoOs('2026-10-01 10:00:00', AGORA)).toBe('01/10 10:00')
    expect(quandoOs(undefined, AGORA)).toBeNull()
  })
})

describe('osAtrasada', () => {
  const noite = new Date(2026, 9, 5, 21, 34) // o caso relatado: hoje 08:00, visto às 21:34

  it('passou do horário de hoje e não foi iniciada', () => {
    expect(osAtrasada(os(1, '2026-10-05 08:00:00'), noite)).toBe(true)
    expect(osAtrasada(os(1, '2026-10-05 08:00:00', { etapa: 'respondida' }), noite)).toBe(true)
    expect(osAtrasada(os(1, '2026-10-05 21:34:00'), noite)).toBe(false) // é agora: ainda não
    expect(osAtrasada(os(1, '2026-10-05 22:00:00'), noite)).toBe(false)
  })

  it('em andamento, fechada, cancelada ou sem data não é atraso', () => {
    expect(osAtrasada(os(1, '2026-10-05 08:00:00', { etapa: 'iniciada' }), noite)).toBe(false)
    expect(osAtrasada(os(1, '2026-10-05 08:00:00', { op_date_close: '2026-10-05 09:00:00' }), noite)).toBe(false)
    expect(osAtrasada(os(1, '2026-10-05 08:00:00', { op_date_cancel: '2026-10-05 09:00:00' }), noite)).toBe(false)
    expect(osAtrasada(os(1, undefined), noite)).toBe(false)
  })
})

describe('agruparPorDia', () => {
  it('agrupa por dia, do mais antigo ao mais novo, sem data no fim', () => {
    const grupos = agruparPorDia(
      [
        { op_pk: 1, op_date_sched: '2026-10-05 15:00:00' },
        { op_pk: 2 },
        { op_pk: 3, op_date_sched: '2026-10-04 09:00:00' },
        { op_pk: 4, op_date_sched: '2026-10-05 08:00:00' },
      ] as OrdemServicoDto[],
      AGORA,
    )
    expect(grupos.map((g) => g.rotulo)).toEqual(['Ontem', 'Hoje', 'Sem data agendada'])
    expect(grupos[1].ordens.map((o) => o.op_pk)).toEqual([4, 1])
  })
})
