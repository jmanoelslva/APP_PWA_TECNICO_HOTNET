import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import Abas, { lerAbaSalva, useAbaLembrada, type Aba } from './Abas'

type Chave = 'um' | 'dois'
const ABAS: Aba<Chave>[] = [
  { chave: 'um', rotulo: 'Um' },
  { chave: 'dois', rotulo: 'Dois' },
]

function Tela() {
  const [aba, escolher] = useAbaLembrada('teste-aba', ABAS)
  return (
    <>
      <Abas abas={ABAS} ativa={aba} onEscolher={escolher} cor="red" rotulo="Partes" />
      <p>{aba}</p>
    </>
  )
}

describe('Abas', () => {
  beforeEach(() => sessionStorage.clear())

  it('começa na primeira aba e ignora valor salvo inválido', () => {
    sessionStorage.setItem('teste-aba', 'tres')
    expect(lerAbaSalva('teste-aba', ABAS)).toBe('um')
  })

  it('troca de aba e lembra a escolha', () => {
    const { unmount } = render(<Tela />)
    fireEvent.click(screen.getByRole('tab', { name: 'Dois' }))
    expect(screen.getByRole('tab', { name: 'Dois' }).getAttribute('aria-selected')).toBe('true')
    unmount()
    render(<Tela />)
    expect(screen.getByText('dois')).toBeTruthy()
  })
})
