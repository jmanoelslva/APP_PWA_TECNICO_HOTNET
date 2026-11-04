import { describe, expect, it } from 'vitest'
import { deveFechar, LIMITE_FECHAR } from './arrastarFolhas'

describe('deveFechar', () => {
  it('fecha só depois de arrastar o bastante para baixo', () => {
    expect(deveFechar(LIMITE_FECHAR)).toBe(true)
    expect(deveFechar(LIMITE_FECHAR - 1)).toBe(false)
    expect(deveFechar(0)).toBe(false)
  })
})
