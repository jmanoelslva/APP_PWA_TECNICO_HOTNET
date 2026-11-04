import { TEXTO_STATUS_CLIENTE, type StatusCliente } from '../utils/statusCliente'
import './SeloStatusCliente.css'

/** Selo único de status do cliente: online, offline, bloqueado ou sem conexão. */
export default function SeloStatusCliente({ status }: { status: StatusCliente }) {
  return (
    <span className={`selo-status-cliente selo-${status}`} role="status">
      <span className="selo-status-ponto" aria-hidden="true" />
      {TEXTO_STATUS_CLIENTE[status]}
    </span>
  )
}
