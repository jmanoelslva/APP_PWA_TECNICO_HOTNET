import type { NivelSinal } from '../utils/formatacao'
import './FaixaSinal.css'

// Escala da barra (dBm): abaixo de -30 ou acima de -8 o marcador fica na ponta.
export const ESCALA_MIN = -30
export const ESCALA_MAX = -8

/** Posição (0–100%) do valor na barra, presa às pontas. */
export function posicaoNaFaixa(rx: number): number {
  const relativo = (rx - ESCALA_MIN) / (ESCALA_MAX - ESCALA_MIN)
  return Math.round(Math.min(1, Math.max(0, relativo)) * 1000) / 10
}

export const ROTULO: Record<Exclude<NivelSinal, 'desconhecida'>, string> = {
  boa: 'Bom',
  alerta: 'Limite',
  critica: 'Crítico',
}

/**
 * Sinal óptico (RX) numa barra vermelho/amarelo/verde com marcador, para
 * ler de relance. Os cortes vêm de quem chama — ONU e OLT têm faixas
 * diferentes (nivelSinalOnu em utils/formatacao.ts, nivelSinalOlt em
 * pages/onu/formato.ts) — e o nível também, para nunca divergir do texto.
 */
export default function FaixaSinal({
  rx,
  nivel,
  corteCritico,
  corteBom,
  compacta = false,
}: {
  rx: number | null | undefined
  nivel: NivelSinal
  /** Abaixo disto é crítico (ex.: -24 na ONU). */
  corteCritico: number
  /** A partir disto é bom (ex.: -22 na ONU). */
  corteBom: number
  /** Versão menor, sem escala e sem selo (quem usa mostra o selo no título),
   *  para caber lado a lado na tela da ONU sem quebrar linha. */
  compacta?: boolean
}) {
  if (rx == null || nivel === 'desconhecida') return null
  const critico = posicaoNaFaixa(corteCritico)
  const bom = posicaoNaFaixa(corteBom)
  return (
    <div className={`faixa-sinal${compacta ? ' faixa-sinal-compacta' : ''}`}>
      <div className="faixa-sinal-topo">
        <strong className="faixa-sinal-valor">
          {rx.toLocaleString('pt-BR')} <small>dBm</small>
        </strong>
        {!compacta && <span className={`faixa-sinal-selo faixa-sinal-selo-${nivel}`}>{ROTULO[nivel]}</span>}
      </div>
      <div
        className="faixa-sinal-barra"
        role="img"
        aria-label={`Sinal ${rx.toLocaleString('pt-BR')} dBm, ${ROTULO[nivel].toLowerCase()}`}
      >
        <span className="faixa-sinal-trecho faixa-sinal-critica" style={{ width: `${critico}%` }} />
        <span className="faixa-sinal-trecho faixa-sinal-alerta" style={{ width: `${bom - critico}%` }} />
        <span className="faixa-sinal-trecho faixa-sinal-boa" style={{ width: `${100 - bom}%` }} />
        <span className="faixa-sinal-marcador" style={{ left: `${posicaoNaFaixa(rx)}%` }} />
      </div>
      {!compacta && (
        <div className="faixa-sinal-escala" aria-hidden="true">
          <span>{ESCALA_MIN}</span>
          <span>{ESCALA_MAX}</span>
        </div>
      )}
    </div>
  )
}
