import { describe, expect, it } from 'vitest'
import { itemMarcado } from './BottomNav'

// Ordem da barra: 0 Início, 1 OS, 2 Conexão, 3 ONU.
describe('itemMarcado', () => {
  it('as quatro abas marcam a si mesmas', () => {
    expect(itemMarcado('/')).toBe(0)
    expect(itemMarcado('/suporte')).toBe(1)
    expect(itemMarcado('/conexao')).toBe(2)
    expect(itemMarcado('/onu')).toBe(3)
  })
  it('detalhe da OS marca OS', () => {
    expect(itemMarcado('/os/2165')).toBe(1)
  })
  it('telas abertas pelo Início marcam Início', () => {
    expect(itemMarcado('/clientes/2010')).toBe(0)
    expect(itemMarcado('/mapa')).toBe(0)
    expect(itemMarcado('/ferramentas')).toBe(0)
  })
})
