import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  MdAttachFile,
  MdCheckCircle,
  MdChatBubbleOutline,
  MdContentCopy,
  MdEdit,
  MdLocationOn,
  MdPeopleAlt,
  MdPlayArrow,
  MdVisibility,
  MdVisibilityOff,
  MdWifi,
} from 'react-icons/md'
import ModalEditarEndereco from '../components/ModalEditarEndereco'
import VoltarInicio from '../components/VoltarInicio'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import {
  ApiError,
  buscarCpe,
  buscarDetalheCliente,
  desfazerFinalizacaoOrdemServico,
  desfazerInicioOrdemServico,
  desfazerRespostaOrdemServico,
  detalheTicket,
  enviarAnexoTicket,
  finalizarOrdemServico,
  iniciarOrdemServico,
  listarMensagensTicket,
  listarOrdensServico,
  responderOrdemServico,
  type ContratoDto,
  type CpeDto,
  type EnderecoDto,
  type OperacaoDto,
  type OrdemServicoDto,
  type TicketDto,
} from '../api/client'
import { extrairTelefones, formatarDataHora, formatarStatusContrato } from '../utils/formatacao'
import './DetalheOrdemServico.css'

// Os 4 estágios reais de uma OS (confirmado com o dono da operação e
// capturado ao vivo do painel do Controllr — não documentado
// oficialmente): Agendada (feita pelo escritório, já vem pronta) ->
// Respondida -> Iniciada -> Finalizada, as 3 últimas marcadas (e
// desmarcadas) pelo técnico aqui. Fechar é etapa À PARTE, só do
// escritório (ACL do Controllr não libera para o técnico) — por isso não
// tem botão de fechar nesta tela.
//
// IMPORTANTE: os campos op_date_answer/start/finish do registro RAIZ da
// OS (osAtual) ficam SEMPRE nulos — confirmado ao vivo. Cada clique em
// marcar/desfazer cria um novo registro de EVENTO em /support_ctl/op/
// list (mesmo endpoint do chat, ver listarMensagensTicket) vinculado à
// OS via op_os_pk = op_pk da raiz. Um "marcar" grava esse evento com a
// data preenchida; um "desfazer" grava outro evento do MESMO op_type
// com a data nula. Por isso o estágio de cada etapa é calculado a
// partir do evento mais recente daquele tipo, não de um campo fixo.
type Etapa = 'responder' | 'iniciar' | 'finalizar'

interface ConfigEtapa {
  chave: Etapa
  rotulo: string
  rotuloMarcar: string
  rotuloDesfazer: string
  opType: number
  campoData: 'op_date_answer' | 'op_date_start' | 'op_date_finish'
  Icone: typeof MdVisibility
  marcar: typeof responderOrdemServico
  desfazer: typeof desfazerRespostaOrdemServico
}

const ETAPAS: ConfigEtapa[] = [
  {
    chave: 'responder',
    rotulo: 'Respondida',
    rotuloMarcar: 'Marcar como respondida',
    rotuloDesfazer: 'Desfazer resposta',
    opType: 3,
    campoData: 'op_date_answer',
    Icone: MdVisibility,
    marcar: responderOrdemServico,
    desfazer: desfazerRespostaOrdemServico,
  },
  {
    chave: 'iniciar',
    rotulo: 'Iniciada',
    rotuloMarcar: 'Iniciar atendimento',
    rotuloDesfazer: 'Desfazer início',
    opType: 4,
    campoData: 'op_date_start',
    Icone: MdPlayArrow,
    marcar: iniciarOrdemServico,
    desfazer: desfazerInicioOrdemServico,
  },
  {
    chave: 'finalizar',
    rotulo: 'Finalizada',
    rotuloMarcar: 'Finalizar atendimento',
    rotuloDesfazer: 'Desfazer finalização',
    opType: 5,
    campoData: 'op_date_finish',
    Icone: MdCheckCircle,
    marcar: finalizarOrdemServico,
    desfazer: desfazerFinalizacaoOrdemServico,
  },
]

