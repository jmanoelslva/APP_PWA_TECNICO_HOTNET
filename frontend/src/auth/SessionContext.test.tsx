import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useSessao } from './useSessao'
import { SessionProvider } from './SessionContext'

let ouvinteExpirou: (() => void) | null = null
const logout = vi.fn(async () => ({ success: true }))
const removerAvisos = vi.fn()

vi.mock('../components/Toast/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('../api/client', () => ({
  buscarTecnicoAtual: vi.fn(async () => ({ username: 'anderson', user_pk: 1 })),
  login: vi.fn(),
  logout: () => logout(),
  removerAvisos: (...args: unknown[]) => removerAvisos(...args),
  aoExpirarSessao: (f: (() => void) | null) => {
    ouvinteExpirou = f
  },
}))

let sessao: ReturnType<typeof useSessao>
function Espia() {
  sessao = useSessao()
  return null
}

async function montar() {
  await act(async () => {
    render(
      <SessionProvider>
        <Espia />
      </SessionProvider>,
    )
  })
  expect(sessao.logado).toBe(true)
}

describe('sair não desliga os avisos de OS', () => {
  it('"Sair" encerra a sessão e mantém os avisos neste celular', async () => {
    await montar()
    await act(() => sessao.sair())
    expect(logout).toHaveBeenCalledTimes(1)
    expect(sessao.logado).toBe(false)
    expect(removerAvisos).not.toHaveBeenCalled()
  })

  it('sessão expirada também mantém os avisos', async () => {
    await montar()
    await act(async () => ouvinteExpirou?.())
    expect(sessao.logado).toBe(false)
    expect(removerAvisos).not.toHaveBeenCalled()
  })
})
