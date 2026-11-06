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

  it('extra (Editar) vai na linha do último número, uma vez só', () => {
    render(<AcoesContato numero="7932221100 / 79999887766" extra={<button>Editar</button>} />)
    const editar = screen.getAllByRole('button', { name: 'Editar' })
    expect(editar).toHaveLength(1)
    expect(editar[0].parentElement?.querySelector('a[aria-label="WhatsApp (79) 99988-7766"]')).not.toBeNull()
  })

  it('sem número, mas com extra: mostra só o extra', () => {
    render(<AcoesContato numero="" extra={<button>Editar</button>} />)
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
