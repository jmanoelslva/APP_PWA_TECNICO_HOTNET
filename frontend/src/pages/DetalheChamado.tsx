import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  MdAttachFile,
  MdBuild,
  MdCameraAlt,
  MdChatBubbleOutline,
  MdDescription,
  MdImage,
  MdPictureAsPdf,
} from 'react-icons/md'
import VoltarInicio from '../components/VoltarInicio'
import EstadoVazio from '../components/EstadoVazio'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast/useToast'
import {
  ApiError,
  criarMensagemTicket,
  detalheTicket,
  enviarAnexoTicket,
  listarMensagensTicket,
  listarOrdensServico,
  type OperacaoDto,
  type TicketDto,
} from '../api/client'
import { agoraNoFormatoDoServidor, formatarDataHora } from '../utils/formatacao'
import './DetalheChamado.css'

const INTERVALO_ATUALIZACAO_MS = 10_000

interface Mensagem {
  opPk: number
  texto: string | null
  arquivo: string | null
  dataCriacao: string | null
  daEquipe: boolean
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
    // O ponto de vista aqui é do TÉCNICO: mensagens do próprio técnico
    // aparecem como "cliente" (bolha à direita) mesmo vindo de op_client
    // true no schema do Controllr (que representa "visível ao cliente"),
    // já que op_client é sobre quem PODE VER a mensagem, não quem é o
    // autor — o autor real não vem tipado no schema, então tratamos toda
    // mensagem como vinda da equipe (bolha à esquerda) por padrão, exceto
    // as que este técnico acabou de enviar nesta sessão (ver pendentes).
    // Isso também inclui os eventos automáticos de Respondida/Iniciada/
    // Finalizada da OS (mesma tabela support_op, op_type diferente) —
    // aparecem aqui igual a uma mensagem normal, sem tratamento especial.
    daEquipe: true,
  }
}

/** Remove de "pendentes" as mensagens otimistas já confirmadas em "dados" — casamento 1-pra-1 por texto. */
function descartarPendentesConfirmadas(pendentes: Mensagem[], dados: Mensagem[]): Mensagem[] {
  const usados = new Set<number>()
  for (const d of dados) {
    const indice = pendentes.findIndex((p, i) => !usados.has(i) && p.texto === d.texto)
    if (indice !== -1) usados.add(indice)
  }
  return pendentes.filter((_, i) => !usados.has(i))
}

