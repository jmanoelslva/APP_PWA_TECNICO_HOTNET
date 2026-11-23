import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Login, { iniciaisUsuario } from './Login'

// Constante que o Vite injeta no build (vite.config.ts → define).
vi.stubGlobal('__APP_VERSION__', '0.0.0-teste')

const sessao = { entrar: vi.fn(async () => false), carregando: false, erro: null as string | null }

vi.mock('../auth/useSessao', () => ({ useSessao: () => sessao }))
vi.mock('../hooks/useTema', () => ({ useTema: () => ({ tema: 'light', alternarTema: vi.fn() }) }))
vi.mock('../hooks/usePwaInstall', () => ({
  usePwaInstall: () => ({ podeInstalar: false, podeInstalarIos: false, aoClicarInstalar: vi.fn(), modalIosAberto: false, fecharModalIos: vi.fn() }),
}))

function montar() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  )
}

describe('Login', () => {
  beforeEach(() => {
    sessao.erro = null
    sessao.carregando = false
    sessao.entrar.mockClear()
    localStorage.clear()
  })

  it('sem usuário lembrado: pede o usuário, avisa se vazio e segue para a senha', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Informe o usuário.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Usuário'), { target: { value: ' jmanoel ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(screen.getByText('Olá, jmanoel')).toBeTruthy()
    expect(sessao.entrar).not.toHaveBeenCalled()
  })

  it('com usuário lembrado: abre direto na senha e não envia senha vazia', () => {
    localStorage.setItem('hotnet-tecnico-usuario-lembrado', 'jmanoel')
    montar()
    expect(screen.getByText('Olá, jmanoel')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByText('Informe a senha.')).toBeTruthy()
    expect(sessao.entrar).not.toHaveBeenCalled()
  })

  it('trocar usuário volta para a etapa do usuário', () => {
    localStorage.setItem('hotnet-tecnico-usuario-lembrado', 'jmanoel')
    montar()
    fireEvent.click(screen.getByRole('button', { name: /Trocar usuário/ }))
    expect(screen.getByLabelText('Usuário')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeTruthy()
  })

  it('envia usuário e senha', () => {
    localStorage.setItem('hotnet-tecnico-usuario-lembrado', 'jmanoel')
    montar()
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(sessao.entrar).toHaveBeenCalledWith('jmanoel', 'segredo')
  })

  it('erro de login em caixa, e some quando o técnico corrige', () => {
    localStorage.setItem('hotnet-tecnico-usuario-lembrado', 'jmanoel')
    sessao.erro = 'Usuário ou senha incorretos.'
    montar()
    expect(screen.getByRole('alert').textContent).toContain('Usuário ou senha incorretos.')
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'nova' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('bloqueio por tentativas aparece como aviso de espera', () => {
    localStorage.setItem('hotnet-tecnico-usuario-lembrado', 'jmanoel')
    sessao.erro = 'Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.'
    const { container } = montar()
    expect(container.querySelector('.login-mensagem-espera')).toBeTruthy()
  })

  it('entrando: campos travados e indicador girando', () => {
    localStorage.setItem('hotnet-tecnico-usuario-lembrado', 'jmanoel')
    sessao.carregando = true
    const { container } = montar()
    expect(screen.getByRole('button', { name: /Entrando/ }).hasAttribute('disabled')).toBe(true)
    // Travado pelo fieldset (não pelo atributo do próprio campo).
    expect(container.querySelector('#senha')!.matches(':disabled')).toBe(true)
    expect(container.querySelector('.login-girando')).toBeTruthy()
  })

  it('usuário sem maiúscula automática nem correção do teclado', () => {
    const { container } = montar()
    const campo = container.querySelector('#usuario')!
    expect(campo.getAttribute('autocapitalize')).toBe('none')
    expect(campo.getAttribute('autocorrect')).toBe('off')
    expect(campo.getAttribute('spellcheck')).toBe('false')
  })

  it('iniciais do usuário', () => {
    expect(iniciaisUsuario('jmanoel')).toBe('JM')
    expect(iniciaisUsuario('a.b')).toBe('AB')
    expect(iniciaisUsuario('  ')).toBe('?')
  })
})
