import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdBuild } from 'react-icons/md'
import { ApiError, listarOrdensServico, type OrdemServicoDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import PullToRefresh from '../components/PullToRefresh'
import { useToast } from '../components/Toast/useToast'
import { formatarDataHora } from '../utils/formatacao'
import { CORES } from '../utils/cores'
import './Suporte.css'

const TAMANHO_PAGINA = 20

type Aba = 'minhas' | 'todas'

function osFechada(os: OrdemServicoDto): boolean {
  return !!os.op_date_close || !!os.op_date_cancel
}

export default function Suporte() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [aba, setAba] = useState<Aba>('minhas')
  const [ordens, setOrdens] = useState<OrdemServicoDto[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await listarOrdensServico({ minhas: aba === 'minhas', abertas: true, start: 0, limit: TAMANHO_PAGINA })
      setOrdens(resposta.results)
      setTotal(resposta.total)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar as OS.')
    } finally {
      setCarregando(false)
    }
  }

  async function carregarMais() {
    setCarregandoMais(true)
    try {
      const resposta = await listarOrdensServico({
        minhas: aba === 'minhas',
        abertas: true,
        start: ordens.length,
        limit: TAMANHO_PAGINA,
      })
      setOrdens((atual) => [...atual, ...resposta.results])
      setTotal(resposta.total)
    } catch {
      toast('Não foi possível carregar mais OS.')
    } finally {
      setCarregandoMais(false)
    }
  }

  const haMaisParaCarregar = ordens.length < total

  return (
    <PullToRefresh aoAtualizar={carregar}>
      <div className="suporte-tela tela-entrada">
        <CabecalhoTela icone={MdBuild} cor={CORES.suporte} titulo="OS / Suporte" subtitulo="Ordens de serviço agendadas." />

        <div className="suporte-abas">
          <button className={`aba-chip ${aba === 'minhas' ? 'ativa' : ''}`} onClick={() => setAba('minhas')}>
            Minhas OS
          </button>
          <button className={`aba-chip ${aba === 'todas' ? 'ativa' : ''}`} onClick={() => setAba('todas')}>
            Todas
          </button>
        </div>

        {carregando && (
          <ul className="suporte-lista">
            {[0, 1, 2].map((i) => (
              <li key={i} className="ticket-card">
                <Skeleton width="60%" height={15} />
                <Skeleton width="40%" height={12} />
                <Skeleton width="50%" height={12} />
              </li>
            ))}
          </ul>
        )}

        {!carregando && erro && (
          <div className="suporte-status">
            <p>{erro}</p>
            <button onClick={carregar}>Tentar novamente</button>
          </div>
        )}

        {!carregando && !erro && ordens.length === 0 && (
          <EstadoVazio icone={MdBuild} titulo={aba === 'minhas' ? 'Nenhuma OS atribuída a você' : 'Nenhuma OS aberta'} />
        )}

        {!carregando && !erro && ordens.length > 0 && (
          <ul className="suporte-lista">
            {ordens.map((os) => {
              const fechada = osFechada(os)
              return (
                <li
                  key={os.op_pk ?? os.op_os_pk}
                  className="ticket-card"
                  onClick={() => os.ticket_pk && navigate(`/suporte/${os.ticket_pk}`, { state: { os }, viewTransition: true })}
                >
                  <div className="ticket-topo">
                    <span className="ticket-assunto">{os.op_desc?.trim() || `OS do chamado #${os.ticket_pk ?? '-'}`}</span>
                    <span className={`ticket-status-badge ${fechada ? 'badge-fechado' : 'badge-aberto'}`}>
                      {os.op_date_cancel ? 'Cancelada' : fechada ? 'Fechada' : 'Aberta'}
                    </span>
                  </div>
                  <p className="ticket-protocolo">Chamado #{os.ticket_pk ?? '—'}</p>
                  {os.op_priority != null && <p className="ticket-protocolo">Prioridade: {os.op_priority}</p>}
                  <p className="ticket-data">
                    {os.op_date_sched ? `Agendada para ${formatarDataHora(os.op_date_sched)}` : 'Sem data agendada'}
                  </p>
                </li>
              )
            })}
          </ul>
        )}

        {!carregando && !erro && haMaisParaCarregar && (
          <button className="suporte-carregar-mais" onClick={carregarMais} disabled={carregandoMais}>
            {carregandoMais ? 'Carregando…' : 'Carregar mais'}
          </button>
        )}
      </div>
    </PullToRefresh>
  )
}
