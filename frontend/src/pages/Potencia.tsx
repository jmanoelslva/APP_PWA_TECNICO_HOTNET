import { useState } from 'react'
import { LuCalculator } from 'react-icons/lu'
import CabecalhoTela from '../components/CabecalhoTela'
import { CORES } from '../utils/cores'
import { TEXTO_SINAL_ONU } from '../utils/formatacao'
import { PERDA_CONECTOR, PERDA_EMENDA, PERDA_KM_1490, PERDA_SPLITTER, calcularPotencia } from '../utils/potenciaOptica'
import './Potencia.css'

const OPCOES_SPLITTER = Object.keys(PERDA_SPLITTER)

/** "−21,5" / "-21.5" / "" → número ou null. */
function numero(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.').replace('−', '-')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

function db(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}

/** Calculadora de potência óptica: sinal esperado na ONU pelo caminho da fibra. */
export default function Potencia() {
  const [potencia, setPotencia] = useState('3')
  const [splitter1, setSplitter1] = useState('1:8')
  const [splitter2, setSplitter2] = useState('1:8')
  const [distancia, setDistancia] = useState('1')
  const [conectores, setConectores] = useState('4')
  const [emendas, setEmendas] = useState('2')
  const [lido, setLido] = useState('')

  const r = calcularPotencia({
    potenciaOlt: numero(potencia) ?? 0,
    splitters: [splitter1, splitter2].filter(Boolean),
    distanciaKm: Math.max(0, numero(distancia) ?? 0),
    conectores: Math.max(0, Math.round(numero(conectores) ?? 0)),
    emendas: Math.max(0, Math.round(numero(emendas) ?? 0)),
    lido: numero(lido),
  })

  return (
    <div className="potencia-tela tela-entrada">
      <CabecalhoTela icone={LuCalculator} cor={CORES.ferramentas} titulo="Potência óptica" />

      <div className="potencia-card">
        <h2>Caminho da fibra</h2>
        <label className="potencia-campo">
          <span>Potência da porta PON (dBm)</span>
          <input className="campo" inputMode="decimal" value={potencia} onChange={(e) => setPotencia(e.target.value)} />
        </label>
        <div className="potencia-par">
          <label className="potencia-campo">
            <span>Splitter 1</span>
            <select className="campo" value={splitter1} onChange={(e) => setSplitter1(e.target.value)}>
              <option value="">Nenhum</option>
              {OPCOES_SPLITTER.map((s) => (
                <option key={s} value={s}>
                  {s} · {db(PERDA_SPLITTER[s])} dB
                </option>
              ))}
            </select>
          </label>
          <label className="potencia-campo">
            <span>Splitter 2</span>
            <select className="campo" value={splitter2} onChange={(e) => setSplitter2(e.target.value)}>
              <option value="">Nenhum</option>
              {OPCOES_SPLITTER.map((s) => (
                <option key={s} value={s}>
                  {s} · {db(PERDA_SPLITTER[s])} dB
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="potencia-trio">
          <label className="potencia-campo">
            <span>Distância (km)</span>
            <input className="campo" inputMode="decimal" value={distancia} onChange={(e) => setDistancia(e.target.value)} />
          </label>
          <label className="potencia-campo">
            <span>Conectores</span>
            <input className="campo" inputMode="numeric" value={conectores} onChange={(e) => setConectores(e.target.value)} />
          </label>
          <label className="potencia-campo">
            <span>Emendas</span>
            <input className="campo" inputMode="numeric" value={emendas} onChange={(e) => setEmendas(e.target.value)} />
          </label>
        </div>
        <p className="potencia-nota">
          Referência: fibra {db(PERDA_KM_1490)} dB/km (1490 nm), conector {db(PERDA_CONECTOR)} dB, emenda {db(PERDA_EMENDA)} dB.
        </p>
      </div>

      <div className={`potencia-card potencia-resultado potencia-${r.nivel}`} aria-live="polite">
        <span className="potencia-resultado-rotulo">Sinal esperado na ONU</span>
        <strong className="potencia-resultado-valor">{db(r.esperado)} dBm</strong>
        <span className="potencia-resultado-nivel">{TEXTO_SINAL_ONU[r.nivel]}</span>
        <ul className="potencia-perdas">
          {r.perdas.map((p) => (
            <li key={p.rotulo}>
              <span>{p.rotulo}</span>
              <span>−{db(p.db)} dB</span>
            </li>
          ))}
          <li className="potencia-perdas-total">
            <span>Perda total</span>
            <span>−{db(r.perdaTotal)} dB</span>
          </li>
        </ul>
      </div>

      <div className="potencia-card">
        <h2>Comparar com o sinal lido</h2>
        <label className="potencia-campo">
          <span>Sinal na ONU (dBm)</span>
          <input
            className="campo"
            inputMode="decimal"
            placeholder="ex.: -21,5"
            value={lido}
            onChange={(e) => setLido(e.target.value)}
          />
        </label>
        {r.diferenca != null && (
          <p className={`potencia-aviso${r.diferenca <= -3 ? ' potencia-aviso-ruim' : ''}`}>
            Diferença: {r.diferenca > 0 ? '+' : ''}
            {db(r.diferenca)} dB. {r.aviso}
          </p>
        )}
      </div>
    </div>
  )
}
