import { describe, expect, it } from 'vitest'
import { base64UrlParaBytes } from './base64'

describe('base64UrlParaBytes', () => {
  it('converte base64 de URL (sem "=", com - e _) em bytes', () => {
    expect([...base64UrlParaBytes('-_8')]).toEqual([0xfb, 0xff])
    expect([...base64UrlParaBytes('AQID')]).toEqual([1, 2, 3])
    // Chave pública do Web Push: 65 bytes começando em 0x04.
    const chave = base64UrlParaBytes('BP' + 'A'.repeat(85))
    expect(chave.length).toBe(65)
    expect(chave[0]).toBe(0x04)
  })
})
