import { describe, expect, it } from 'vitest'
import { formatarCep, formatarDocumento, formatarTelefone, linkLigar, linkWhatsapp } from './formatacao'

describe('documento e telefone', () => {
  it('CPF e CNPJ com máscara; o resto como veio', () => {
    expect(formatarDocumento('12345678900')).toBe('123.456.789-00')
    expect(formatarDocumento('123.456.789-00')).toBe('123.456.789-00')
    expect(formatarDocumento('12345678000199')).toBe('12.345.678/0001-99')
    expect(formatarDocumento('123')).toBe('123')
    expect(formatarDocumento(null)).toBe('')
  })

  it('telefone: celular, fixo, com 55 e com 0 na frente', () => {
    expect(formatarTelefone('86999990000')).toBe('(86) 99999-0000')
    expect(formatarTelefone('8632220000')).toBe('(86) 3222-0000')
    expect(formatarTelefone('+55 (86) 99999-0000')).toBe('(86) 99999-0000')
    expect(formatarTelefone('086 3222-0000')).toBe('(86) 3222-0000')
    expect(formatarTelefone('0800 123')).toBe('0800 123')
  })

  it('WhatsApp só para celular; ligar para qualquer número', () => {
    expect(linkWhatsapp('86999990000')).toBe('https://wa.me/5586999990000')
    expect(linkWhatsapp('8632220000')).toBeNull()
    expect(linkLigar('(86) 3222-0000')).toBe('tel:8632220000')
    expect(linkLigar('')).toBeNull()
  })
})

describe('CEP', () => {
  it('8 dígitos com hífen; o resto como veio', () => {
    expect(formatarCep('64000000')).toBe('64000-000')
    expect(formatarCep('64000-000')).toBe('64000-000')
    expect(formatarCep('640')).toBe('640')
    expect(formatarCep(undefined)).toBe('')
  })
})
