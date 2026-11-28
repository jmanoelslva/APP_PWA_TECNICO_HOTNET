import { describe, expect, it } from 'vitest'
import { cabecalhoLocalizacao } from './localizacaoAuditoria'

const leitura = { lat: -9.6658, lng: -35.7353, precisao: 12.4, em: 1_000_000 }

describe('cabecalhoLocalizacao', () => {
  it('monta lat;lng;precisão;idade', () => {
    expect(cabecalhoLocalizacao(1_030_000, leitura)).toBe('-9.665800;-35.735300;12;30')
  })
  it('sem leitura não envia', () => {
    expect(cabecalhoLocalizacao(1_000_000, null)).toBeNull()
  })
  it('leitura com mais de 30 min não vai', () => {
    expect(cabecalhoLocalizacao(1_000_000 + 31 * 60_000, leitura)).toBeNull()
  })
})
