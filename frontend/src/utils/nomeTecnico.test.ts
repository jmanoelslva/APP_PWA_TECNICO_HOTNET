import { beforeEach, describe, expect, it } from 'vitest'
import { lembrarNome, nomeExibicao, nomeLembrado } from './nomeTecnico'

describe('nomeExibicao', () => {
  it('primeiro nome do Controllr', () => {
    expect(nomeExibicao({ username: 'edsonsantos', nome: 'EDSON SANTOS' })).toBe('Edson')
  })
  it('sem nome, usuário com inicial maiúscula', () => {
    expect(nomeExibicao({ username: 'edsonsantos', nome: null })).toBe('Edsonsantos')
    expect(nomeExibicao({ username: 'edsonsantos', nome: '  ' })).toBe('Edsonsantos')
    expect(nomeExibicao(null)).toBe('')
  })
})

describe('nomeLembrado', () => {
  beforeEach(() => localStorage.clear())
  it('usa o nome guardado só para o mesmo usuário', () => {
    lembrarNome('edsonsantos', 'Edson Santos')
    expect(nomeLembrado('EdsonSantos')).toBe('Edson')
    expect(nomeLembrado('camila')).toBe('Camila')
  })
})
