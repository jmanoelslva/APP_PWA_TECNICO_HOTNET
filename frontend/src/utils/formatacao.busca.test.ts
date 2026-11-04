import { describe, expect, it } from 'vitest'
import { detectarTipoBusca } from './formatacao'

describe('detectarTipoBusca', () => {
  it('CPF e CNPJ com ou sem máscara viram documento', () => {
    expect(detectarTipoBusca('12345678900')).toEqual({ doc: '12345678900' })
    expect(detectarTipoBusca('123.456.789-00')).toEqual({ doc: '12345678900' })
    expect(detectarTipoBusca('12.345.678/0001-90')).toEqual({ doc: '12345678000190' })
  })

  it('trecho numérico busca documento e contrato, com o zero à esquerda', () => {
    expect(detectarTipoBusca('026906')).toEqual({ doc: '026906', contrato: '026906' })
    expect(detectarTipoBusca(' 1024 ')).toEqual({ doc: '1024', contrato: '1024' })
  })

  it('menos de 4 dígitos é só contrato', () => {
    expect(detectarTipoBusca('269')).toEqual({ contrato: '269' })
  })

  it('com letra é nome', () => {
    expect(detectarTipoBusca('Maria 2')).toEqual({ nome: 'Maria 2' })
  })
})
