import { describe, expect, it } from 'vitest'
import { calcularPotencia } from './potenciaOptica'

const base = { potenciaOlt: 3, splitters: ['1:8', '1:8'], distanciaKm: 2, conectores: 4, emendas: 3 }

describe('calcularPotencia', () => {
  it('soma as perdas e dá o sinal esperado', () => {
    const r = calcularPotencia(base)
    // 10,5 + 10,5 + 0,6 + 2 + 0,3 = 23,9
    expect(r.perdaTotal).toBe(23.9)
    expect(r.esperado).toBe(-20.9)
    expect(r.nivel).toBe('boa')
    expect(r.diferenca).toBeNull()
  })
  it('sinal lido muito abaixo do esperado aponta perda extra', () => {
    const r = calcularPotencia({ ...base, lido: -25.4 })
    expect(r.diferenca).toBe(-4.5)
    expect(r.aviso).toMatch(/4,5 dB abaixo/)
  })
  it('lido perto do esperado: dentro do esperado', () => {
    expect(calcularPotencia({ ...base, lido: -21.5 }).aviso).toMatch(/dentro do esperado/)
  })
  it('caminho longo cai em sinal crítico', () => {
    expect(calcularPotencia({ ...base, splitters: ['1:8', '1:16'] }).nivel).toBe('critica')
  })
})
