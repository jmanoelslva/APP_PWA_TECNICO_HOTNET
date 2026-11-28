import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import BarraAtendimento from './BarraAtendimento'
import { ToastProvider } from './Toast/ToastContext'

const ATENDIMENTO = { clientPk: 5, cliente: 'Ana Ribeiro', cpePk: 70, pppoe: 'ana', em: Date.now() }

function montar(dados: Parameters<typeof BarraAtendimento>[0]['dados']) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <BarraAtendimento tela="onu" dados={dados} />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('BarraAtendimento', () => {
  beforeEach(() => {
    localStorage.setItem('hotnet-tecnico-atendimento', JSON.stringify(ATENDIMENTO))
  })

  it('ONU não encontrada (só o PPPoE do endereço): a barra continua com as cinco telas', () => {
    montar({ pppoe: 'ana' })
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('PPPoE de outro cliente: não mostra o atendimento anterior', () => {
    montar({ pppoe: 'bruno' })
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
