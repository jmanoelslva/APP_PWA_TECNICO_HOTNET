import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function Bomba(): never {
  throw new Error('Falha de teste')
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renderiza os filhos normalmente quando não há erro', () => {
    render(
      <ErrorBoundary>
        <p>Conteúdo normal</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('Conteúdo normal')).toBeInTheDocument()
  })

  it('mostra a tela de erro em vez de derrubar o app quando um filho quebra', () => {
    render(
      <ErrorBoundary>
        <Bomba />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Ops, algo deu errado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument()
  })
})
