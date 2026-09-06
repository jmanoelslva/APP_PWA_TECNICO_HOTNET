import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdBuild } from 'react-icons/md'
import { ApiError, listarOS, type TicketDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import PullToRefresh from '../components/PullToRefresh'
import { useToast } from '../components/Toast/useToast'
import { formatarData } from '../utils/formatacao'
import { CORES } from '../utils/cores'
import './Suporte.css'

const TAMANHO_PAGINA = 20

type Aba = 'minhas' | 'todas'

function osFechada(ticket: TicketDto): boolean {
  return !!ticket.ticket_date_close
}

export default function Suporte() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [aba, setAba] = useState<Aba>('minhas')
  const [chamados, setChamados] = useState<TicketDto[]>([])
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
      const resposta = await listarOS({ minhas: aba === 'minhas', start: 0, limit: TAMANHO_PAGINA })
      setChamados(resposta.results)
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
      const resposta = await listarOS({ minhas: aba === 'minhas', start: chamados.length, limit: TAMANHO_PAGINA })
      setChamados((atual) => [...atual, ...resposta.results])
      setTotal(resposta.total)
    } catch {
      toast('Não foi possível carregar mais OS.')
    } finally {
      setCarregandoMais(false)
    }
  }

  const haMaisParaCarregar = chamados.length < total

  return (
    <PullToRefresh aoAtualizar={carregar}>
      <div className="suporte-tela tela-entrada">
        <CabecalhoTela icone={MdBuild} cor={CORES.suporte} titulo="OS / Suporte" subtitulo="Ordens de serviço e chamados." />

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

        {!carregando && !erro && chamados.length === 0 && (
          <EstadoVazio
            icone={MdBuild}
            titulo={aba === 'minhas' ? 'Nenhuma OS atribuída a você' : 'Nenhuma OS encontrada'}
          />
        )}

        {!carregando && !erro && chamados.length > 0 && (
          <ul className="suporte-lista">
            {chamados.map((chamado) => {
              const fechada = osFechada(chamado)
              return (
                <li
                  key={chamado.ticket_pk}
                  className="ticket-card"
                  onClick={() => navigate(`/suporte/${chamado.ticket_pk}`, { state: { chamado }, viewTransition: true })}
                >
                  <div className="ticket-topo">
                    <span className="ticket-assunto">{chamado.ticket_title ?? `OS #${chamado.ticket_pk ?? '-'}`}</span>
                    <span className={`ticket-status-badge ${fechada ? 'badge-fechado' : 'badge-aberto'}`}>
                      {fechada ? 'Fechada' : 'Aberta'}
                    </span>
                  </div>
                  {chamado.ticket_protocol && <p className="ticket-protocolo">Protocolo: {chamado.ticket_protocol}</p>}
                  {chamado.category_name && <p className="ticket-protocolo">{chamado.category_name}</p>}
                  {chamado.contract_number != null && <p className="ticket-protocolo">Contrato: {chamado.contract_number}</p>}
                  <p className="ticket-data">Aberta em {formatarData(chamado.ticket_date_create) ?? 'data não informada'}</p>
                  {chamado.ticket_desc && <p className="ticket-descricao">{chamado.ticket_desc}</p>}
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
