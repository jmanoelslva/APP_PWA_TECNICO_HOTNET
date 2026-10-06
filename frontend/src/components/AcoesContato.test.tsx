import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AcoesContato from './AcoesContato'

describe('AcoesContato', () => {
  it('um celular: Ligar e WhatsApp', () => {
    render(<AcoesContato numero="(79) 99988-7766" />)
    expect(screen.getByRole('link', { name: 'Ligar' }).getAttribute('href')).toBe('tel:79999887766')
    expect(screen.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toBe('https://wa.me/5579999887766')
  })

  it('fixo e celular no mesmo campo: WhatsApp no celular, mesmo sendo o segundo', () => {
    render(<AcoesContato numero="7932221100 / 79999887766" />)
    expect(screen.getAllByRole('link', { name: /^Ligar/ })).toHaveLength(2)
    const whatsapp = screen.getAllByRole('link', { name: /^WhatsApp/ })
    expect(whatsapp).toHaveLength(1)
    expect(whatsapp[0].getAttribute('aria-label')).toBe('WhatsApp (79) 99988-7766')
  })

  it('sem número: nada', () => {
    const { container } = render(<AcoesContato numero="-" />)
    expect(container.innerHTML).toBe('')
  })
})
