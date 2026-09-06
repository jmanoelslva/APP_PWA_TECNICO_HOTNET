import { Link } from 'react-router-dom'
import { MdArrowBack } from 'react-icons/md'
import './VoltarInicio.css'

interface Props {
  to?: string
  label?: string
}

/** Link de volta — usado no topo das telas internas. */
export default function VoltarInicio({ to = '/', label = 'Início' }: Props) {
  return (
    <Link to={to} className="voltar-inicio" viewTransition>
      <MdArrowBack size={16} />
      {label}
    </Link>
  )
}
