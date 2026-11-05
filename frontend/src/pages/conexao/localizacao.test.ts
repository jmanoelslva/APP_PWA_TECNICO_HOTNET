import { describe, expect, it } from 'vitest'
import { mudouOSuficiente } from './localizacao'

// ~1 m de latitude
const UM_METRO = 1 / 111320

describe('mudouOSuficiente', () => {
  const base = { lat: -9.6, lng: -36.6, precisaoM: 10 }

  it('primeira leitura sempre atualiza', () => {
    expect(mudouOSuficiente(null, base)).toBe(true)
  })

  it('parado com variação pequena não atualiza', () => {
    expect(mudouOSuficiente(base, { ...base, lat: base.lat + 2 * UM_METRO, precisaoM: 12 })).toBe(false)
  })

  it('andou 5 m ou mais atualiza', () => {
    expect(mudouOSuficiente(base, { ...base, lat: base.lat + 6 * UM_METRO })).toBe(true)
  })

  it('precisão mudou 5 m ou mais atualiza, mesmo parado', () => {
    expect(mudouOSuficiente({ ...base, precisaoM: 30 }, { ...base, precisaoM: 8 })).toBe(true)
  })
})
