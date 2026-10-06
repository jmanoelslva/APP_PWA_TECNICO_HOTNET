import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'

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
  })

  it('não envia com campo vazio e avisa no próprio campo', () => {
    montar()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByText('Informe o usuário.')).toBeTruthy()
    expect(screen.getByText('Informe a senha.')).toBeTruthy()
    expect(sessao.entrar).not.toHaveBeenCalled()
  })

  it('erro de login em caixa, e some quando o técnico corrige', () => {
    sessao.erro = 'Usuário ou senha incorretos.'
    montar()
    expect(screen.getByRole('alert').textContent).toContain('Usuário ou senha incorretos.')
    fireEvent.change(screen.getByLabelText(/Senha/), { target: { value: 'nova' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('bloqueio por tentativas aparece como aviso de espera', () => {
    sessao.erro = 'Muitas tentativas erradas. Aguarde 15 minutos e tente de novo.'
    const { container } = montar()
    expect(container.querySelector('.login-mensagem-espera')).toBeTruthy()
  })

  it('entrando: campos travados e indicador girando', () => {
    sessao.carregando = true
    const { container } = montar()
    expect(screen.getByRole('button', { name: /Entrando/ }).hasAttribute('disabled')).toBe(true)
    // Travado pelo fieldset (não pelo atributo do próprio campo).
    expect(container.querySelector('#usuario')!.matches(':disabled')).toBe(true)
    expect(container.querySelector('.login-girando')).toBeTruthy()
  })

  it('usuário sem maiúscula automática nem correção do teclado', () => {
    const { container } = montar()
    const campo = container.querySelector('#usuario')!
    expect(campo.getAttribute('autocapitalize')).toBe('none')
    expect(campo.getAttribute('autocorrect')).toBe('off')
    expect(campo.getAttribute('spellcheck')).toBe('false')
  })
})
