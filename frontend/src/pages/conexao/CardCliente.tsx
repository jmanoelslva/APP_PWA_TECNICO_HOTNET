import { Link } from 'react-router-dom'
import { LuUser } from 'react-icons/lu'
import type { CpeDto } from '../../api/client'
import SeloStatusCliente from '../../components/SeloStatusCliente'
import type { StatusCliente } from '../../utils/statusCliente'

/** Cliente, contrato e plano da conexão, com o selo de status no topo. */
export default function CardCliente({ cpe, status }: { cpe: CpeDto; status: StatusCliente }) {
  return (
    <div className="conexao-card">
      <div className="conexao-selo-status">
        <SeloStatusCliente status={status} />
      </div>
      <div className="conexao-linha">
        <span>Cliente</span>
        {cpe.client_pk ? (
          <Link to={`/clientes/${cpe.client_pk}`} className="conexao-link" viewTransition>
            <LuUser size={16} /> {cpe.client_complete_name ?? '—'}
          </Link>
        ) : (
          <strong>{cpe.client_complete_name ?? '—'}</strong>
        )}
      </div>
      <div className="conexao-linha">
        <span>Contrato</span>
        {/* Sem Link de propósito — mesmo destino do link "Cliente"
            acima (/clientes/{client_pk}), então já dava para chegar
            lá clicando no nome; um segundo link redundante aqui só
            confundia. */}
        <strong>{cpe.contract_number ?? cpe.contract_pk ?? '—'}</strong>
      </div>
      <div className="conexao-linha">
        <span>Plano</span>
        <strong>{cpe.plan_name ?? '—'}</strong>
      </div>
    </div>
  )
}
