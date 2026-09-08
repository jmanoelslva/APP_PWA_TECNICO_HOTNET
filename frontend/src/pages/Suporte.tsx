import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdBuild } from 'react-icons/md'
import { ApiError, listarOrdensServico, type OrdemServicoDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import PullToRefresh from '../components/PullToRefresh'
import { formatarDataHora } from '../utils/formatacao'
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
          <div className="suporte-status">
            <p>{erro}</p>
            <button className="botao botao-primario" style={{ '--botao-cor': CORES.suporte } as CSSProperties} onClick={carregar}>
              Tentar novamente
            </button>
          </div>
        )}

        {!carregando && !erro && ordens.length === 0 && <EstadoVazio icone={MdBuild} titulo="Nenhuma OS aberta" />}

        {!carregando && !erro && ordens.length > 0 && (
          <ul className="suporte-lista">
            {ordens.map((os) => {
              const fechada = osFechada(os)
              return (
                <li
                  key={os.op_pk ?? os.op_os_pk}
                  className="ticket-card"
                  onClick={() => os.ticket_pk && navigate(`/os/${os.ticket_pk}`, { state: { os }, viewTransition: true })}
                >
                  <div className="ticket-topo">
                    <span className="ticket-assunto">
                      {os.task_name ?? (os.op_desc?.trim() || `OS do chamado #${os.ticket_pk ?? '-'}`)}
                    </span>
                    <span className={`ticket-status-badge ${fechada ? 'badge-fechado' : 'badge-aberto'}`}>
                      {os.op_date_cancel ? 'Cancelada' : fechada ? 'Fechada' : 'Aberta'}
                    </span>
                  </div>
                  {os.client_complete_name && <p className="ticket-protocolo">{os.client_complete_name}</p>}
                  <p className="ticket-protocolo">Chamado #{os.ticket_protocol ?? os.ticket_pk ?? '—'}</p>
                  {os.op_priority != null && <p className="ticket-protocolo">Prioridade: {os.op_priority}</p>}
                  <p className="ticket-data">
                    {os.op_date_sched ? `Agendada para ${formatarDataHora(os.op_date_sched)}` : 'Sem data agendada'}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PullToRefresh>
  )
}
