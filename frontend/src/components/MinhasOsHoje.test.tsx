import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import MinhasOsHoje from './MinhasOsHoje'

const telefone = { valor: '79999887766' }

function hojeAs(hora: string): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${hora}`
}

vi.mock('../api/client', () => ({
  listarOrdensServico: vi.fn(async () => ({
    success: true,
    total: 1,
    results: [{ op_pk: 1, ticket_pk: 10, client_pk: 5, task_name: 'Instalação', op_date_sched: hojeAs('23:59:00') }],
  })),
  buscarDetalheCliente: vi.fn(async () => ({
    success: true,
    cliente: {},
    contratos: [],
    enderecos: [],
    cpes: [],
    telefones: [{ phone_number: telefone.valor }],
  })),
}))

function montar() {
  render(
    <MemoryRouter>
      <MinhasOsHoje />
    </MemoryRouter>,
  )
}

describe('próxima OS do dia', () => {
  it('celular do cliente: Ligar e WhatsApp', async () => {
    telefone.valor = '79999887766'
    montar()
    const whatsapp = await screen.findByRole('link', { name: 'WhatsApp' })
    expect(whatsapp.getAttribute('href')).toBe('https://wa.me/5579999887766')
    expect(screen.getByRole('link', { name: /Ligar/ }).getAttribute('href')).toBe('tel:79999887766')
  })

  it('fixo primeiro e celular depois: Ligar no fixo, WhatsApp no celular', async () => {
    telefone.valor = '7932221100 / 79999887766'
    montar()
    const whatsapp = await screen.findByRole('link', { name: 'WhatsApp' })
    expect(whatsapp.getAttribute('href')).toBe('https://wa.me/5579999887766')
    expect(screen.getByRole('link', { name: /Ligar/ }).getAttribute('href')).toBe('tel:7932221100')
  })

  it('telefone fixo: só Ligar', async () => {
    telefone.valor = '7932221100'
    montar()
    await screen.findByRole('link', { name: /Ligar/ })
    await waitFor(() => expect(screen.queryByRole('link', { name: 'WhatsApp' })).toBeNull())
  })
})