/** Evento mais recente (maior op_pk) daquele tipo, vinculado à OS raiz — ou undefined se nunca aconteceu. */
function ultimoEvento(eventos: OperacaoDto[], osRaizPk: number, opType: number): OperacaoDto | undefined {
  return eventos
    .filter((e) => e.op_os_pk === osRaizPk && e.op_type === opType)
    .reduce<OperacaoDto | undefined>((mais_recente, atual) => {
      if (!mais_recente) return atual
      return (atual.op_pk ?? 0) > (mais_recente.op_pk ?? 0) ? atual : mais_recente
    }, undefined)
}

function etapaConcluida(eventos: OperacaoDto[], osRaizPk: number, etapa: ConfigEtapa): boolean {
  const evento = ultimoEvento(eventos, osRaizPk, etapa.opType)
  return !!evento?.[etapa.campoData]
}

/**
 * As 3 etapas do técnico seguem sequência obrigatória, nos dois sentidos
 * (pedido explícito): não dá para pular direto para "Finalizada" sem
 * "Respondida"/"Iniciada" antes, e para desfazer uma etapa é preciso
 * desfazer as posteriores primeiro (não dá para desfazer "Respondida"
 * com "Iniciada" ainda de pé). Cada etapa só tem UMA ação disponível
 * por vez: "confirmar" se é a próxima pendente, "desfazer" se é a
 * última concluída — nunca as duas, nunca nenhuma no meio da lista.
 */
function situacaoEtapa(concluidas: boolean[], indice: number): 'confirmar' | 'desfazer' | 'bloqueada' {
  if (concluidas[indice]) {
    // Só a última concluída pode ser desfeita — se alguma posterior
    // também estiver concluída, essa aqui fica bloqueada até lá.
    const temPosteriorConcluida = concluidas.slice(indice + 1).some(Boolean)
    return temPosteriorConcluida ? 'bloqueada' : 'desfazer'
  }
  // Só a primeira pendente pode ser confirmada — precisa das anteriores prontas.
  const anterioresProntas = concluidas.slice(0, indice).every(Boolean)
  return anterioresProntas ? 'confirmar' : 'bloqueada'
}

/** Rótulo resumido para o cabeçalho — a última das 3 etapas que estiver concluída, ou "Agendada". */
function estagioResumo(eventos: OperacaoDto[], os: OrdemServicoDto): string {
  if (os.op_date_cancel) return 'Cancelada'
  if (os.op_date_close) return 'Fechada'
  if (!os.op_pk) return 'Agendada'
  for (let i = ETAPAS.length - 1; i >= 0; i--) {
    if (etapaConcluida(eventos, os.op_pk, ETAPAS[i])) return ETAPAS[i].rotulo
  }
  return 'Agendada'
}

