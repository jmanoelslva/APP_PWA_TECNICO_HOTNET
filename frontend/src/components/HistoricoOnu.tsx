import { useMemo, useState, type PointerEvent } from 'react'
import { MdHistory, MdWarningAmber } from 'react-icons/md'
import type { HistoricoOnuDto } from '../api/client'
import type { EstadoHistorico } from '../hooks/useHistoricoOnu'
import Skeleton from './Skeleton'
import { agruparQuedas, classeQueda, dataHora, duracao, motivoCurto, resumirQuedas, voltaTexto } from '../utils/coletor'
import './HistoricoOnu.css'

/**
 * Histórico da ONU vindo do Coletor de OLTs (projeto COLETA-OLT): gráfico do
 * sinal, quedas com motivo e hora e situação da PON — o que o Controllr não
 * guarda. O sinal atual fica nos cartões ONU/OLT da tela (mesma fonte); aqui
 * só a evolução. Não aparece quando o coletor não está configurado.
 */

const PERIODOS = [
  { horas: 24, rotulo: '24 h' },
  { horas: 72, rotulo: '3 dias' },
  { horas: 24 * 7, rotulo: '7 dias' },
  { horas: 24 * 30, rotulo: '30 dias' },
]

// Mais que isso sem leitura = buraco na linha (OLT sem coleta ou ONU offline).
const BURACO_MS = 50 * 60 * 1000
// Muitas ONUs da mesma PON caindo juntas = problema da rede, não do cliente.
export const PON_CAIDA_MINIMO = 3

export default function HistoricoOnu({
  estado,
  horas,
  onHoras,
}: {
  estado: EstadoHistorico
  horas: number
  onHoras: (horas: number) => void
}) {
  const [todasQuedas, setTodasQuedas] = useState(false)
  if (estado.tipo === 'indisponivel') return null

  return (
    <section className="onu-card historico-onu" aria-label="Histórico da ONU">
      <div className="historico-cabecalho">
        <h2>
          <MdHistory size={16} /> Histórico na OLT
        </h2>
        <div className="historico-periodos" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.horas}
              type="button"
              className={p.horas === horas ? 'ativo' : ''}
              onClick={() => onHoras(p.horas)}
              aria-pressed={p.horas === horas}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      {estado.tipo === 'carregando' && (
        <>
          <Skeleton width="100%" height={140} />
          <Skeleton width="60%" height={13} />
        </>
      )}
      {estado.tipo === 'fora' && <p className="historico-aviso-texto">Esta ONU não aparece nas OLTs acompanhadas pelo coletor.</p>}
      {estado.tipo === 'erro' && <p className="historico-aviso-texto">{estado.mensagem}</p>}
      {estado.tipo === 'ok' && (
        <Conteudo
          dados={estado.dados}
          agora={estado.agora}
          horas={horas}
          todasQuedas={todasQuedas}
          onTodasQuedas={() => setTodasQuedas(true)}
        />
      )}
    </section>
  )
}

