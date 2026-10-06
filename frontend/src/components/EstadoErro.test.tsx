import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EstadoErro from './EstadoErro'

describe('EstadoErro', () => {
  it('mostra a mensagem e tenta de novo ao tocar no botão', () => {
    const tentar = vi.fn()
    render(<EstadoErro mensagem="Não foi possível carregar as OS." cor="red" onTentarDeNovo={tentar} />)
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar as OS.')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(tentar).toHaveBeenCalledTimes(1)
  })
})
