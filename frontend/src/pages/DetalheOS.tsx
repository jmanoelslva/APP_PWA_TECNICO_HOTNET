import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import {
  MdAttachFile,
  MdCameraAlt,
  MdChatBubbleOutline,
  MdCheckCircle,
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
  fecharOrdemServico,
  listarMensagensTicket,
  listarOrdensServico,
  type OperacaoDto,
  type OrdemServicoDto,
  type TicketDto,
} from '../api/client'
import { agoraNoFormatoDoServidor, formatarDataHora } from '../utils/formatacao'
import './DetalheOS.css'

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

export default function DetalheOS() {
  const { ticketPk } = useParams<{ ticketPk: string }>()
  const pk = Number(ticketPk)
  const location = useLocation()
  const { toast } = useToast()

  const estadoNavegacao = location.state as { chamado?: TicketDto; os?: OrdemServicoDto } | null
  const [ticket, setTicket] = useState<TicketDto | null>(estadoNavegacao?.chamado ?? null)
  // A OS (Ordem de Serviço) é quem tem o ciclo de vida fechar/cancelar/
  // reabrir de verdade — o ticket em si (acima) é só o caso/chat. Uma OS
  // pode não existir ainda pra este ticket (ex: chamado recém-aberto,
  // sem visita técnica agendada) — nesse caso não há o que fechar.
  const [osAtual, setOsAtual] = useState<OrdemServicoDto | null>(estadoNavegacao?.os ?? null)
  const fechada = osAtual ? !!osAtual.op_date_close || !!osAtual.op_date_cancel : false

  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [pendentes, setPendentes] = useState<Mensagem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [menuAnexoAberto, setMenuAnexoAberto] = useState(false)
  const [confirmandoFechar, setConfirmandoFechar] = useState(false)
  const [observacaoFechar, setObservacaoFechar] = useState('')
  const [fechando, setFechando] = useState(false)

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
    if (!osAtual) {
      listarOrdensServico({ ticketPk: pk, minhas: false, abertas: false, limit: 5 })
        .then((resposta) => {
          // Prefere uma OS ainda aberta (sem data de fechamento/
          // cancelamento); se todas já estiverem fechadas, mostra a mais
          // recente mesmo assim (histórico), só sem o botão de fechar.
          const aberta = resposta.results.find((os) => !os.op_date_close && !os.op_date_cancel)
          setOsAtual(aberta ?? resposta.results[0] ?? null)
        })
        .catch(() => {})
    }
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
      if (mostrarCarregando) setErro('Não foi possível carregar as mensagens desta OS.')
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

  async function confirmarFechamento() {
    if (!osAtual?.op_os_pk) {
      toast('Nenhuma OS aberta encontrada pra este chamado.')
      setConfirmandoFechar(false)
      return
    }
    setFechando(true)
    try {
      await fecharOrdemServico(pk, { opOsPk: osAtual.op_os_pk, opDesc: observacaoFechar.trim() || undefined })
      toast('OS fechada com sucesso.', 'sucesso')
      setConfirmandoFechar(false)
      setOsAtual((atual) => (atual ? { ...atual, op_date_close: agoraNoFormatoDoServidor() } : atual))
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível fechar a OS.')
    } finally {
      setFechando(false)
    }
  }

  if (!Number.isFinite(pk)) {
    return <p className="detalhe-os-status">OS não encontrada.</p>
  }

  const listaExibida = [...mensagens, ...pendentes]

  return (
    <div className="detalhe-os-tela tela-entrada">
      <header className="detalhe-os-cabecalho">
        <VoltarInicio to="/suporte" label="OS" />
        {ticket && (
          <div className="detalhe-os-resumo">
            <div className="detalhe-os-resumo-topo">
              <span className="detalhe-os-assunto">{ticket.ticket_title ?? `OS #${pk}`}</span>
              <span className={`ticket-status-badge ${fechada ? 'badge-fechado' : 'badge-aberto'}`}>
                {fechada ? 'Fechada' : 'Aberta'}
              </span>
            </div>
            {ticket.ticket_protocol && <p className="detalhe-os-linha-resumo">Protocolo: {ticket.ticket_protocol}</p>}
            <p className="detalhe-os-linha-resumo">{ticket.category_name ?? 'Categoria não informada'}</p>
            {osAtual?.op_date_sched && (
              <p className="detalhe-os-linha-resumo">OS agendada para {formatarDataHora(osAtual.op_date_sched)}</p>
            )}
          </div>
        )}
        {!fechada && osAtual?.op_os_pk && (
          <button className="detalhe-os-btn-fechar" onClick={() => setConfirmandoFechar(true)}>
            <MdCheckCircle size={16} /> Fechar OS
          </button>
        )}
        {!fechada && ticket && !osAtual?.op_os_pk && (
          <p className="detalhe-os-linha-resumo">Nenhuma OS aberta pra este chamado ainda.</p>
        )}
      </header>

      <div className="detalhe-os-chat" role="log" aria-live="polite" aria-relevant="additions">
        {carregando &&
          [0, 1, 2].map((indice) => (
            <div key={indice} className={`balao-linha ${indice === 1 ? 'linha-tecnico' : 'linha-equipe'}`}>
              <div className={`balao ${indice === 1 ? 'balao-tecnico' : 'balao-equipe'}`}>
                <Skeleton width={indice === 1 ? 160 : 120} height={13} />
              </div>
            </div>
          ))}

        {!carregando && erro && (
          <div className="detalhe-os-status">
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

      {!fechada && (
        <div className="detalhe-os-envio">
          <input ref={inputFotoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={aoSelecionarArquivo} />
          <input ref={inputGaleriaRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={aoSelecionarArquivo} />
          <input ref={inputArquivoRef} type="file" style={{ display: 'none' }} onChange={aoSelecionarArquivo} />

          <div className="detalhe-os-anexo-wrapper">
            <button className="detalhe-os-btn-anexar" disabled={enviando} onClick={() => setMenuAnexoAberto((v) => !v)} aria-label="Anexar">
              <MdAttachFile size={20} />
            </button>
            {menuAnexoAberto && (
              <>
                <div className="detalhe-os-menu-fundo" onClick={() => setMenuAnexoAberto(false)} />
                <div className="detalhe-os-menu-anexo">
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
            className="detalhe-os-input-mensagem"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={(evento) => evento.key === 'Enter' && aoEnviarMensagem()}
            placeholder="Digite uma mensagem…"
          />
          <button className="detalhe-os-btn-enviar" disabled={enviando || !texto.trim()} onClick={aoEnviarMensagem}>
            Enviar
          </button>
        </div>
      )}

      {confirmandoFechar && (
        <div className="detalhe-os-modal-fundo" onClick={() => setConfirmandoFechar(false)}>
          <div className="detalhe-os-modal" onClick={(evento) => evento.stopPropagation()}>
            <h2>Fechar esta OS?</h2>
            <p className="detalhe-os-modal-texto">Descreva rapidamente o que foi feito (opcional).</p>
            <textarea
              value={observacaoFechar}
              onChange={(e) => setObservacaoFechar(e.target.value)}
              placeholder="Ex: Trocado cabo de rede, sinal normalizado."
              rows={3}
            />
            <div className="detalhe-os-modal-acoes">
              <button onClick={() => setConfirmandoFechar(false)}>Cancelar</button>
              <button className="detalhe-os-btn-primario" disabled={fechando} onClick={confirmarFechamento}>
                {fechando ? 'Fechando…' : 'Fechar OS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
