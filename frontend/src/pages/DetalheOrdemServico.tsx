import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  MdAttachFile,
  MdCheckCircle,
  MdChatBubbleOutline,
  MdContentCopy,
  MdPeopleAlt,
  MdPlayArrow,
  MdVisibility,
  MdVisibilityOff,
  MdWifi,
} from 'react-icons/md'
import VoltarInicio from '../components/VoltarInicio'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast/useToast'
import {
  ApiError,
  buscarCpe,
  buscarDetalheCliente,
  detalheTicket,
  enviarAnexoTicket,
  finalizarOrdemServico,
  iniciarOrdemServico,
  listarOrdensServico,
  responderOrdemServico,
  type ContratoDto,
  type CpeDto,
  type OrdemServicoDto,
  type TicketDto,
} from '../api/client'
import { agoraNoFormatoDoServidor, formatarDataHora, formatarStatusContrato } from '../utils/formatacao'
import './DetalheOrdemServico.css'

// Os 4 estágios reais de uma OS (confirmado com o dono da operação e
// capturado ao vivo do painel do Controllr — não documentado
// oficialmente): Agendada (feita pelo escritório) -> Respondida ->
// Iniciada -> Finalizada, as 3 últimas marcadas pelo técnico aqui.
// Fechar é etapa À PARTE, só do escritório (ACL do Controllr não libera
// pro técnico) — por isso não tem botão de fechar nesta tela.
type Etapa = 'responder' | 'iniciar' | 'finalizar'

interface ConfigEtapa {
  chave: Etapa
  rotulo: string
  rotuloAcao: string
  campoData: 'op_date_answer' | 'op_date_start' | 'op_date_finish'
  Icone: typeof MdVisibility
  acao: typeof responderOrdemServico
}

const ETAPAS: ConfigEtapa[] = [
  { chave: 'responder', rotulo: 'Respondida', rotuloAcao: 'Marcar como respondida', campoData: 'op_date_answer', Icone: MdVisibility, acao: responderOrdemServico },
  { chave: 'iniciar', rotulo: 'Iniciada', rotuloAcao: 'Iniciar atendimento', campoData: 'op_date_start', Icone: MdPlayArrow, acao: iniciarOrdemServico },
  { chave: 'finalizar', rotulo: 'Finalizada', rotuloAcao: 'Finalizar atendimento', campoData: 'op_date_finish', Icone: MdCheckCircle, acao: finalizarOrdemServico },
]

function proximaEtapa(os: OrdemServicoDto | null): ConfigEtapa | null {
  if (!os || os.op_date_close || os.op_date_cancel) return null
  return ETAPAS.find((etapa) => !os[etapa.campoData]) ?? null
}

function rotuloEtapaAtual(os: OrdemServicoDto): string {
  if (os.op_date_cancel) return 'Cancelada'
  if (os.op_date_close) return 'Fechada'
  if (os.op_date_finish) return 'Finalizada'
  if (os.op_date_start) return 'Iniciada'
  if (os.op_date_answer) return 'Respondida'
  if (os.op_date_sched) return 'Agendada'
  return 'Sem data'
}

function enderecoCompleto(os: OrdemServicoDto): string {
  return (
    [os.address, os.address_number, os.address_neighborhood].filter(Boolean).join(', ') || 'Endereço não informado'
  )
}

