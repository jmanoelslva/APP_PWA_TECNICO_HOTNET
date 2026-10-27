import { afterEach, describe, expect, it, vi } from 'vitest'
import { vibrar } from './vibrar'

describe('vibrar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('usa o padrão do tipo', () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    vibrar('erro')
    expect(vibrate).toHaveBeenCalledWith([30, 60, 30])
  })

  it('sem a API (iPhone) não faz nada nem quebra', () => {
    vi.stubGlobal('navigator', {})
    expect(() => vibrar('sucesso')).not.toThrow()
  })

  it('respeita reduzir movimento', () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    vibrar()
    expect(vibrate).not.toHaveBeenCalled()
  })
})
