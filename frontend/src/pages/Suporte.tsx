import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdBuild, MdClose, MdSearch } from 'react-icons/md'
import { ApiError, listarOrdensServico, type OrdemServicoDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import EstadoErro from '../components/EstadoErro'
import PullToRefresh from '../components/PullToRefresh'
import { osAtrasada, quandoOs } from '../utils/minhasOs'
import { FILTRO_VAZIO, filtrarOs, filtroAtivo, tarefasDaLista, type FiltroOs, type FiltroQuando } from '../utils/filtroOs'
import { CORES } from '../utils/cores'
import './Suporte.css'

// Sem "carregar mais" de propósito — a lista já só mostra OS em aberto
// (o backend tira as finalizadas, ver ordens_servico.py::_sem_finalizadas),
// então o volume normal cabe numa página só. Os filtros trabalham nessa lista.
const TAMANHO_PAGINA = 100

// Filtro escolhido vale enquanto o app estiver aberto (volta da OS e continua).
const CHAVE_FILTRO = 'hotnet-tecnico-filtro-os'

function lerFiltro(): FiltroOs {
  try {
    const salvo = sessionStorage.getItem(CHAVE_FILTRO)
    return salvo ? { ...FILTRO_VAZIO, ...(JSON.parse(salvo) as Partial<FiltroOs>) } : FILTRO_VAZIO
  } catch {
    return FILTRO_VAZIO
  }
}

const OPCOES_QUANDO: { valor: FiltroQuando; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: 'atrasadas', rotulo: 'Atrasadas' },
  { valor: 'proximas', rotulo: 'Próximas' },
]

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
  const [filtro, setFiltro] = useState<FiltroOs>(lerFiltro)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE_FILTRO, JSON.stringify(filtro))
    } catch {
      // sem armazenamento: o filtro vale só nesta tela
    }
  }, [filtro])

  const tarefas = useMemo(() => tarefasDaLista(ordens), [ordens])
  const filtradas = useMemo(() => filtrarOs(ordens, filtro), [ordens, filtro])
  const comFiltro = filtroAtivo(filtro)

  function mudar(parcial: Partial<FiltroOs>) {
    setFiltro((atual) => ({ ...atual, ...parcial }))
  }

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
          <div className="suporte-filtros">
            <div className="suporte-busca">
              <MdSearch size={20} className="suporte-busca-icone" aria-hidden="true" />
              <input
                type="search"
                value={filtro.busca}
                onChange={(e) => mudar({ busca: e.target.value })}
                placeholder="Cliente, rua, bairro, serviço ou protocolo"
                aria-label="Buscar OS"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <div className="suporte-chips" role="group" aria-label="Quando">
              {OPCOES_QUANDO.map((opcao) => (
                <button
                  key={opcao.valor}
                  type="button"
                  className={`suporte-chip suporte-chip-${opcao.valor}${filtro.quando === opcao.valor ? ' ativo' : ''}`}
                  aria-pressed={filtro.quando === opcao.valor}
                  onClick={() => mudar({ quando: opcao.valor })}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>

            <div className="suporte-selects">
              <select
                value={filtro.etapa}
                onChange={(e) => mudar({ etapa: e.target.value as FiltroOs['etapa'] })}
                aria-label="Etapa"
              >
                <option value="todas">Todas as etapas</option>
                <option value="agendada">Agendada</option>
                <option value="respondida">Respondida</option>
                <option value="iniciada">Em andamento</option>
              </select>
              <select value={filtro.tarefa} onChange={(e) => mudar({ tarefa: e.target.value })} aria-label="Tipo de serviço">
                <option value="">Todos os serviços</option>
                {/* Mantém a escolha mesmo se o serviço sumiu da lista ao atualizar. */}
                {[...new Set([...tarefas, ...(filtro.tarefa ? [filtro.tarefa] : [])])].map((tarefa) => (
                  <option key={tarefa} value={tarefa}>
                    {tarefa}
                  </option>
                ))}
              </select>
            </div>

            <div className="suporte-resumo">
              <span>{comFiltro ? `${filtradas.length} de ${ordens.length} OS` : `${ordens.length} OS`}</span>
              {comFiltro && (
                <button type="button" className="suporte-limpar" onClick={() => setFiltro(FILTRO_VAZIO)}>
                  <MdClose size={16} /> Limpar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {!carregando && !erro && ordens.length > 0 && filtradas.length === 0 && (
          <EstadoVazio icone={MdSearch} titulo="Nenhuma OS com esses filtros" subtitulo="Mude ou limpe os filtros acima." />
        )}

        {!carregando && !erro && filtradas.length > 0 && (
          <ul className="suporte-lista">
            {filtradas.map((os) => {
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
