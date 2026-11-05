import { describe, expect, it } from 'vitest'
import { mudouOSuficiente } from './localizacao'

// ~1 m de latitude
const UM_METRO = 1 / 111320

describe('mudouOSuficiente', () => {
  const base = { lat: -9.6, lng: -36.6, precisaoM: 10 }

  it('primeira leitura sempre atualiza', () => {
    expect(mudouOSuficiente(null, base)).toBe(true)
  })

  it('tremor parado (menos de 3 m, sem ganho de precisão) não atualiza', () => {
    expect(mudouOSuficiente(base, { ...base, lat: base.lat + 2 * UM_METRO, precisaoM: 11 })).toBe(false)
  })

  it('andou 3 m ou mais atualiza', () => {
    expect(mudouOSuficiente(base, { ...base, lat: base.lat + 3.5 * UM_METRO })).toBe(true)
  })

  it('qualquer melhora de 1 m na precisão atualiza, mesmo parado', () => {
    expect(mudouOSuficiente(base, { ...base, precisaoM: 8.5 })).toBe(true)
  })

  it('piora pequena da precisão não atualiza; piora de 5 m atualiza', () => {
    expect(mudouOSuficiente(base, { ...base, precisaoM: 13 })).toBe(false)
    expect(mudouOSuficiente(base, { ...base, precisaoM: 16 })).toBe(true)
  })
})
