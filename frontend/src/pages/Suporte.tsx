import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdBuild } from 'react-icons/md'
import { ApiError, listarOrdensServico, type OrdemServicoDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import EstadoErro from '../components/EstadoErro'
import PullToRefresh from '../components/PullToRefresh'
import { osAtrasada, quandoOs } from '../utils/minhasOs'
import { CORES } from '../utils/cores'
import './Suporte.css'

// Sem "carregar mais" de propósito — a lista já só mostra OS em aberto
// (o backend tira as finalizadas, ver ordens_servico.py::
// _sem_finalizadas), então o volume normal cabe numa página só.
const TAMANHO_PAGINA = 100

// Uma tela só, sem aba "Minhas OS"/"Todas" — o backend já tira da lista
// qualquer OS que o técnico já finalizou, então não sobra motivo para
// separar "minhas" do resto: o que aparece aqui é sempre trabalho em
// aberto para qualquer técnico ver e pegar.
function osFechada(os: OrdemServicoDto): boolean {
  return !!os.op_date_close || !!os.op_date_cancel
}

const ROTULO_ETAPA = { agendada: 'Agendada', respondida: 'Respondida', iniciada: 'Em andamento' } as const

function selo(os: OrdemServicoDto): { texto: string; classe: string } {
  if (os.op_date_cancel) return { texto: 'Cancelada', classe: 'badge-cancelada' }
  if (osFechada(os)) return { texto: 'Fechada', classe: 'badge-fechado' }
  const etapa = os.etapa ?? 'agendada'
  return { texto: ROTULO_ETAPA[etapa], classe: `badge-${etapa}` }
}

export default function Suporte() {
  const navigate = useNavigate()

  const [ordens, setOrdens] = useState<OrdemServicoDto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await listarOrdensServico({ minhas: false, abertas: true, start: 0, limit: TAMANHO_PAGINA })
      setOrdens(resposta.results)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar as OS.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <PullToRefresh aoAtualizar={carregar}>
      <div className="suporte-tela tela-entrada">
        <CabecalhoTela icone={MdBuild} cor={CORES.suporte} titulo="OS / Suporte" subtitulo="Ordens de serviço agendadas." />

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
          <EstadoErro mensagem={erro} cor={CORES.suporte} onTentarDeNovo={carregar} />
        )}

        {!carregando && !erro && ordens.length === 0 && <EstadoVazio icone={MdBuild} titulo="Nenhuma OS aberta" />}

        {!carregando && !erro && ordens.length > 0 && (
          <ul className="suporte-lista">
            {ordens.map((os) => {
              const status = selo(os)
              const quando = quandoOs(os.op_date_sched)
              const atrasada = osAtrasada(os)
              const local = [os.client_complete_name, os.address_neighborhood?.trim()].filter(Boolean).join(' · ')
              return (
                <li
                  key={os.op_pk ?? os.op_os_pk}
                  className={`ticket-card${atrasada ? ' ticket-card-atrasada' : ''}`}
                  onClick={() => os.ticket_pk && navigate(`/os/${os.ticket_pk}`, { state: { os }, viewTransition: true })}
                >
                  <div className="ticket-topo">
                    <span className="ticket-assunto">
                      {os.task_name ?? (os.op_desc?.trim() || `OS do chamado #${os.ticket_pk ?? '-'}`)}
                    </span>
                    <span className={`ticket-status-badge ${status.classe}`}>{status.texto}</span>
                  </div>
                  {local && <p className="ticket-cliente">{local}</p>}
                  <div className="ticket-rodape">
                    <span className={`ticket-quando${atrasada ? ' ticket-quando-atrasada' : ''}`}>
                      {quando ?? 'Sem data agendada'}
                      {atrasada && <span className="ticket-atrasada">Atrasada</span>}
                    </span>
                    <span className="ticket-protocolo">#{os.ticket_protocol ?? os.ticket_pk ?? '—'}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PullToRefresh>
  )
}