function enderecoResumo(endereco: { address?: string; address_number?: string; address_neighborhood?: string }): string {
  return (
    [endereco.address, endereco.address_number, endereco.address_neighborhood].filter(Boolean).join(', ') ||
    'Endereço não informado'
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
  const [endereco, setEndereco] = useState<EnderecoDto | null>(null)
  const [enderecoEditando, setEnderecoEditando] = useState<EnderecoDto | null>(null)
  const [cpe, setCpe] = useState<CpeDto | null>(null)
  const [eventos, setEventos] = useState<OperacaoDto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  // { etapa, desfazer: true } quando o técnico clica no botão de uma
  // etapa JÁ concluída (quer desfazer); false quando quer marcar.
  const [acaoConfirmando, setAcaoConfirmando] = useState<{ etapa: Etapa; desfazer: boolean } | null>(null)
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
      recarregarEventos()

      if (os?.client_pk) {
        buscarDetalheCliente(os.client_pk)
          .then((resposta) => {
            setTelefone(extrairTelefones(resposta.cliente.client_phones))
            const contratoDaOs = resposta.contratos.find((c) => c.contract_pk === os.contract_pk)
            setContrato(contratoDaOs ?? resposta.contratos[0] ?? null)
            // Mesmos dados do endereço mostrados no Detalhe do Cliente
            // (cidade/UF, coordenadas para o Google Maps) — a OS em si só traz
            // um resumo (address/number/neighborhood), sem isso.
            const enderecoDaOs = resposta.enderecos.find((e) => e.address_pk === os.address_pk)
            setEndereco(enderecoDaOs ?? resposta.enderecos[0] ?? null)
          })
          .catch(() => {})
        // Prioriza o contrato específico desta OS para achar a CPE certa —
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

  // Os eventos de responder/iniciar/finalizar/desfazer vêm do MESMO
  // endpoint do chat (/support_ctl/op/list) — recarrega só isso depois
  // de uma ação, sem precisar refazer as buscas de cliente/contrato/CPE.
  function recarregarEventos() {
    listarMensagensTicket(pk)
      .then((resposta) => setEventos(resposta.results))
      .catch(() => {})
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
    const indice = ETAPAS.findIndex((e) => e.chave === acaoConfirmando?.etapa)
    const etapa = ETAPAS[indice]
    // O parâmetro que a ação espera ("op_os_pk") é, na real, o PRÓPRIO
    // op_pk da OS raiz (agendada pelo escritório) — confirmado capturando
    // o clique real no painel do Controllr: o corpo enviado foi
    // op_os_pk=4227, que era o op_pk do registro agendado (cujo campo
    // op_os_pk vem null, já que ele não referencia "outra" OS, é a
    // própria — só os EVENTOS que ela gera têm op_os_pk preenchido).
    if (!etapa || !acaoConfirmando || !osAtual?.op_pk) {
      toast('Nenhuma OS aberta encontrada para este chamado.')
      setAcaoConfirmando(null)
      return
    }
    // Confere de novo com os dados mais recentes (defesa contra estado
    // desatualizado, ex: outro técnico mexeu na mesma OS enquanto o
    // diálogo estava aberto) — o botão já vem desabilitado fora de
    // ordem, mas não custa garantir aqui também.
    const concluidas = ETAPAS.map((e) => etapaConcluida(eventos, osAtual.op_pk!, e))
    const situacao = situacaoEtapa(concluidas, indice)
    const acaoEsperada = acaoConfirmando.desfazer ? 'desfazer' : 'confirmar'
    if (situacao !== acaoEsperada) {
      toast(
        acaoConfirmando.desfazer
          ? `Não dá para desfazer "${etapa.rotulo}" agora — desfaça as etapas seguintes primeiro.`
          : `Não dá para confirmar "${etapa.rotulo}" agora — confirme as etapas anteriores primeiro.`,
      )
      setAcaoConfirmando(null)
      setObservacaoEtapa('')
      recarregarEventos()
      return
    }
    const observacao = observacaoEtapa.trim()
    // Só "Finalizar" exige descrição (pedido explícito) — "Responder" e
    // "Iniciar" ficam com o campo opcional, para o técnico usar se quiser.
    // Desfazer nunca exige (o motivo de desfazer é sempre opcional).
    const exigeObservacao = etapa.chave === 'finalizar' && !acaoConfirmando.desfazer
    if (exigeObservacao && !observacao) {
      toast(`Descreva o que foi feito antes de confirmar "${etapa.rotulo}".`)
      return
    }
    setExecutandoEtapa(true)
    try {
      const chamada = acaoConfirmando.desfazer ? etapa.desfazer : etapa.marcar
      await chamada(pk, { opOsPk: osAtual.op_pk, opDesc: observacao })
      toast(
        acaoConfirmando.desfazer ? `Etapa "${etapa.rotulo}" desfeita.` : `Etapa "${etapa.rotulo}" confirmada.`,
        'sucesso',
      )
      setAcaoConfirmando(null)
      setObservacaoEtapa('')
      recarregarEventos()
    } catch (excecao) {
      toast(
        excecao instanceof ApiError
          ? excecao.message
          : acaoConfirmando.desfazer
            ? `Não foi possível desfazer "${etapa.rotulo}".`
            : `Não foi possível confirmar "${etapa.rotulo}".`,
      )
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
      // O anexo vai para o chamado (ticket) — é o mesmo endpoint/local onde
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
          <p className="detalhe-ordem-vazio">Nenhuma OS encontrada para este chamado.</p>
          <Link to={`/suporte/${pk}`} className="detalhe-ordem-chip" viewTransition>
            <MdChatBubbleOutline size={14} /> Ver chamado
          </Link>
        </div>
      )}

      {!carregando && !erro && osAtual && (
        <>
          <div className="detalhe-ordem-card">
            <div className="detalhe-ordem-topo">
              <strong>{ticket?.ticket_title ?? osAtual.op_desc ?? `OS #${osAtual.op_pk ?? pk}`}</strong>
              <span className="detalhe-ordem-etapa-badge">{estagioResumo(eventos, osAtual)}</span>
            </div>
            {osAtual.task_name && <p className="detalhe-ordem-linha">Tarefa: {osAtual.task_name}</p>}
            {(ticket?.ticket_protocol ?? osAtual.ticket_protocol) && (
              <p className="detalhe-ordem-linha">Chamado: {ticket?.ticket_protocol ?? osAtual.ticket_protocol}</p>
            )}
            {osAtual.op_number && <p className="detalhe-ordem-linha">OS: {osAtual.op_number}</p>}
            {osAtual.op_date_sched && <p className="detalhe-ordem-linha">Agendada para {formatarDataHora(osAtual.op_date_sched)}</p>}
            <Link to={`/suporte/${pk}`} className="detalhe-ordem-chip" viewTransition>
              <MdChatBubbleOutline size={14} /> Ver chamado
            </Link>
          </div>

          {(ticket?.ticket_desc || osAtual.op_obs) && (
            <div className="detalhe-ordem-card">
              {ticket?.ticket_desc && (
                <>
                  <h2>Descrição do problema</h2>
                  <p className="detalhe-ordem-descricao">{ticket.ticket_desc}</p>
                </>
              )}
              {osAtual.op_obs && (
                <>
                  <h2>Observação</h2>
                  <p className="detalhe-ordem-descricao">{osAtual.op_obs}</p>
                </>
              )}
            </div>
          )}

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
            <div className="detalhe-ordem-topo">
              <h2>Endereço</h2>
              {endereco?.address_pk && (
                <button
                  type="button"
                  className="detalhe-ordem-btn-icone"
                  onClick={() => setEnderecoEditando(endereco)}
                  aria-label="Editar endereço"
                >
                  <MdEdit size={16} />
                </button>
              )}
            </div>
            <p className="detalhe-ordem-linha">{enderecoResumo(endereco ?? osAtual)}</p>
            {(endereco?.address_province ?? osAtual.address_province) || (endereco?.address_state ?? osAtual.address_state) ? (
              <p className="detalhe-ordem-linha">
                {[endereco?.address_province ?? osAtual.address_province, endereco?.address_state ?? osAtual.address_state]
                  .filter(Boolean)
                  .join(' - ')}
              </p>
            ) : null}
            {(endereco?.address_zipcode ?? osAtual.address_zipcode) && (
              <p className="detalhe-ordem-linha">CEP: {endereco?.address_zipcode ?? osAtual.address_zipcode}</p>
            )}
            {endereco?.address_latitude && endereco?.address_longitude && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${endereco.address_latitude},${endereco.address_longitude}`}
                target="_blank"
                rel="noreferrer"
                className="detalhe-ordem-chip"
              >
                <MdLocationOn size={14} /> Ver no Google Maps
              </a>
            )}
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

          <div className="detalhe-ordem-card">
            <h2>Etapas da OS</h2>
            <div className="detalhe-ordem-etapa-item">
              <div className="detalhe-ordem-etapa-item-texto">
                <strong>Agendamento</strong>
                <span>{osAtual.op_date_sched ? formatarDataHora(osAtual.op_date_sched) : 'Feito pelo escritório'}</span>
              </div>
              <span className="detalhe-ordem-etapa-feito">Pronto</span>
            </div>
            {(() => {
              if (!osAtual.op_pk) return null
              const osRaizPk = osAtual.op_pk
              const concluidas = ETAPAS.map((e) => etapaConcluida(eventos, osRaizPk, e))
              return ETAPAS.map((etapa, indice) => {
                const evento = ultimoEvento(eventos, osRaizPk, etapa.opType)
                const concluida = concluidas[indice]
                const situacao = situacaoEtapa(concluidas, indice)
                // Texto explica POR QUE o botão está bloqueado, em vez de
                // só desabilitar sem dizer nada — pedido explícito de
                // deixar claro que a sequência é obrigatória nos dois
                // sentidos (marcar em ordem, desfazer em ordem reversa).
                let subtitulo: string
                if (concluida && evento) {
                  subtitulo = formatarDataHora(evento[etapa.campoData])
                  if (situacao === 'bloqueada') subtitulo += ` · desfaça "${ETAPAS[indice + 1]?.rotulo}" antes`
                } else if (situacao === 'bloqueada') {
                  subtitulo = `Aguardando "${ETAPAS[indice - 1]?.rotulo}"`
                } else {
                  subtitulo = 'Ainda não'
                }
                return (
                  <div key={etapa.chave} className="detalhe-ordem-etapa-item">
                    <div className="detalhe-ordem-etapa-item-texto">
                      <strong>{etapa.rotulo}</strong>
                      <span>{subtitulo}</span>
                    </div>
                    <button
                      type="button"
                      className={concluida ? 'detalhe-ordem-etapa-btn-desfazer' : 'detalhe-ordem-etapa-btn-marcar'}
                      disabled={situacao === 'bloqueada'}
                      onClick={() => setAcaoConfirmando({ etapa: etapa.chave, desfazer: concluida })}
                    >
                      <etapa.Icone size={14} /> {concluida ? 'Desfazer' : 'Confirmar'}
                    </button>
                  </div>
                )
              })
            })()}
          </div>
        </>
      )}

      {acaoConfirmando && (
        <div
          className="detalhe-ordem-modal-fundo"
          onClick={() => {
            setAcaoConfirmando(null)
            setObservacaoEtapa('')
          }}
        >
          <div className="detalhe-ordem-modal" onClick={(evento) => evento.stopPropagation()}>
            <h2>
              {(() => {
                const etapa = ETAPAS.find((e) => e.chave === acaoConfirmando.etapa)
                if (!etapa) return ''
                return acaoConfirmando.desfazer ? `${etapa.rotuloDesfazer}?` : `${etapa.rotuloMarcar}?`
              })()}
            </h2>
            <p className="detalhe-ordem-modal-texto">
              {acaoConfirmando.etapa === 'finalizar' && !acaoConfirmando.desfazer
                ? 'Descreva o que foi feito — obrigatório para finalizar.'
                : 'Descreva o que foi feito, se quiser (opcional).'}
            </p>
            <textarea
              value={observacaoEtapa}
              onChange={(e) => setObservacaoEtapa(e.target.value)}
              placeholder="Ex: Trocado cabo de rede, sinal normalizado."
              rows={3}
            />
            <div className="detalhe-ordem-modal-acoes">
              <button
                onClick={() => {
                  setAcaoConfirmando(null)
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

      {enderecoEditando && (
        <ModalEditarEndereco
          endereco={enderecoEditando}
          corDestaque={CORES.suporte}
          onFechar={() => setEnderecoEditando(null)}
          onSalvo={(atualizado) => {
            setEndereco(atualizado)
            setEnderecoEditando(null)
            toast('Endereço atualizado com sucesso.', 'sucesso')
          }}
        />
      )}
    </div>
  )
}
