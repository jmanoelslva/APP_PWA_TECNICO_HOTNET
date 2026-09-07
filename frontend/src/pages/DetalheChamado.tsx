import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { MdAttachFile, MdBuild, MdChatBubbleOutline, MdClose, MdDownload, MdPictureAsPdf } from 'react-icons/md'
import VoltarInicio from '../components/VoltarInicio'
import EstadoVazio from '../components/EstadoVazio'
import Skeleton from '../components/Skeleton'
import { detalheTicket, listarMensagensTicket, listarOrdensServico, type OperacaoDto, type TicketDto } from '../api/client'
import { formatarDataHora } from '../utils/formatacao'
import './DetalheChamado.css'

const INTERVALO_ATUALIZACAO_MS = 10_000

interface Mensagem {
  opPk: number
  texto: string | null
  arquivo: string | null
  dataCriacao: string | null
}

const EXTENSOES_IMAGEM = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif']
const EXTENSOES_VIDEO = ['.mp4', '.mov', '.3gp', '.avi', '.mkv', '.webm']

function ehImagem(nome: string | null): boolean {
  return !!nome && EXTENSOES_IMAGEM.some((ext) => nome.toLowerCase().endsWith(ext))
}
function ehVideo(nome: string | null): boolean {
  return !!nome && EXTENSOES_VIDEO.some((ext) => nome.toLowerCase().endsWith(ext))
}
function ehPdf(nome: string | null): boolean {
  return !!nome && nome.toLowerCase().endsWith('.pdf')
}

function converterOperacao(dto: OperacaoDto): Mensagem | null {
  if (dto.op_pk == null) return null
  return {
    opPk: dto.op_pk,
    texto: dto.op_desc?.trim() || null,
    arquivo: dto.op_file?.trim() || null,
    dataCriacao: dto.op_date_create ?? null,
  }
}

/**
 * Chamado (ticket) e Ordem de Serviço são dois recursos/endpoints
 * diferentes no Controllr — misturar tudo numa tela só causava confusão.
 * O envio de mensagem foi removido de propósito: tudo que o técnico
 * precisa registrar sobre o atendimento é feito pela descrição dos
 * botões de Responder/Iniciar/Finalizar na tela da OS (/os/:ticketPk) —
 * essa tela aqui vira só um histórico de leitura (mensagens do
 * escritório/cliente e os próprios eventos da OS, que usam a mesma
 * tabela e aparecem juntos nesta lista).
 */
