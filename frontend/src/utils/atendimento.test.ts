import { describe, expect, it } from 'vitest'
import { destinosAtendimento, juntarAtendimento, osDoCliente } from './atendimento'

describe('juntarAtendimento', () => {
  it('mesmo cliente: completa com o que a tela sabe', () => {
    const a = juntarAtendimento({ clientPk: 5, cliente: 'Ana', ticketPk: 9, em: 1 }, { clientPk: 5, cpePk: 70, pppoe: 'ana' }, 2)
    expect(a).toEqual({ clientPk: 5, cliente: 'Ana', ticketPk: 9, cpePk: 70, pppoe: 'ana', em: 2 })
  })
  it('outro cliente: começa do zero (não leva a OS do anterior)', () => {
    const a = juntarAtendimento({ clientPk: 5, cliente: 'Ana', ticketPk: 9, cpePk: 70, em: 1 }, { clientPk: 6, cliente: 'Bruno' }, 2)
    expect(a).toEqual({ clientPk: 6, cliente: 'Bruno', em: 2 })
  })
  it('mesma conexão sem cliente na tela: completa', () => {
    const a = juntarAtendimento({ clientPk: 5, cpePk: 70, em: 1 }, { cpePk: 70, pppoe: 'ana' }, 2)
    expect(a.clientPk).toBe(5)
  })
})

describe('destinosAtendimento', () => {
  it('monta os caminhos que tem dado para montar', () => {
    expect(destinosAtendimento({ clientPk: 5, cliente: 'Ana Ribeiro', cpePk: 70, pppoe: 'ana@x', em: 1 })).toEqual({
      cliente: '/clientes/5',
      conexao: '/conexao?cpe_pk=70',
      onu: '/onu?username=ana%40x',
      os: '/suporte?busca=Ana%20Ribeiro',
      financeiro: '/financeiro?client_pk=5',
    })
  })
  it('com OS no atendimento, OS abre ela', () => {
    expect(destinosAtendimento({ ticketPk: 9, em: 1 }).os).toBe('/os/9')
  })
})

describe('osDoCliente', () => {
  const ordens = [
    { client_pk: 5, ticket_pk: 9 },
    { client_pk: 5, ticket_pk: 9 },
    { client_pk: 6, ticket_pk: 10 },
    { client_pk: 6, ticket_pk: 11 },
  ]
  it('uma OS (mesmo chamado em duas linhas): abre direto', () => {
    expect(osDoCliente(ordens, 5)).toEqual({ tipo: 'uma', ticketPk: 9 })
  })
  it('várias: lista filtrada', () => {
    expect(osDoCliente(ordens, 6)).toEqual({ tipo: 'varias' })
  })
  it('nenhuma', () => {
    expect(osDoCliente(ordens, 7)).toEqual({ tipo: 'nenhuma' })
  })
})