export default function DetalheChamado() {
  const { ticketPk } = useParams<{ ticketPk: string }>()
  const pk = Number(ticketPk)
  const location = useLocation()
  const { toast } = useToast()

  const estadoNavegacao = location.state as { chamado?: TicketDto } | null
  const [ticket, setTicket] = useState<TicketDto | null>(estadoNavegacao?.chamado ?? null)
  const fechado = !!ticket?.ticket_date_close

  // Chamado (ticket) e Ordem de Serviço são dois recursos/endpoints
  // diferentes no Controllr — misturar tudo numa tela só causava
  // confusão. Aqui é só o chat do chamado; a OS (endereço, contrato,
  // dados de conexão, estágio respondida/iniciada/finalizada) tem tela
  // própria em /os/:ticketPk. Só busca se existe uma OS pra mostrar o
  // link de atalho — não carrega os detalhes dela aqui.
  const [temOs, setTemOs] = useState(false)

  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [pendentes, setPendentes] = useState<Mensagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [menuAnexoAberto, setMenuAnexoAberto] = useState(false)

  const inputFotoRef = useRef<HTMLInputElement>(null)
  const inputGaleriaRef = useRef<HTMLInputElement>(null)
  const inputArquivoRef = useRef<HTMLInputElement>(null)
  const inputMensagemRef = useRef<HTMLInputElement>(null)
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
      setPendentes((atual) => descartarPendentesConfirmadas(atual, dados))
      setErro(null)
      if (mostrarCarregando || chegouMensagemNova) {
        setTimeout(() => fimDaListaRef.current?.scrollIntoView({ block: 'end' }), 0)
      }
    } catch {
      if (mostrarCarregando) setErro('Não foi possível carregar as mensagens deste chamado.')
    } finally {
      if (mostrarCarregando) setCarregando(false)
    }
  }

  async function aoEnviarTexto(valor: string) {
    setEnviando(true)
    const otimista: Mensagem = {
      opPk: -Date.now(),
      texto: valor,
      arquivo: null,
      dataCriacao: agoraNoFormatoDoServidor(),
      daEquipe: false,
    }
    setPendentes((atual) => [...atual, otimista])
    setTimeout(() => fimDaListaRef.current?.scrollIntoView({ block: 'end' }), 0)
    try {
      await criarMensagemTicket(pk, valor)
      await carregar(false)
    } catch (excecao) {
      setPendentes((atual) => atual.filter((p) => p.opPk !== otimista.opPk))
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível enviar a mensagem.')
    } finally {
      setEnviando(false)
    }
  }

  function aoEnviarMensagem() {
    if (enviando) return
    const valor = texto.trim()
    if (!valor) return
    setTexto('')
    aoEnviarTexto(valor)
    inputMensagemRef.current?.focus()
  }

  async function aoSelecionarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    setMenuAnexoAberto(false)
    if (!arquivo) return
    setEnviando(true)
    try {
      await enviarAnexoTicket(pk, arquivo)
      await carregar(false)
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível enviar o anexo.')
    } finally {
      setEnviando(false)
    }
  }

  if (!Number.isFinite(pk)) {
    return <p className="detalhe-chamado-status">Chamado não encontrado.</p>
  }

  const listaExibida = [...mensagens, ...pendentes]

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
            <div key={indice} className={`balao-linha ${indice === 1 ? 'linha-tecnico' : 'linha-equipe'}`}>
              <div className={`balao ${indice === 1 ? 'balao-tecnico' : 'balao-equipe'}`}>
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

        {!carregando && !erro && listaExibida.length === 0 && (
          <EstadoVazio icone={MdChatBubbleOutline} titulo="Nenhuma mensagem ainda" subtitulo="Escreva algo pra começar." />
        )}

        {!carregando &&
          !erro &&
          listaExibida.map((op) => (
            <div key={op.opPk} className={`balao-linha ${op.daEquipe ? 'linha-equipe' : 'linha-tecnico'}`}>
              <div className={`balao ${op.daEquipe ? 'balao-equipe' : 'balao-tecnico'}`}>
                {op.texto && <p className="balao-texto">{op.texto}</p>}

                {op.arquivo && ehImagem(op.arquivo) && (
                  <img src={`/api/suporte/tickets/${pk}/anexos/${op.arquivo}`} alt="Anexo" className="balao-anexo-imagem" />
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

      {!fechado && (
        <div className="detalhe-chamado-envio">
          <input ref={inputFotoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={aoSelecionarArquivo} />
          <input ref={inputGaleriaRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={aoSelecionarArquivo} />
          <input ref={inputArquivoRef} type="file" style={{ display: 'none' }} onChange={aoSelecionarArquivo} />

          <div className="detalhe-chamado-anexo-wrapper">
            <button className="detalhe-chamado-btn-anexar" disabled={enviando} onClick={() => setMenuAnexoAberto((v) => !v)} aria-label="Anexar">
              <MdAttachFile size={20} />
            </button>
            {menuAnexoAberto && (
              <>
                <div className="detalhe-chamado-menu-fundo" onClick={() => setMenuAnexoAberto(false)} />
                <div className="detalhe-chamado-menu-anexo">
                  <button onClick={() => inputFotoRef.current?.click()}>
                    <MdCameraAlt /> Tirar foto
                  </button>
                  <button onClick={() => inputGaleriaRef.current?.click()}>
                    <MdImage /> Galeria
                  </button>
                  <button onClick={() => inputArquivoRef.current?.click()}>
                    <MdDescription /> Arquivo
                  </button>
                </div>
              </>
            )}
          </div>

          <input
            ref={inputMensagemRef}
            className="detalhe-chamado-input-mensagem"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={(evento) => evento.key === 'Enter' && aoEnviarMensagem()}
            placeholder="Digite uma mensagem…"
          />
          <button className="detalhe-chamado-btn-enviar" disabled={enviando || !texto.trim()} onClick={aoEnviarMensagem}>
            Enviar
          </button>
        </div>
      )}
    </div>
  )
}
