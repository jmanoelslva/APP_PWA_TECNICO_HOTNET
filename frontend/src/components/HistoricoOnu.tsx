import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react'
import { MdHistory, MdRefresh, MdWarningAmber } from 'react-icons/md'
import { ApiError, historicoOnu, lerOnuNaOlt, type HistoricoOnuDto, type QuedaOnu } from '../api/client'
import { useToast } from './Toast/useToast'
import Skeleton from './Skeleton'
import { CORES } from '../utils/cores'
import './HistoricoOnu.css'

/**
 * Histórico da ONU vindo do Coletor de OLTs (projeto COLETA-OLT): gráfico do
 * sinal, quedas com motivo e hora e situação da PON — o que o Controllr não
 * guarda. Some sozinho quando o coletor não está configurado neste servidor
 * (503); ONU fora das OLTs coletadas (404) mostra só um aviso curto.
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
const PON_CAIDA_MINIMO = 3

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'oculto' }
  | { tipo: 'fora'; mensagem: string }
  | { tipo: 'erro'; mensagem: string }
  // agora: hora da resposta — referência do gráfico ("últimas N horas") e do "há X min".
  | { tipo: 'ok'; dados: HistoricoOnuDto; agora: number }

export default function HistoricoOnu({ sn }: { sn: string }) {
  const [horas, setHoras] = useState(72)
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' })
  const [lendo, setLendo] = useState(false)
  const [todasQuedas, setTodasQuedas] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    let cancelado = false
    setEstado((atual) => (atual.tipo === 'ok' ? atual : { tipo: 'carregando' }))
    historicoOnu(sn, horas)
      .then((dados) => !cancelado && setEstado({ tipo: 'ok', dados, agora: Date.now() }))
      .catch((e) => {
        if (cancelado) return
        if (e instanceof ApiError && e.status === 503 && /não configurado/i.test(e.message)) setEstado({ tipo: 'oculto' })
        else if (e instanceof ApiError && e.status === 404) setEstado({ tipo: 'fora', mensagem: e.message })
        else setEstado({ tipo: 'erro', mensagem: e instanceof ApiError ? e.message : 'Não foi possível carregar o histórico.' })
      })
    return () => {
      cancelado = true
    }
  }, [sn, horas])

  async function lerAgora() {
    setLendo(true)
    try {
      const dados = await lerOnuNaOlt(sn, horas)
      setEstado({ tipo: 'ok', dados, agora: Date.now() })
      toast('Leitura feita na OLT agora.', 'sucesso')
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Não foi possível ler a ONU na OLT.')
    } finally {
      setLendo(false)
    }
  }

  if (estado.tipo === 'oculto') return null

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
              onClick={() => setHoras(p.horas)}
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
          lendo={lendo}
          onLerAgora={lerAgora}
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
  lendo,
  onLerAgora,
}: {
  dados: HistoricoOnuDto
  agora: number
  horas: number
  todasQuedas: boolean
  onTodasQuedas: () => void
  lendo: boolean
  onLerAgora: () => void
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

      <div className="historico-rodape">
        <span>Coletor leu {haQuanto(onu.sinal_em ?? dados.atualizado_em.onus, agora)}</span>
        <button
          type="button"
          className="botao botao-secundario"
          style={{ '--botao-cor': CORES.olts } as CSSProperties}
          onClick={onLerAgora}
          disabled={lendo}
        >
          <MdRefresh size={16} className={lendo ? 'onu-girando' : ''} /> {lendo ? 'Lendo na OLT…' : 'Ler na OLT agora'}
        </button>
      </div>
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
  const ultimo = (s: Serie) => [...s.pontos].reverse().find((p) => p.v != null)?.v

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
                {s.nome} {ultimo(s) != null ? `${ultimo(s)!.toFixed(1)} dBm` : '—'}
              </span>
            ))}
            {tx.length > 0 && (
              <span className="serie-tx">
                TX ONU {tx[tx.length - 1].toFixed(1)} dBm
                {Math.max(...tx) - Math.min(...tx) >= 0.5 && ` (${Math.min(...tx).toFixed(1)} a ${Math.max(...tx).toFixed(1)})`}
              </span>
            )}
          </>
        )}
      </figcaption>
    </figure>
  )
}

// ------------------------------------------------------------------ textos

function dataHora(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function rotuloEixo(t: number, horas: number): string {
  const d = new Date(t)
  return horas <= 24
    ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function duracao(s: number): string {
  if (s < 60) return `${s} s`
  const min = Math.round(s / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`
  return `${Math.floor(h / 24)} dias`
}

function haQuanto(iso: string | null, agora: number): string {
  if (!iso) return 'ainda não'
  const min = Math.round((agora - Date.parse(iso)) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  return `há ${duracao(min * 60)}`
}

// "ONU caiu: falta de energia (dying gasp)" → "Falta de energia (dying gasp)"
function motivoCurto(motivo: string): string {
  const texto = motivo.replace(/^ONU caiu:?\s*/i, '').replace(/^ONU\s+/i, '')
  return texto ? texto[0].toUpperCase() + texto.slice(1) : 'Queda'
}

function voltaTexto(q: QuedaOnu, aindaFora: boolean): string {
  if (q.duracao_s != null) return q.duracao_s < 5 ? 'Voltou na hora (oscilação)' : `Ficou fora ${duracao(q.duracao_s)}`
  return aindaFora ? 'Ainda fora' : 'Volta não registrada'
}

function classeQueda(q: QuedaOnu): string {
  if (q.codigos.includes('dgi')) return 'energia'
  if (q.codigos.some((c) => c === 'losi' || c === 'lofi')) return 'sinal'
  return 'outra'
}

// Quedas do mesmo tipo com menos de 15 min entre si viram uma linha só
// ("oscilou N vezes") — senão uma ONU instável enche a tela.
const JANELA_OSCILACAO_MS = 15 * 60_000

function agruparQuedas(quedas: QuedaOnu[]): { q: QuedaOnu; n: number; primeira: string }[] {
  const grupos: { q: QuedaOnu; n: number; primeira: string }[] = []
  for (const q of quedas) {
    const g = grupos[grupos.length - 1]
    if (g && classeQueda(g.q) === classeQueda(q) && Date.parse(g.primeira) - Date.parse(q.caiu_em) <= JANELA_OSCILACAO_MS) {
      g.n += 1
      g.primeira = q.caiu_em
    } else {
      grupos.push({ q, n: 1, primeira: q.caiu_em })
    }
  }
  return grupos
}

function resumirQuedas(quedas: QuedaOnu[]): string {
  if (quedas.length === 0) return ''
  const energia = quedas.filter((q) => classeQueda(q) === 'energia').length
  const sinal = quedas.filter((q) => classeQueda(q) === 'sinal').length
  const partes = [`${quedas.length} no período`]
  if (energia) partes.push(`${energia} por energia`)
  if (sinal) partes.push(`${sinal} sem sinal`)
  return partes.join(', ')
}
