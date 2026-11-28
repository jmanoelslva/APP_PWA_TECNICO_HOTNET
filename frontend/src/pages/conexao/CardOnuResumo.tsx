import type { OnuDto } from '../../api/client'
import FaixaSinal from '../../components/FaixaSinal'
import Skeleton from '../../components/Skeleton'
import { nivelSinalOnu } from '../../utils/formatacao'

/**
 * Resumo da ONU vinculada ao cliente (se tiver) — buscada pelo usuário
 * PPPoE, jeito confiável já usado na tela de ONU (ver CONTROLLR_API_NOTES.md:
 * cpe_pk sozinho é ambíguo em /fiber_ctl/onu/list). Sem ONU, nada aparece.
 */
export default function CardOnuResumo({
  onu,
  carregando,
}: {
  onu: OnuDto | null
  carregando: boolean
}) {
  if (carregando) {
    return (
      <div className="conexao-card">
        <h2>ONU</h2>
        <Skeleton width="60%" height={14} />
      </div>
    )
  }
  if (!onu) return null
  return (
    <div className="conexao-card">
      <div className="conexao-sessao-topo">
        {/* Detalhes da ONU: barra do atendimento, no topo. */}
        <h2>ONU</h2>
      </div>
      <div className="conexao-linha">
        <span>Estado</span>
        <strong>{onu.state ?? '—'}</strong>
      </div>
      {onu.omddm_rx_power != null ? (
        <FaixaSinal rx={onu.omddm_rx_power} nivel={nivelSinalOnu(onu.omddm_rx_power)} corteCritico={-24} corteBom={-22} />
      ) : (
        <div className="conexao-linha">
          <span>Sinal RX</span>
          <strong>—</strong>
        </div>
      )}
      <div className="conexao-linha">
        <span>Modelo</span>
        <strong>{onu.model ?? '—'}</strong>
      </div>
    </div>
  )
}