function Conteudo({
  dados,
  agora,
  horas,
  todasQuedas,
  onTodasQuedas,
}: {
  dados: HistoricoOnuDto
  agora: number
  horas: number
  todasQuedas: boolean
  onTodasQuedas: () => void
}) {
  const { onu, pon, quedas, alarmes_ativos: alarmes } = dados
  const ponCaiu = pon.caidas_15min >= PON_CAIDA_MINIMO
  const ponSemLink = pon.link === 'down'
  const resumo = resumirQuedas(quedas)
  const grupos = agruparQuedas(quedas)
  const visiveis = todasQuedas ? grupos : grupos.slice(0, 5)
  const trocada = Date.parse(dados.historico_desde) > agora - horas * 3600_000 + 60_000

  return (
    <>
      {(ponCaiu || ponSemLink) && (
        <div className="historico-alerta historico-alerta-rede">
          <MdWarningAmber size={18} />
          <span>
            {ponSemLink
              ? `A PON ${pon.porta} está sem link na OLT.`
              : `${pon.caidas_15min} ONUs da PON ${pon.porta} caíram nos últimos 15 minutos.`}{' '}
            Provável problema na rede, não no cliente.
          </span>
        </div>
      )}
      {onu.alertas?.length > 0 && (
        <ul className="historico-alertas">
          {onu.alertas.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}

      <GraficoSinal dados={dados} agora={agora} horas={horas} />
      {trocada && (
        <p className="historico-nota">Esta ONU está nesta posição desde {dataHora(dados.historico_desde)}: o histórico começa ali.</p>
      )}

      <div className="historico-pon">
        <span>
          {dados.olt.nome} · PON {pon.porta} · posição {onu.onu_id}
        </span>
        <strong>
          {pon.online} de {pon.total} online
        </strong>
      </div>

      <h3 className="historico-subtitulo">Quedas{resumo && <small> — {resumo}</small>}</h3>
      {quedas.length === 0 ? (
        <p className="historico-aviso-texto">Nenhuma queda registrada no período.</p>
      ) : (
        <ul className="historico-quedas">
          {visiveis.map(({ q, n, primeira }, i) => (
            <li key={`${q.caiu_em}-${i}`} className={`queda-${classeQueda(q)}`}>
              <div>
                <strong>
                  {motivoCurto(q.motivo)}
                  {n > 1 && <span className="queda-vezes"> ×{n}</span>}
                </strong>
                <span>
                  {n > 1
                    ? `Oscilou ${n} vezes em ${duracao(Math.max(60, (Date.parse(q.caiu_em) - Date.parse(primeira)) / 1000))}`
                    : voltaTexto(q, i === 0 && !onu.online)}
                </span>
              </div>
              <time dateTime={q.caiu_em}>
                {dataHora(q.caiu_em)}
                {q.hora_estimada && <small> (aprox.)</small>}
              </time>
            </li>
          ))}
        </ul>
      )}
      {!todasQuedas && grupos.length > 5 && (
        <button type="button" className="historico-ver-mais" onClick={onTodasQuedas}>
          Ver todas ({grupos.length})
        </button>
      )}

      {alarmes.length > 0 && (
        <>
          <h3 className="historico-subtitulo">Alarmes ativos agora</h3>
          <ul className="historico-alarmes">
            {alarmes.map((a, i) => (
              <li key={i}>
                {a.rotulo}
                <small> desde {a.data_utc ? dataHora(a.data_utc) : a.data_olt}</small>
              </li>
            ))}
          </ul>
        </>
      )}

    </>
  )
}

// ------------------------------------------------------------------ gráfico

type Serie = { nome: string; classe: string; pontos: { t: number; v: number | null }[] }

const L = 320
const A = 150
const MARGEM = { esq: 30, dir: 6, topo: 8, base: 18 }

function GraficoSinal({ dados, agora, horas }: { dados: HistoricoOnuDto; agora: number; horas: number }) {
  const [cursor, setCursor] = useState<number | null>(null)
  const lim = dados.limites
  const series: Serie[] = useMemo(
    () => [
      { nome: 'RX ONU', classe: 'serie-rx', pontos: dados.sinais.onu.map((p) => ({ t: Date.parse(p.coletado_em), v: p.rx })) },
      { nome: 'RX OLT', classe: 'serie-rx-olt', pontos: dados.sinais.olt.map((p) => ({ t: Date.parse(p.coletado_em), v: p.rx_olt })) },
    ],
    [dados],
  )
  const tx = dados.sinais.onu.map((p) => p.tx).filter((v): v is number => v != null)

  const fim = agora
  const inicio = Math.max(fim - horas * 3600_000, Date.parse(dados.historico_desde) || 0)
  const valores = series.flatMap((s) => s.pontos.map((p) => p.v)).filter((v): v is number => v != null)
  if (valores.length === 0) {
    return <p className="historico-aviso-texto">Sem leituras de sinal no período (ONU offline ou ainda sem coleta).</p>
  }
  // Escala sempre mostra as faixas de atenção/crítico para dar referência.
  const yMax = Math.ceil(Math.max(...valores) + 1)
  const yMin = Math.floor(Math.min(...valores, (lim.rx_olt_critico ?? -28) - 1))
  const x = (t: number) => MARGEM.esq + ((t - inicio) / (fim - inicio)) * (L - MARGEM.esq - MARGEM.dir)
  const y = (v: number) => MARGEM.topo + ((yMax - v) / (yMax - yMin)) * (A - MARGEM.topo - MARGEM.base)
  const yLim = (v: number) => Math.min(Math.max(y(v), MARGEM.topo), A - MARGEM.base)

  function caminho(pontos: Serie['pontos']): string {
    let d = ''
    let anterior: number | null = null
    for (const p of pontos) {
      if (p.v == null || p.t < inicio) {
        anterior = null
        continue
      }
      const cmd = anterior == null || p.t - anterior > BURACO_MS ? 'M' : 'L'
      d += `${cmd}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`
      anterior = p.t
    }
    return d
  }

  const passoY = yMax - yMin > 16 ? 5 : 2
  const marcasY: number[] = []
  for (let v = Math.ceil(yMin / passoY) * passoY; v <= yMax; v += passoY) marcasY.push(v)
  const marcasX = [0, 0.5, 1].map((f) => inicio + f * (fim - inicio))

  function aoMover(e: PointerEvent<SVGSVGElement>) {
    const caixa = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - caixa.left) / caixa.width) * L
    const t = inicio + ((px - MARGEM.esq) / (L - MARGEM.esq - MARGEM.dir)) * (fim - inicio)
    setCursor(Math.min(Math.max(t, inicio), fim))
  }
  const proximo = (s: Serie) =>
    cursor == null
      ? null
      : s.pontos.reduce<Serie['pontos'][number] | null>(
          (m, p) => (p.v != null && (!m || Math.abs(p.t - cursor) < Math.abs(m.t - cursor)) ? p : m),
          null,
        )
  const leituras = series.map((s) => ({ s, p: proximo(s) }))

  return (
    <figure className="historico-grafico">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        role="img"
        aria-label="Gráfico do sinal recebido pela ONU e pela OLT"
        onPointerMove={aoMover}
        onPointerDown={aoMover}
        onPointerLeave={() => setCursor(null)}
      >
        {/* Limite crítico de cada lado (faixas diferentes para ONU e OLT). */}
        <line className="limite serie-rx" x1={MARGEM.esq} x2={L - MARGEM.dir}
          y1={yLim(lim.rx_onu_critico ?? -25)} y2={yLim(lim.rx_onu_critico ?? -25)} />
        <line className="limite serie-rx-olt" x1={MARGEM.esq} x2={L - MARGEM.dir}
          y1={yLim(lim.rx_olt_critico ?? -28)} y2={yLim(lim.rx_olt_critico ?? -28)} />
        {marcasY.map((v) => (
          <g key={v}>
            <line className="grade" x1={MARGEM.esq} x2={L - MARGEM.dir} y1={y(v)} y2={y(v)} />
            <text className="eixo" x={MARGEM.esq - 4} y={y(v) + 3} textAnchor="end">{v}</text>
          </g>
        ))}
        {marcasX.map((t, i) => (
          <text key={t} className="eixo" x={x(t)} y={A - 4} textAnchor={(['start', 'middle', 'end'] as const)[i]}>
            {rotuloEixo(t, horas)}
          </text>
        ))}
        {series.map((s) => (
          <path key={s.nome} className={`linha ${s.classe}`} d={caminho(s.pontos)} />
        ))}
        {cursor != null && (
          <>
            <line className="cursor" x1={x(cursor)} x2={x(cursor)} y1={MARGEM.topo} y2={A - MARGEM.base} />
            {leituras.map(({ s, p }) => p && p.v != null && (
              <circle key={s.nome} className={`ponto ${s.classe}`} cx={x(p.t)} cy={y(p.v)} r={3} />
            ))}
          </>
        )}
      </svg>
      <figcaption className="historico-legenda">
        {cursor != null ? (
          <>
            <span className="legenda-hora">{dataHora(new Date(cursor).toISOString())}</span>
            {leituras.map(({ s, p }) => (
              <span key={s.nome} className={s.classe}>
                {s.nome} {p?.v != null ? `${p.v.toFixed(1)} dBm` : '—'}
              </span>
            ))}
          </>
        ) : (
          <>
            {series.map((s) => (
              <span key={s.nome} className={s.classe}>
                {s.nome}
              </span>
            ))}
            {tx.length > 1 && Math.max(...tx) - Math.min(...tx) >= 0.5 && (
              <span className="serie-tx">
                TX ONU variou de {Math.min(...tx).toFixed(1)} a {Math.max(...tx).toFixed(1)} dBm
              </span>
            )}
            <span className="legenda-dica">Toque no gráfico para ver cada leitura</span>
          </>
        )}
      </figcaption>
    </figure>
  )
}

function rotuloEixo(t: number, horas: number): string {
  const d = new Date(t)
  return horas <= 24
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
