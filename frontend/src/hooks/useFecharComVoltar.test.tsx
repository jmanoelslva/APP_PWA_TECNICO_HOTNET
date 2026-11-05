import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFecharComVoltar } from './useFecharComVoltar'

const marcada = () => (window.history.state as { janelaAberta?: boolean } | null)?.janelaAberta === true

describe('useFecharComVoltar', () => {
  beforeEach(async () => {
    // Começa cada teste fora de qualquer entrada de janela.
    while (marcada()) {
      window.history.back()
      await new Promise((r) => setTimeout(r, 10))
    }
  })

  it('"Voltar" fecha a janela', async () => {
    const fechar = vi.fn()
    const { unmount } = renderHook(() => useFecharComVoltar(true, fechar))
    expect(marcada()).toBe(true)
    act(() => window.history.back())
    await waitFor(() => expect(fechar).toHaveBeenCalledTimes(1))
    unmount()
  })

  it('fechar pelo botão tira a entrada do histórico', async () => {
    const fechar = vi.fn()
    const { rerender } = renderHook(({ aberto }) => useFecharComVoltar(aberto, fechar), {
      initialProps: { aberto: true },
    })
    expect(marcada()).toBe(true)
    rerender({ aberto: false })
    await waitFor(() => expect(marcada()).toBe(false))
    expect(fechar).not.toHaveBeenCalled()
  })

  it('uma janela fecha e outra abre em seguida: a nova continua aberta', async () => {
    const fecharPrimeira = vi.fn()
    const fecharSegunda = vi.fn()
    const { rerender } = renderHook(
      ({ primeira }) => {
        useFecharComVoltar(primeira, fecharPrimeira)
        useFecharComVoltar(!primeira, fecharSegunda)
      },
      { initialProps: { primeira: true } },
    )
    rerender({ primeira: false })
    await new Promise((r) => setTimeout(r, 30))
    expect(marcada()).toBe(true)
    expect(fecharSegunda).not.toHaveBeenCalled()
    act(() => window.history.back())
    await waitFor(() => expect(fecharSegunda).toHaveBeenCalledTimes(1))
    expect(fecharPrimeira).not.toHaveBeenCalled()
  })

  it('janela sobre janela: "Voltar" fecha só a de cima', async () => {
    const fecharBaixo = vi.fn()
    const fecharCima = vi.fn()
    renderHook(() => useFecharComVoltar(true, fecharBaixo))
    renderHook(() => useFecharComVoltar(true, fecharCima))
    act(() => window.history.back())
    await waitFor(() => expect(fecharCima).toHaveBeenCalledTimes(1))
    expect(fecharBaixo).not.toHaveBeenCalled()
    expect(marcada()).toBe(true)
  })
})
