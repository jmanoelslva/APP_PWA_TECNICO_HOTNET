import { beforeEach, describe, expect, it } from 'vitest'
import { ApiError, SessaoExpiradaError } from '../api/client'
import { lerChecklist, salvarChecklist, textoChecklist } from './checklistSaida'
import { decidirAposFalha, ehFalhaDeRede } from './filaAnexos'
import { deveComprimir, dimensoesReduzidas } from './imagem'

describe('dimensoesReduzidas', () => {
  it('reduz pelo lado maior sem distorcer', () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1600, altura: 1200 })
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 1200, altura: 1600 })
  })

  it('nunca amplia', () => {
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 })
  })
})

describe('deveComprimir', () => {
  it('só imagem comum e grande', () => {
    expect(deveComprimir({ type: 'image/jpeg', size: 3_000_000 })).toBe(true)
    expect(deveComprimir({ type: 'image/jpeg', size: 100_000 })).toBe(false)
    expect(deveComprimir({ type: 'application/pdf', size: 3_000_000 })).toBe(false)
    expect(deveComprimir({ type: 'image/heic', size: 3_000_000 })).toBe(false)
  })
})

describe('fila de anexos', () => {
  it('mantém sem rede, sessão expirada ou erro do servidor', () => {
    expect(decidirAposFalha(new TypeError('Failed to fetch'))).toBe('manter')
    expect(decidirAposFalha(new SessaoExpiradaError())).toBe('manter')
    expect(decidirAposFalha(new ApiError('falhou', 502))).toBe('manter')
  })

  it('descarta o que o servidor recusou', () => {
    expect(decidirAposFalha(new ApiError('grande demais', 413))).toBe('descartar')
  })

  it('reconhece falha de rede', () => {
    expect(ehFalhaDeRede(new TypeError('Failed to fetch'))).toBe(true)
    expect(ehFalhaDeRede(new ApiError('x', 400))).toBe(false)
    expect(ehFalhaDeRede(new SessaoExpiradaError())).toBe(false)
  })
})

describe('checklist de saída', () => {
  beforeEach(() => localStorage.clear())

  it('monta a linha na ordem da lista, com o sinal', () => {
    expect(textoChecklist(['fotos', 'sinal'], -19.8)).toBe('Checklist: sinal da ONU conferido (-19,8 dBm); fotos anexadas.')
  })

  it('sem leitura de sinal e sem itens', () => {
    expect(textoChecklist(['sinal'], null)).toBe('Checklist: sinal da ONU conferido.')
    expect(textoChecklist([])).toBe('')
  })

  it('guarda por OS', () => {
    salvarChecklist(10, ['sinal'])
    expect(lerChecklist(10)).toEqual(['sinal'])
    expect(lerChecklist(11)).toEqual([])
    salvarChecklist(10, [])
    expect(lerChecklist(10)).toEqual([])
  })
})