export default function DetalheChamado() {
  const { ticketPk } = useParams<{ ticketPk: string }>()
  const pk = Number(ticketPk)
  const location = useLocation()

  const estadoNavegacao = location.state as { chamado?: TicketDto } | null
  const [ticket, setTicket] = useState<TicketDto | null>(estadoNavegacao?.chamado ?? null)
  const fechado = !!ticket?.ticket_date_close

  const [temOs, setTemOs] = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [imagemAberta, setImagemAberta] = useState<string | null>(null)

  const fimDaListaRef = useRef<HTMLDivElement>(null)
  const qtdMensagensRef = useRef(0)

  useEffect(() => {
    if (!Number.isFinite(pk)) return
    if (!ticket) {
      detalheTicket(pk)
        .then((resposta) => setTicket(resposta.ticket))
        .catch(() => {})
    }
    listarOrdensServico({ ticketPk: pk, minhas: false, abertas: false, limit: 1 })
      .then((resposta) => setTemOs(resposta.results.length > 0))
      .catch(() => {})
    carregar(true)
    let intervalo: ReturnType<typeof setInterval> | null =
      document.visibilityState === 'visible' ? setInterval(() => carregar(false), INTERVALO_ATUALIZACAO_MS) : null

    function aoMudarVisibilidade() {
      if (document.visibilityState === 'visible') {
        if (intervalo == null) {
          carregar(false)
          intervalo = setInterval(() => carregar(false), INTERVALO_ATUALIZACAO_MS)
        }
      } else if (intervalo != null) {
        clearInterval(intervalo)
        intervalo = null
      }
    }

    document.addEventListener('visibilitychange', aoMudarVisibilidade)
    return () => {
      if (intervalo != null) clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoMudarVisibilidade)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pk])

  async function carregar(mostrarCarregando: boolean) {
    if (mostrarCarregando) setCarregando(true)
    try {
      const resposta = await listarMensagensTicket(pk)
      const dados = resposta.results
        .map(converterOperacao)
        .filter((m): m is Mensagem => m != null)
        .sort((a, b) => (a.dataCriacao ?? '').localeCompare(b.dataCriacao ?? ''))
      const chegouMensagemNova = dados.length > qtdMensagensRef.current
      qtdMensagensRef.current = dados.length
      setMensagens(dados)
      setErro(null)
      if (mostrarCarregando || chegouMensagemNova) {
        setTimeout(() => fimDaListaRef.current?.scrollIntoView({ block: 'end' }), 0)
      }
    } catch {
      if (mostrarCarregando) setErro('Não foi possível carregar o histórico deste chamado.')
    } finally {
      if (mostrarCarregando) setCarregando(false)
    }
  }

  if (!Number.isFinite(pk)) {
    return <p className="detalhe-chamado-status">Chamado não encontrado.</p>
  }

  return (
    <div className="detalhe-chamado-tela tela-entrada">
      <header className="detalhe-chamado-cabecalho">
        <VoltarInicio to="/suporte" label="OS" />
        {ticket && (
          <div className="detalhe-chamado-resumo">
            <div className="detalhe-chamado-resumo-topo">
              <span className="detalhe-chamado-assunto">{ticket.ticket_title ?? `Chamado #${pk}`}</span>
              <span className={`ticket-status-badge ${fechado ? 'badge-fechado' : 'badge-aberto'}`}>
                {fechado ? 'Fechado' : 'Aberto'}
              </span>
            </div>
            {ticket.ticket_protocol && <p className="detalhe-chamado-linha-resumo">Protocolo: {ticket.ticket_protocol}</p>}
            <p className="detalhe-chamado-linha-resumo">{ticket.category_name ?? 'Categoria não informada'}</p>
          </div>
        )}
        {temOs && (
          <Link to={`/os/${pk}`} className="detalhe-chamado-chip-os" viewTransition>
            <MdBuild size={14} /> Ver Ordem de Serviço
          </Link>
        )}
      </header>

      <div className="detalhe-chamado-chat" role="log" aria-live="polite" aria-relevant="additions">
        {carregando &&
          [0, 1, 2].map((indice) => (
            <div key={indice} className="balao-linha linha-equipe">
              <div className="balao balao-equipe">
                <Skeleton width={indice === 1 ? 160 : 120} height={13} />
              </div>
            </div>
          ))}

        {!carregando && erro && (
          <div className="detalhe-chamado-status">
            <p>{erro}</p>
            <button onClick={() => carregar(true)}>Tentar novamente</button>
          </div>
        )}

        {!carregando && !erro && mensagens.length === 0 && (
          <EstadoVazio icone={MdChatBubbleOutline} titulo="Nenhum registro ainda" subtitulo="O histórico deste chamado aparece aqui." />
        )}

        {!carregando &&
          !erro &&
          mensagens.map((op) => (
            <div key={op.opPk} className="balao-linha linha-equipe">
              <div className="balao balao-equipe">
                {op.texto && <p className="balao-texto">{op.texto}</p>}

                {op.arquivo && ehImagem(op.arquivo) && (
                  <button
                    type="button"
                    className="balao-anexo-imagem-botao"
                    onClick={() => setImagemAberta(op.arquivo)}
                  >
                    <img src={`/api/suporte/tickets/${pk}/anexos/${op.arquivo}`} alt="Anexo" className="balao-anexo-imagem" />
                  </button>
                )}
                {op.arquivo && ehVideo(op.arquivo) && (
                  <video src={`/api/suporte/tickets/${pk}/anexos/${op.arquivo}`} controls className="balao-anexo-imagem" />
                )}
                {op.arquivo && !ehImagem(op.arquivo) && !ehVideo(op.arquivo) && (
                  <a
                    href={`/api/suporte/tickets/${pk}/anexos/${op.arquivo}`}
                    target="_blank"
                    rel="noreferrer"
                    className={`balao-anexo-documento ${ehPdf(op.arquivo) ? 'balao-anexo-pdf' : ''}`}
                  >
                    <span className="balao-anexo-documento-icone">
                      {ehPdf(op.arquivo) ? <MdPictureAsPdf size={20} /> : <MdAttachFile size={20} />}
                    </span>
                    <span className="balao-anexo-documento-nome">{op.arquivo}</span>
                  </a>
                )}

                <span className="balao-data">{formatarDataHora(op.dataCriacao)}</span>
              </div>
            </div>
          ))}
        <div ref={fimDaListaRef} />
      </div>

      {imagemAberta && (
        <div className="chamado-imagem-modal-fundo" onClick={() => setImagemAberta(null)}>
          <div className="chamado-imagem-modal-acoes">
            <a
              href={`/api/suporte/tickets/${pk}/anexos/${imagemAberta}`}
              download={imagemAberta}
              className="chamado-imagem-modal-botao"
              aria-label="Baixar imagem"
              onClick={(e) => e.stopPropagation()}
            >
              <MdDownload size={20} />
            </a>
            <button
              type="button"
              className="chamado-imagem-modal-botao"
              aria-label="Fechar"
              onClick={() => setImagemAberta(null)}
            >
              <MdClose size={20} />
            </button>
          </div>
          <img
            src={`/api/suporte/tickets/${pk}/anexos/${imagemAberta}`}
            alt="Anexo em tela cheia"
            className="chamado-imagem-modal-imagem"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
