import { describe, expect, it } from 'vitest'
import { passoAba } from './navegacaoAbas'

describe('abas do rodapé', () => {
  it('do Início, empilha a aba (Voltar volta ao Início)', () => {
    expect(passoAba('/suporte', '/', 0, 0)).toEqual({ tipo: 'empilhar', para: '/suporte' })
  })

  it('de uma aba para outra, troca sem empilhar', () => {
    expect(passoAba('/conexao', '/suporte', 1, 0)).toEqual({ tipo: 'trocar', para: '/conexao' })
  })

  it('de uma tela aberta dentro da aba, desce até a aba e troca', () => {
    expect(passoAba('/onu', '/suporte/55', 3, 0)).toEqual({ tipo: 'voltar', delta: -2, depois: '/onu' })
  })

  it('Início volta até ele, sem criar outra entrada', () => {
    expect(passoAba('/', '/suporte/55', 3, 0)).toEqual({ tipo: 'voltar', delta: -3 })
  })

  it('sem Início por baixo (abriu direto numa OS), troca pelo Início', () => {
    expect(passoAba('/', '/suporte/55', 0, null)).toEqual({ tipo: 'trocar', para: '/' })
    expect(passoAba('/onu', '/suporte/55', 0, null)).toEqual({ tipo: 'trocar', para: '/onu' })
  })

  it('tocar na aba já aberta não faz nada', () => {
    expect(passoAba('/', '/', 0, 0)).toEqual({ tipo: 'nada' })
    expect(passoAba('/suporte', '/suporte', 1, 0)).toEqual({ tipo: 'nada' })
  })
})
