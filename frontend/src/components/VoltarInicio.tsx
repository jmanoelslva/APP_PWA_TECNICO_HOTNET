import type { MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MdArrowBack } from 'react-icons/md'
import { marcarVoltar } from '../utils/sentidoTransicao'
import './VoltarInicio.css'

interface Props {
  /** Para onde ir quando a tela foi aberta direto (link, aviso), sem tela anterior no app. */
  to?: string
  label?: string
}

/**
 * Barra fixa no topo das telas internas, com a seta de voltar — como num app
 * nativo, volta para a tela de onde o técnico veio; sem tela anterior no
 * app, vai para `to`.
 */
export default function VoltarInicio({ to = '/', label = 'Voltar' }: Props) {
  const navigate = useNavigate()

  function aoClicar(evento: MouseEvent<HTMLAnchorElement>) {
    marcarVoltar()
    // O React Router guarda a posição no histórico em history.state.idx.
    const posicao = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (posicao > 0) {
      evento.preventDefault()
      navigate(-1)
    }
  }

  return (
    <div className="barra-topo">
      <Link to={to} className="voltar-inicio" viewTransition onClick={aoClicar}>
        <MdArrowBack size={24} aria-hidden="true" />
        <span>{label}</span>
      </Link>
    </div>
  )
}
