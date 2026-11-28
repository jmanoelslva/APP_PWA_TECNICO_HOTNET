import { describe, expect, it } from 'vitest'
import { urlRoteador } from './roteador'

describe('urlRoteador', () => {
  it('usa a porta gravada', () => {
    expect(urlRoteador('100.64.1.2', 8080)).toBe('http://100.64.1.2:8080/')
  })
  it('sem porta ou porta 80 abre na padrão', () => {
    expect(urlRoteador('10.0.0.1')).toBe('http://10.0.0.1/')
    expect(urlRoteador('10.0.0.1', 80)).toBe('http://10.0.0.1/')
  })
  it('443 e 8443 abrem em https', () => {
    expect(urlRoteador('10.0.0.1', 443)).toBe('https://10.0.0.1/')
    expect(urlRoteador('10.0.0.1', 8443)).toBe('https://10.0.0.1:8443/')
  })
  it('ignora porta inválida', () => {
    expect(urlRoteador('10.0.0.1', 0)).toBe('http://10.0.0.1/')
    expect(urlRoteador('10.0.0.1', 70000)).toBe('http://10.0.0.1/')
  })
  it('recusa IP inválido ou vazio', () => {
    expect(urlRoteador('—')).toBeNull()
    expect(urlRoteador('')).toBeNull()
    expect(urlRoteador(undefined)).toBeNull()
    expect(urlRoteador('256.1.1.1')).toBeNull()
    expect(urlRoteador('2804:7ce0::1')).toBeNull()
  })
})
