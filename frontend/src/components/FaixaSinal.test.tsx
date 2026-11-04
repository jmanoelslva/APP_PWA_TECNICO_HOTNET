import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FaixaSinal, { posicaoNaFaixa } from './FaixaSinal'

describe('posicaoNaFaixa', () => {
  it('converte dBm em porcentagem da escala -30 a -8', () => {
    expect(posicaoNaFaixa(-30)).toBe(0)
    expect(posicaoNaFaixa(-8)).toBe(100)
    expect(posicaoNaFaixa(-19)).toBe(50)
  })

  it('prende o marcador nas pontas', () => {
    expect(posicaoNaFaixa(-40)).toBe(0)
    expect(posicaoNaFaixa(-2)).toBe(100)
  })
})

describe('FaixaSinal', () => {
  it('mostra valor e selo do nível', () => {
    render(<FaixaSinal rx={-23.5} nivel="alerta" corteCritico={-24} corteBom={-22} />)
    expect(screen.getByText('Limite')).toBeTruthy()
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('Sinal -23,5 dBm, limite')
  })

  it('não aparece sem leitura', () => {
    const { container } = render(<FaixaSinal rx={null} nivel="desconhecida" corteCritico={-24} corteBom={-22} />)
    expect(container.firstChild).toBeNull()
  })
})
