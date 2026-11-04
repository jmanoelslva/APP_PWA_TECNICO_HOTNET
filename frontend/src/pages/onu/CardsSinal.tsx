import type { OnuDto } from '../../api/client'
import FaixaSinal from '../../components/FaixaSinal'
import { nivelSinalOnu } from '../../utils/formatacao'
import { nivelSinalOlt, TEXTO_SINAL } from './formato'

/** Sinal óptico da ONU e, quando informado, o da OLT para esta ONU. */
export default function CardsSinal({ onu }: { onu: OnuDto }) {
  const statusOnu = nivelSinalOnu(onu.omddm_rx_power)
  const statusOlt = nivelSinalOlt(onu.olt_omddm_rx_power)
  return (
    <>
      <div className={`onu-card onu-sinal onu-sinal-${statusOnu}`}>
        <span className="onu-sinal-titulo">ONU — {TEXTO_SINAL[statusOnu]}</span>
        <FaixaSinal rx={onu.omddm_rx_power} nivel={statusOnu} corteCritico={-24} corteBom={-22} />
        <div className="onu-sinal-grid">
          {onu.omddm_rx_power == null && (
            <div>
              <span>RX</span>
              <strong>—</strong>
            </div>
          )}
          <div>
            <span>TX</span>
            <strong>{onu.omddm_tx_power != null ? `${onu.omddm_tx_power} dBm` : '—'}</strong>
          </div>
        </div>
      </div>

      {(onu.olt_omddm_rx_power != null || onu.olt_omddm_tx_power != null) && (
        <div className={`onu-card onu-sinal onu-sinal-${statusOlt}`}>
          <span className="onu-sinal-titulo">OLT — {TEXTO_SINAL[statusOlt]}</span>
          <FaixaSinal rx={onu.olt_omddm_rx_power} nivel={statusOlt} corteCritico={-27} corteBom={-25} />
          <div className="onu-sinal-grid">
            {onu.olt_omddm_rx_power == null && (
              <div>
                <span>RX</span>
                <strong>—</strong>
              </div>
            )}
            <div>
              <span>TX</span>
              <strong>{onu.olt_omddm_tx_power != null ? `${onu.olt_omddm_tx_power} dBm` : '—'}</strong>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
