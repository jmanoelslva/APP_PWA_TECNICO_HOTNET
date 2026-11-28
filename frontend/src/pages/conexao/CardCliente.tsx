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
        {/* Abrir o cliente: barra do atendimento, no topo. */}
        <strong>{cpe.client_complete_name ?? '—'}</strong>
      </div>
      <div className="conexao-linha">
        <span>Contrato</span>
        <strong>{cpe.contract_number ?? cpe.contract_pk ?? '—'}</strong>
      </div>
      <div className="conexao-linha">
        <span>Plano</span>
        <strong>{cpe.plan_name ?? '—'}</strong>
      </div>
    </div>
  )
}
