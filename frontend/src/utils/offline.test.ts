import { describe, expect, it } from 'vitest'
import {
  ctosComVariosOffline,
  grupoOffline,
  instanteAutenticacao,
  instanteDaQueda,
  regiaoDaCto,
  tempoOffline,
} from './offline'

const agora = new Date(2026, 10, 5, 15, 0, 0).getTime()

describe('instanteAutenticacao', () => {
  it('lê o formato do Controllr', () => {
    expect(instanteAutenticacao('2026-11-05 14:30:00')).toBe(new Date(2026, 10, 5, 14, 30, 0).getTime())
  })
  it('vazio ou data zerada é "nunca"', () => {
    expect(instanteAutenticacao('')).toBeNull()
    expect(instanteAutenticacao(undefined)).toBeNull()
    expect(instanteAutenticacao('0000-00-00 00:00:00')).toBeNull()
  })
})

describe('instanteDaQueda', () => {
  it('usa o último accounting, não a última autenticação', () => {
    expect(instanteDaQueda({ date_auth: '2026-10-26 12:52:17', date_acct: '2026-11-05 19:25:56' })).toBe(
      new Date(2026, 10, 5, 19, 25, 56).getTime(),
    )
  })
  it('sem accounting, cai para a autenticação; sem nada, nunca', () => {
    expect(instanteDaQueda({ date_auth: '2026-11-01 10:00:00' })).toBe(new Date(2026, 10, 1, 10, 0, 0).getTime())
    expect(instanteDaQueda({ date_acct: '0000-00-00 00:00:00' })).toBeNull()
  })
})

describe('grupoOffline', () => {
  it('mesmo dia é hoje, mesmo de madrugada', () => {
    expect(grupoOffline(new Date(2026, 10, 5, 0, 5).getTime(), agora)).toBe('hoje')
  })
  it('ontem até 7 dias é semana; depois, antigos', () => {
    expect(grupoOffline(new Date(2026, 10, 4, 23, 59).getTime(), agora)).toBe('semana')
    expect(grupoOffline(agora - 6 * 24 * 3600_000, agora)).toBe('semana')
    expect(grupoOffline(agora - 8 * 24 * 3600_000, agora)).toBe('antigos')
  })
  it('sem autenticação é nunca', () => {
    expect(grupoOffline(null, agora)).toBe('nunca')
  })
})

describe('tempoOffline', () => {
  it('minutos, horas e dias', () => {
    expect(tempoOffline(agora - 5 * 60_000, agora)).toBe('caiu há 5 min')
    expect(tempoOffline(agora - 3 * 3600_000, agora)).toBe('caiu há 3 h')
    expect(tempoOffline(agora - 24 * 3600_000, agora)).toBe('caiu há 1 dia')
    expect(tempoOffline(agora - 12 * 24 * 3600_000, agora)).toBe('caiu há 12 dias')
    expect(tempoOffline(null, agora)).toBe('Nunca conectou')
  })
})

describe('regiaoDaCto', () => {
  it('setor primeiro, depois a sigla do nome', () => {
    expect(regiaoDaCto('NRO-CTO-6.8', 'FTTH-NRO')).toBe('FTTH-NRO')
    expect(regiaoDaCto('NRO-CTO-6.8', null)).toBe('NRO')
    expect(regiaoDaCto('CTO20.6', null)).toBe('Outras')
    expect(regiaoDaCto(undefined, null)).toBe('Sem CTO')
  })
})

describe('ctosComVariosOffline', () => {
  it('só CTOs com 2 ou mais, da mais afetada para a menos', () => {
    const itens = [
      { dp_pk: 1, dp_name: 'A-CTO-1.1' },
      { dp_pk: 2, dp_name: 'A-CTO-1.2' },
      { dp_pk: 2, dp_name: 'A-CTO-1.2' },
      { dp_pk: 3, dp_name: 'A-CTO-1.3' },
      { dp_pk: 3, dp_name: 'A-CTO-1.3' },
      { dp_pk: 3, dp_name: 'A-CTO-1.3' },
      { dp_name: 'sem pk' },
    ]
    expect(ctosComVariosOffline(itens)).toEqual([
      { dpPk: 3, nome: 'A-CTO-1.3', quantidade: 3 },
      { dpPk: 2, nome: 'A-CTO-1.2', quantidade: 2 },
    ])
  })
})
