import { describe, expect, it } from 'vitest'
import { MENSAGENS_CLIENTE, linkWhatsappComTexto, primeiroNome } from './mensagensCliente'

describe('primeiroNome', () => {
  it('pega o primeiro nome e acerta maiúsculas', () => {
    expect(primeiroNome('MARIA DA SILVA')).toBe('Maria')
    expect(primeiroNome('  joão  pedro ')).toBe('João')
  })
  it('vazio sem nome', () => {
    expect(primeiroNome(null)).toBe('')
    expect(primeiroNome('   ')).toBe('')
  })
})

describe('linkWhatsappComTexto', () => {
  it('usa o primeiro celular e codifica o texto', () => {
    const link = linkWhatsappComTexto('7932221100 / 79999887766', 'Olá, Maria!')
    expect(link).toBe('https://wa.me/5579999887766?text=Ol%C3%A1%2C%20Maria!')
  })
  it('sem celular, sem link', () => {
    expect(linkWhatsappComTexto('7932221100', 'oi')).toBeNull()
    expect(linkWhatsappComTexto(null, 'oi')).toBeNull()
  })
})

describe('MENSAGENS_CLIENTE', () => {
  it('saudação sem nome não fica com vírgula sobrando', () => {
    expect(MENSAGENS_CLIENTE[0].texto('')).toMatch(/^Olá! /)
    expect(MENSAGENS_CLIENTE[0].texto('Maria')).toMatch(/^Olá, Maria! /)
  })
})
