import { Link } from 'react-router-dom'
import { MdEdit, MdPeopleAlt, MdPersonAdd } from 'react-icons/md'
import type { OnuDto } from '../../api/client'
import { formatarUltimaQueda } from './formato'

/** Cliente, nome, serial, modelo, estado, OLT/CTO etc. da ONU. */
export default function CardDetalhesOnu({
  onu,
  ocupado,
  onRegistrarCliente,
  onRenomear,
}: {
  onu: OnuDto
  // Relendo a ONU antes de uma ação: botões de ação ficam desativados.
  ocupado: boolean
  onRegistrarCliente: () => void
  onRenomear: () => void
}) {
  const ultimaQueda = formatarUltimaQueda(onu.last_down_time)
  return (
    <div className="onu-card">
      <div className="onu-linha">
        <span>Cliente</span>
        {onu.client_pk ? (
          <Link to={`/clientes/${onu.client_pk}`} className="onu-link" viewTransition>
            <MdPeopleAlt size={14} /> {onu.client_name ?? '—'}
          </Link>
        ) : (
          <button type="button" className="onu-btn-registrar-cliente" onClick={onRegistrarCliente} disabled={ocupado}>
            <MdPersonAdd size={14} /> Registrar cliente
          </button>
        )}
      </div>
      {(onu.contract_number ?? onu.contract_pk) != null && (
        <div className="onu-linha">
          <span>Contrato</span>
          <strong>{onu.contract_number ?? onu.contract_pk}</strong>
        </div>
      )}
      <div className="onu-linha">
        <span>Nome</span>
        <div className="onu-campo-valor">
          <strong>{onu.name ?? '—'}</strong>
          <button type="button" onClick={onRenomear} disabled={ocupado} aria-label="Renomear ONU">
            <MdEdit size={16} />
          </button>
        </div>
      </div>
      <div className="onu-linha">
        <span>Serial</span>
        <strong>{onu.sn ?? '—'}</strong>
      </div>
      <div className="onu-linha">
        <span>Modelo</span>
        <strong>{onu.model ?? '—'}</strong>
      </div>
      <div className="onu-linha">
        <span>Fabricante</span>
        <strong>{onu.vendor ?? '—'}</strong>
      </div>
      <div className="onu-linha">
        <span>Estado</span>
        <strong>{onu.state ?? '—'}</strong>
      </div>
      {onu.last_down_reason && (
        <div className="onu-linha">
          <span>Motivo da última queda</span>
          <strong>{onu.last_down_reason}</strong>
        </div>
      )}
      {ultimaQueda && (
        <div className="onu-linha">
          <span>Última queda</span>
          <strong>{ultimaQueda}</strong>
        </div>
      )}
      <div className="onu-linha">
        {/* onu_distance vem em km, não metros (exemplo "0.931" da doc
            oficial só faz sentido como km para alcance de GPON). */}
        <span>Distância</span>
        <strong>{onu.distance != null ? `${onu.distance} km` : '—'}</strong>
      </div>
      <div className="onu-linha">
        <span>Temperatura</span>
        <strong>{onu.omddm_temperature != null ? `${onu.omddm_temperature} °C` : '—'}</strong>
      </div>
      <div className="onu-linha">
        <span>IP</span>
        <strong>{onu.cpe_v4_ip_last ?? '—'}</strong>
      </div>
      <div className="onu-linha">
        <span>OLT</span>
        <strong>{onu.olt_name ?? '—'}</strong>
      </div>
      <div className="onu-linha">
        <span>Splitter (DP)</span>
        <strong>{onu.dp_name ?? '—'}</strong>
      </div>
      <div className="onu-linha">
        <span>Porta da CTO</span>
        <strong>{onu.cpe_dp_port ?? '—'}</strong>
      </div>
    </div>
  )
}