export default function DetalheOrdemServico() {
  const { ticketPk } = useParams<{ ticketPk: string }>()
  const pk = Number(ticketPk)
  const location = useLocation()
  const { toast } = useToast()

  const estadoNavegacao = location.state as { os?: OrdemServicoDto } | null

  const [ticket, setTicket] = useState<TicketDto | null>(null)
  const [osAtual, setOsAtual] = useState<OrdemServicoDto | null>(estadoNavegacao?.os ?? null)
  const [contrato, setContrato] = useState<ContratoDto | null>(null)
  const [telefone, setTelefone] = useState<string | null>(null)
  const [cpe, setCpe] = useState<CpeDto | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [etapaConfirmando, setEtapaConfirmando] = useState<Etapa | null>(null)
  const [observacaoEtapa, setObservacaoEtapa] = useState('')
  const [executandoEtapa, setExecutandoEtapa] = useState(false)
  const [enviandoAnexo, setEnviandoAnexo] = useState(false)

  const inputArquivoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!Number.isFinite(pk)) return
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pk])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const [respTicket, respOs] = await Promise.all([
        detalheTicket(pk).catch(() => null),
        listarOrdensServico({ ticketPk: pk, minhas: false, abertas: false, limit: 5 }),
      ])
      if (respTicket) setTicket(respTicket.ticket)
      const aberta = respOs.results.find((os) => !os.op_date_close && !os.op_date_cancel)
      const os = aberta ?? respOs.results[0] ?? null
      setOsAtual(os)

      if (os?.client_pk) {
        buscarDetalheCliente(os.client_pk)
          .then((resposta) => {
            setTelefone(resposta.cliente.client_phones ?? null)
            const contratoDaOs = resposta.contratos.find((c) => c.contract_pk === os.contract_pk)
            setContrato(contratoDaOs ?? resposta.contratos[0] ?? null)
          })
          .catch(() => {})
        // Prioriza o contrato específico desta OS pra achar a CPE certa —
        // client_pk sozinho poderia trazer a CPE de outro contrato do
        // mesmo cliente, se ele tiver mais de uma conexão.
        buscarCpe(os.contract_pk ? { contract_pk: os.contract_pk } : { client_pk: os.client_pk })
          .then((resposta) => setCpe(resposta.results[0] ?? null))
          .catch(() => {})
      }
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar esta OS.')
    } finally {
      setCarregando(false)
    }
  }

  async function copiar(valor: string | undefined, rotulo: string) {
    if (!valor) return
    try {
      await navigator.clipboard.writeText(valor)
      toast(`${rotulo} copiado.`, 'sucesso')
    } catch {
      toast('Não foi possível copiar.')
    }
  }

  async function confirmarEtapa() {
    const etapa = ETAPAS.find((e) => e.chave === etapaConfirmando)
    if (!etapa || !osAtual?.op_os_pk) {
      toast('Nenhuma OS aberta encontrada pra este chamado.')
      setEtapaConfirmando(null)
      return
    }
    const observacao = observacaoEtapa.trim()
    if (!observacao) {
      toast('Descreva o que foi feito antes de continuar.')
      return
    }
    setExecutandoEtapa(true)
    try {
      await etapa.acao(pk, { opOsPk: osAtual.op_os_pk, opDesc: observacao })
      toast(`OS marcada como ${etapa.rotulo.toLowerCase()}.`, 'sucesso')
      setEtapaConfirmando(null)
      setObservacaoEtapa('')
      setOsAtual((atual) => (atual ? { ...atual, [etapa.campoData]: agoraNoFormatoDoServidor() } : atual))
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : `Não foi possível marcar a OS como ${etapa.rotulo.toLowerCase()}.`)
    } finally {
      setExecutandoEtapa(false)
    }
  }

  async function aoSelecionarArquivo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!arquivo) return
    setEnviandoAnexo(true)
    try {
      // O anexo vai pro chamado (ticket) — é o mesmo endpoint/local onde
      // ele aparece na tela de chat do Suporte, mesmo sendo anexado aqui
      // na tela da OS.
      await enviarAnexoTicket(pk, arquivo)
      toast('Anexo enviado.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível enviar o anexo.')
    } finally {
      setEnviandoAnexo(false)
    }
  }

  if (!Number.isFinite(pk)) {
    return <p className="detalhe-ordem-status">OS não encontrada.</p>
  }

  const proxima = proximaEtapa(osAtual)

  return (
    <div className="detalhe-ordem-tela tela-entrada">
      <VoltarInicio to="/suporte" label="OS" />

      {carregando && (
        <div className="detalhe-ordem-card">
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={13} />
        </div>
      )}

      {!carregando && erro && (
        <div className="detalhe-ordem-status">
          <p>{erro}</p>
          <button onClick={carregar}>Tentar novamente</button>
        </div>
      )}

      {!carregando && !erro && !osAtual && (
        <div className="detalhe-ordem-card">
          <p className="detalhe-ordem-vazio">Nenhuma OS encontrada pra este chamado.</p>
          <Link to={`/suporte/${pk}`} className="detalhe-ordem-chip" viewTransition>
            <MdChatBubbleOutline size={14} /> Ver chamado
          </Link>
        </div>
      )}

      {!carregando && !erro && osAtual && (
        <>
          <div className="detalhe-ordem-card">
            <div className="detalhe-ordem-topo">
              <strong>{ticket?.ticket_title ?? osAtual.op_desc ?? `OS #${osAtual.op_os_pk ?? pk}`}</strong>
              <span className="detalhe-ordem-etapa-badge">{rotuloEtapaAtual(osAtual)}</span>
            </div>
            {(ticket?.ticket_protocol ?? osAtual.ticket_protocol) && (
              <p className="detalhe-ordem-linha">Protocolo: {ticket?.ticket_protocol ?? osAtual.ticket_protocol}</p>
            )}
            {osAtual.op_date_sched && <p className="detalhe-ordem-linha">Agendada para {formatarDataHora(osAtual.op_date_sched)}</p>}
            <Link to={`/suporte/${pk}`} className="detalhe-ordem-chip" viewTransition>
              <MdChatBubbleOutline size={14} /> Ver chamado
            </Link>
          </div>

          <div className="detalhe-ordem-card">
            <h2>Cliente</h2>
            <div className="detalhe-ordem-linha-campo">
              <span>Nome</span>
              {osAtual.client_pk ? (
                <Link to={`/clientes/${osAtual.client_pk}`} className="detalhe-ordem-link" viewTransition>
                  <MdPeopleAlt size={14} /> {osAtual.client_complete_name ?? '—'}
                </Link>
              ) : (
                <strong>{osAtual.client_complete_name ?? '—'}</strong>
              )}
            </div>
            {telefone && (
              <div className="detalhe-ordem-linha-campo">
                <span>Contato</span>
                <strong>{telefone}</strong>
              </div>
            )}
          </div>

          <div className="detalhe-ordem-card">
            <h2>Endereço</h2>
            <p className="detalhe-ordem-linha">{enderecoCompleto(osAtual)}</p>
            {osAtual.address_zipcode && <p className="detalhe-ordem-linha">CEP: {osAtual.address_zipcode}</p>}
          </div>

          <div className="detalhe-ordem-card">
            <h2>Contrato</h2>
            <div className="detalhe-ordem-linha-campo">
              <span>Número</span>
              <strong>{contrato?.contract_number ?? osAtual.contract_number ?? '—'}</strong>
            </div>
            <div className="detalhe-ordem-linha-campo">
              <span>Vencimento</span>
              <strong>{contrato?.contract_pay_day ? `Dia ${contrato.contract_pay_day}` : '—'}</strong>
            </div>
            <div className="detalhe-ordem-linha-campo">
              <span>Status</span>
              <strong>{contrato?.contract_status != null ? formatarStatusContrato(contrato.contract_status) : '—'}</strong>
            </div>
          </div>

          <div className="detalhe-ordem-card">
            <h2>Conexão</h2>
            <div className="detalhe-ordem-linha-campo">
              <span>Usuário</span>
              <div className="detalhe-ordem-campo-valor">
                <strong>{cpe?.username ?? '—'}</strong>
                <button onClick={() => copiar(cpe?.username, 'Usuário')} aria-label="Copiar usuário">
                  <MdContentCopy size={16} />
                </button>
              </div>
            </div>
            <div className="detalhe-ordem-linha-campo">
              <span>Senha</span>
              <div className="detalhe-ordem-campo-valor">
                <strong>{mostrarSenha ? cpe?.password ?? '—' : '••••••••'}</strong>
                <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                  {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                </button>
                <button onClick={() => copiar(cpe?.password, 'Senha')} aria-label="Copiar senha">
                  <MdContentCopy size={16} />
                </button>
              </div>
            </div>
            <div className="detalhe-ordem-linha-campo">
              <span>IP</span>
              <strong>{cpe?.v4_ip ?? cpe?.v4_ip_last ?? '—'}</strong>
            </div>
            <div className="detalhe-ordem-linha-campo">
              <span>MAC</span>
              <strong>{cpe?.mac ?? cpe?.mac_last ?? '—'}</strong>
            </div>
            <div className="detalhe-ordem-linha-campo">
              <span>CTO</span>
              <strong>{cpe?.dp_name ?? '—'}</strong>
            </div>
            <div className="detalhe-ordem-linha-campo">
              <span>Porta da CTO</span>
              <strong>{cpe?.dp_port ?? '—'}</strong>
            </div>
            {cpe?.pk && (
              <Link to={`/conexao?cpe_pk=${cpe.pk}`} className="detalhe-ordem-chip" viewTransition>
                <MdWifi size={14} /> Ver conexão completa
              </Link>
            )}
          </div>

          <div className="detalhe-ordem-card">
            <h2>Anexo</h2>
            <input ref={inputArquivoRef} type="file" style={{ display: 'none' }} onChange={aoSelecionarArquivo} />
            <button className="detalhe-ordem-btn-secundario" disabled={enviandoAnexo} onClick={() => inputArquivoRef.current?.click()}>
              <MdAttachFile size={16} /> {enviandoAnexo ? 'Enviando…' : 'Anexar arquivo ao chamado'}
            </button>
          </div>

          {proxima && (
            <button className="detalhe-ordem-btn-etapa" onClick={() => setEtapaConfirmando(proxima.chave)}>
              <proxima.Icone size={18} /> {proxima.rotuloAcao}
            </button>
          )}
        </>
      )}

      {etapaConfirmando && (
        <div
          className="detalhe-ordem-modal-fundo"
          onClick={() => {
            setEtapaConfirmando(null)
            setObservacaoEtapa('')
          }}
        >
          <div className="detalhe-ordem-modal" onClick={(evento) => evento.stopPropagation()}>
            <h2>{ETAPAS.find((e) => e.chave === etapaConfirmando)?.rotuloAcao}?</h2>
            <p className="detalhe-ordem-modal-texto">Descreva o que foi feito — o sistema exige essa observação.</p>
            <textarea
              value={observacaoEtapa}
              onChange={(e) => setObservacaoEtapa(e.target.value)}
              placeholder="Ex: Trocado cabo de rede, sinal normalizado."
              rows={3}
            />
            <div className="detalhe-ordem-modal-acoes">
              <button
                onClick={() => {
                  setEtapaConfirmando(null)
                  setObservacaoEtapa('')
                }}
              >
                Cancelar
              </button>
              <button className="detalhe-ordem-btn-primario" disabled={executandoEtapa} onClick={confirmarEtapa}>
                {executandoEtapa ? 'Salvando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
