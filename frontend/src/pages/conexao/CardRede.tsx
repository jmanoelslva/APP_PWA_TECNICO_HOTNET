import { useEffect, useState, type CSSProperties } from 'react'
import { MdExpandLess, MdExpandMore } from 'react-icons/md'
import { ApiError, buscarHistoricoSessoesCpe, type CpeDto, type SessaoHistoricoDto } from '../../api/client'
import Skeleton from '../../components/Skeleton'
import { useToast } from '../../components/Toast/useToast'
import { CORES } from '../../utils/cores'
import { formatarDataHoraSegundos } from '../../utils/formatacao'
import { calcularPeriodo, OPCOES_PERIODO, type PeriodoPreset } from '../../utils/periodos'
import { formatarBytes, formatarDuracaoSegundos, rotuloEncerramento } from './sessao'

const LIMITE_HISTORICO = 10

/**
 * IP/MAC/última autenticação e o histórico de conexão
 * (aaa_ctl/session_history/list). O histórico fica recolhido e só é
 * consultado quando o técnico abre, já que a maioria das visitas não
 * precisa. Período padrão "Esse mês", mesmo padrão do painel Controllr (ver
 * CONTROLLR_API_NOTES.md, seção 7.5).
 */
export default function CardRede({ cpe }: { cpe: CpeDto }) {
  const { toast } = useToast()
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('esse_mes')
  const [intervaloInicio, setIntervaloInicio] = useState('')
  const [intervaloFim, setIntervaloFim] = useState('')
  const [historico, setHistorico] = useState<SessaoHistoricoDto[]>([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [temMaisHistorico, setTemMaisHistorico] = useState(false)

  // "personalizado" só resolve quando as duas datas estiverem preenchidas;
  // os demais presets são calculados aqui mesmo (ver utils/periodos.ts) —
  // "desde_o_inicio" devolve null de propósito (sem faixa, mesmo
  // comportamento do painel Controllr).
  function periodoAtual(): { inicio: string; fim: string } | null {
    if (periodoPreset === 'personalizado') {
      if (!intervaloInicio || !intervaloFim) return null
      return { inicio: `${intervaloInicio} 00:00:00`, fim: `${intervaloFim} 23:59:59` }
    }
    return calcularPeriodo(periodoPreset)
  }

  async function carregarHistorico(pagina: number) {
    if (!cpe.pk) return
    setCarregandoHistorico(true)
    try {
      const periodo = periodoAtual()
      const resposta = await buscarHistoricoSessoesCpe(cpe.pk, {
        username: cpe.username,
        dataInicio: periodo?.inicio,
        dataFim: periodo?.fim,
        page: pagina,
        limit: LIMITE_HISTORICO,
      })
      setHistorico((atual) => (pagina === 1 ? resposta.results : [...atual, ...resposta.results]))
      setTemMaisHistorico(resposta.results.length === LIMITE_HISTORICO)
    } catch (excecao) {
      if (pagina === 1) setHistorico([])
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível consultar o histórico de conexão.')
    } finally {
      setCarregandoHistorico(false)
    }
  }

  useEffect(() => {
    if (!historicoAberto || !cpe.pk) return
    if (periodoPreset === 'personalizado' && (!intervaloInicio || !intervaloFim)) return
    carregarHistorico(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicoAberto, cpe.pk, periodoPreset, intervaloInicio, intervaloFim])

  return (
    <div className="conexao-card">
      <h2>Rede</h2>
      <div className="conexao-linha">
        <span>IP</span>
        <strong>{cpe.v4_ip ?? cpe.v4_ip_last ?? '—'}</strong>
      </div>
      <div className="conexao-linha">
        <span>MAC</span>
        <strong>{cpe.mac ?? cpe.mac_last ?? '—'}</strong>
      </div>
      <div className="conexao-linha">
        <span>Última autenticação</span>
        <strong>{cpe.date_auth ? formatarDataHoraSegundos(cpe.date_auth) : '—'}</strong>
      </div>

      <button
        type="button"
        className="conexao-card-toggle conexao-historico-toggle"
        onClick={() => setHistoricoAberto((v) => !v)}
        aria-expanded={historicoAberto}
      >
        <span>Histórico de conexão</span>
        {historicoAberto ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
      </button>
      {historicoAberto && (
        <>
          <div className="conexao-campo">
            <span>Período</span>
            <select
              className="conexao-input"
              value={periodoPreset}
              onChange={(e) => setPeriodoPreset(e.target.value as PeriodoPreset)}
            >
              {OPCOES_PERIODO.map((opcao) => (
                <option key={opcao.valor} value={opcao.valor}>
                  {opcao.rotulo}
                </option>
              ))}
            </select>
          </div>
          {periodoPreset === 'personalizado' && (
            <div className="conexao-historico-intervalo">
              <input
                className="conexao-input"
                type="date"
                value={intervaloInicio}
                onChange={(e) => setIntervaloInicio(e.target.value)}
              />
              <input
                className="conexao-input"
                type="date"
                value={intervaloFim}
                onChange={(e) => setIntervaloFim(e.target.value)}
              />
            </div>
          )}
          {carregandoHistorico && historico.length === 0 && <Skeleton width="60%" height={14} />}
          {!carregandoHistorico && historico.length === 0 && (
            <p className="conexao-sessao-vazio">Nenhuma sessão encontrada no período.</p>
          )}
          {historico.map((sessao, indice) => (
            <div className="conexao-historico-item" key={`${sessao.session_date_close ?? ''}-${indice}`}>
              <div className="conexao-linha">
                <span>Início</span>
                <strong>{sessao.session_date_start ? formatarDataHoraSegundos(sessao.session_date_start) : '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>Fim</span>
                <strong>{sessao.session_date_close ? formatarDataHoraSegundos(sessao.session_date_close) : 'Em andamento'}</strong>
              </div>
              <div className="conexao-linha">
                <span>Duração</span>
                <strong>{sessao.session_acct_time != null ? formatarDuracaoSegundos(sessao.session_acct_time) : '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>Consumo (download / upload)</span>
                <strong>
                  {sessao.session_tx_byte != null && sessao.session_rx_byte != null
                    ? `${formatarBytes(sessao.session_tx_byte * 1024)} / ${formatarBytes(sessao.session_rx_byte * 1024)}`
                    : '—'}
                </strong>
              </div>
              <div className="conexao-linha">
                <span>IPv4</span>
                <strong>{sessao.session_v4_ip ?? '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>IPv6 PX</span>
                <strong>{sessao.session_v6_px || '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>IPv6 PD</span>
                <strong>{sessao.session_v6_pd || '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>NAS Port ID</span>
                <strong>{sessao.session_nas_port_id ?? '—'}</strong>
              </div>
              <div className="conexao-linha">
                <span>Encerrada por</span>
                <strong>{rotuloEncerramento(sessao.session_terminate_cause)}</strong>
              </div>
            </div>
          ))}
          {temMaisHistorico && (
            <button
              className="botao botao-secundario botao-pequeno"
              style={{ '--botao-cor': CORES.conexao } as CSSProperties}
              onClick={() => carregarHistorico(Math.floor(historico.length / LIMITE_HISTORICO) + 1)}
              disabled={carregandoHistorico}
            >
              <MdExpandMore size={14} /> {carregandoHistorico ? 'Carregando…' : 'Carregar mais'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
