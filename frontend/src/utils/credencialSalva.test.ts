import { afterEach, describe, expect, it, vi } from 'vitest'
import { esquecerCredencial, guardarCredencial, suportaBiometria, temCredencialSalva } from './credencialSalva'

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('credencial salva (biometria pelo gerenciador de senhas)', () => {
  it('sem PasswordCredential no navegador, não há biometria', () => {
    expect(suportaBiometria()).toBe(false)
    expect(temCredencialSalva('jmanoel')).toBe(false)
  })

  it('guarda a marca só do usuário que entrou, e esquece ao pedir', async () => {
    vi.stubGlobal('PasswordCredential', function PasswordCredential(this: object, dados: object) {
      Object.assign(this, dados)
    })
    const store = vi.fn(async () => undefined)
    vi.stubGlobal('navigator', { ...navigator, credentials: { store, get: vi.fn() } })
    await guardarCredencial('JManoel', 'segredo')
    expect(store).toHaveBeenCalled()
    expect(temCredencialSalva('jmanoel')).toBe(true)
    expect(temCredencialSalva('outro')).toBe(false)
    esquecerCredencial()
    expect(temCredencialSalva('jmanoel')).toBe(false)
  })
})
