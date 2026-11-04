import type { OnuDto } from '../../api/client'
import FaixaSinal, { ROTULO } from '../../components/FaixaSinal'
import { nivelSinalOnu, type NivelSinal } from '../../utils/formatacao'
import { nivelSinalOlt, TEXTO_SINAL } from './formato'

/**
 * Sinal óptico da ONU e, quando informado, o da OLT para esta ONU — num
 * cartão só, lado a lado (antes eram dois blocos grandes, um embaixo do
 * outro). O selo (Bom/Limite/Crítico) mostra o nível; os cortes de cada
 * lado são os de sempre (ONU −24/−22, OLT −27/−25).
 */
export default function CardsSinal({ onu }: { onu: OnuDto }) {
  const temOlt = onu.olt_omddm_rx_power != null || onu.olt_omddm_tx_power != null
  return (
    <div className="onu-card">
      <h2>Sinal óptico</h2>
      <div className={`onu-sinal-colunas${temOlt ? ' duas' : ''}`}>
        <ColunaSinal
          titulo="ONU"
          rx={onu.omddm_rx_power}
          tx={onu.omddm_tx_power}
          nivel={nivelSinalOnu(onu.omddm_rx_power)}
          corteCritico={-24}
          corteBom={-22}
        />
        {temOlt && (
          <ColunaSinal
            titulo="OLT"
            rx={onu.olt_omddm_rx_power}
            tx={onu.olt_omddm_tx_power}
            nivel={nivelSinalOlt(onu.olt_omddm_rx_power)}
            corteCritico={-27}
            corteBom={-25}
          />
        )}
      </div>
    </div>
  )
}

function ColunaSinal({
  titulo,
  rx,
  tx,
  nivel,
  corteCritico,
  corteBom,
}: {
  titulo: string
  rx: number | null | undefined
  tx: number | null | undefined
  nivel: NivelSinal
  corteCritico: number
  corteBom: number
}) {
  return (
    <section className="onu-sinal-coluna">
      {/* Selo na linha do título: o valor fica sozinho na linha de baixo
          e não quebra em tela estreita. */}
      <div className="onu-sinal-coluna-topo">
        <h3>
          {titulo} <small>RX</small>
        </h3>
        {rx != null && nivel !== 'desconhecida' && (
          <span className={`faixa-sinal-selo faixa-sinal-selo-${nivel}`}>{ROTULO[nivel]}</span>
        )}
      </div>
      {rx != null ? (
        <FaixaSinal compacta rx={rx} nivel={nivel} corteCritico={corteCritico} corteBom={corteBom} />
      ) : (
        <p className="onu-sinal-sem">{TEXTO_SINAL.desconhecida}</p>
      )}
      <p className="onu-sinal-tx">
        TX <strong>{tx != null ? `${tx.toLocaleString('pt-BR')} dBm` : '—'}</strong>
      </p>
    </section>
  )
}
