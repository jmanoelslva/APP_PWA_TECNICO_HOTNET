import { afterEach, describe, expect, it } from 'vitest'
import { lerRascunhoFinalizacao, salvarRascunhoFinalizacao } from './rascunhoFinalizacao'

afterEach(() => localStorage.clear())

describe('rascunho da finalização', () => {
  it('guarda por OS e devolve depois', () => {
    salvarRascunhoFinalizacao(10, 'Trocado conector')
    expect(lerRascunhoFinalizacao(10)).toBe('Trocado conector')
    expect(lerRascunhoFinalizacao(11)).toBe('')
  })

  it('texto vazio apaga o rascunho', () => {
    salvarRascunhoFinalizacao(10, 'algo')
    salvarRascunhoFinalizacao(10, '   ')
    expect(lerRascunhoFinalizacao(10)).toBe('')
  })
})
