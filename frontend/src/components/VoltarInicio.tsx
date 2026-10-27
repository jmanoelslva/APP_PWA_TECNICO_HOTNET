import { Link } from 'react-router-dom'
import { MdArrowBack } from 'react-icons/md'
import { marcarVoltar } from '../utils/sentidoTransicao'
import './VoltarInicio.css'

interface Props {
  to?: string
  label?: string
}

/** Link de volta — usado no topo das telas internas. */
export default function VoltarInicio({ to = '/', label = 'Início' }: Props) {
  return (
    <Link to={to} className="voltar-inicio" viewTransition onClick={marcarVoltar}>
      <MdArrowBack size={16} />
      {label}
    </Link>
  )
}
