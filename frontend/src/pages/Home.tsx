import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MdQrCodeScanner, MdSearch } from 'react-icons/md'
// Atalhos com ícones Lucide, iguais aos da barra de baixo.
import { LuCalendarClock, LuChevronRight, LuHammer, LuServer, LuWifiOff } from 'react-icons/lu'
import { useSessao } from '../auth/useSessao'
import { CORES, comAlpha } from '../utils/cores'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useColetorOlt } from '../hooks/useColetorOlt'
import { useAvisos } from '../hooks/useAvisos'
import ModalInstalarIos from '../components/ModalInstalarIos'
import ModalConfirmarLogout from '../components/ModalConfirmarLogout'
import LeitorCodigoBarras from '../components/LeitorCodigoBarras'
import FolhaConfiguracoes from '../components/FolhaConfiguracoes'
import MinhasOsHoje, { type ResumoDoDia } from '../components/MinhasOsHoje'
import PullToRefresh from '../components/PullToRefresh'
import {
  buscarClientes,
  buscarCpe,
  buscarOnu,
  listarCpeOffline,
  resumoDoDia,
  type BuscaClienteResultado,
  type CpeDto,
  type OnuDto,
} from '../api/client'
import { dataParaFormatoServidor, detectarTipoBusca, formatarDocumento, iniciais } from '../utils/formatacao'
import './Home.css'

function saudacaoPorHorario(nome: string): string {
  const hora = new Date().getHours()
  const periodo = hora >= 5 && hora < 12 ? 'Bom dia' : hora >= 12 && hora < 18 ? 'Boa tarde' : 'Boa noite'
  return `${periodo}, ${nome}!`
}

// Atalhos em lista, cada um com uma informação útil. Sem "OS / Suporte",
// Conexão e ONU (já estão na barra de baixo) e sem "Clientes" (é a busca
// do topo).
function plural(n: number, um: string, varios: string): string {
  return n === 1 ? `1 ${um}` : `${n} ${varios}`
}

/** Data de hoje ("quarta-feira, 04/11") — as quantidades ficam nos números abaixo. */
function textoHoje(): string {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

export default function Home() {
  const { tecnico, sair } = useSessao()
  const navigate = useNavigate()
  const { podeInstalar, aoClicarInstalar, modalIosAberto, fecharModalIos } = usePwaInstall()
  const [configuracoesAberta, setConfiguracoesAberta] = useState(false)
  const [confirmarSairAberto, setConfirmarSairAberto] = useState(false)
  const coletorOlt = useColetorOlt()
  // Resumo do dia embaixo da saudação (vem de "Minhas OS de hoje").
  const [resumoDia, setResumoDia] = useState<ResumoDoDia | null>(null)
  // Barra "X de Y OS concluídas": vem de rota própria porque a lista de OS
  // tira as finalizadas/fechadas (ver backend ordens_servico.py::resumo_do_dia).
  const [progresso, setProgresso] = useState<{ total: number; concluidas: number } | null>(null)
  // Quantos clientes estão offline agora (atalho "Clientes Offline"). Só o
  // total: a consulta pede 1 registro.
  const [totalOffline, setTotalOffline] = useState<number | null>(null)
  const avisos = useAvisos()
  // Por que o interruptor está travado, quando está.
  const dicaAvisos =
    avisos.estado === 'instalar'
      ? 'Instale o app na tela inicial para receber'
      : avisos.estado === 'sem-suporte'
        ? 'Este navegador não recebe avisos'
        : avisos.estado === 'bloqueado'
          ? 'Notificações bloqueadas nas configurações do celular'
          : null

  // Mesmo combobox de busca ao vivo já usado em Conexão (usuário PPPoE) e
  // ONU/CTO: digita um pedaço do nome/contrato/documento e a lista vai
  // filtrando no backend com debounce, sem precisar apertar buscar nem
  // sair da Home para ver o resultado — clicar num item já leva direto
  // para o cliente. Sem botão de buscar (lupa): o combobox já cobre a busca
  // sozinho; Enter no campo ainda leva para tela de busca completa, útil
  // quando há muitos resultados para rolar.
  const [busca, setBusca] = useState('')
  // Busca geral: cliente + ONU pelo serial (prefixo) + conexão pelo
  // usuário PPPoE, em paralelo. Texto com espaço é nome: só cliente.
  const [resultadosBusca, setResultadosBusca] = useState<BuscaClienteResultado[]>([])
  const [onusBusca, setOnusBusca] = useState<OnuDto[]>([])
  const [conexoesBusca, setConexoesBusca] = useState<CpeDto[]>([])
  const [buscando, setBuscando] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)
  // Leitor pela câmera (etiqueta da ONU: código de barras ou QR).
  const [lendoCodigo, setLendoCodigo] = useState(false)

  // Muda a cada "puxar para atualizar" — remonta MinhasOsHoje, que relê a
  // lista sozinha ao montar.
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let cancelado = false
    resumoDoDia(dataParaFormatoServidor(new Date()).slice(0, 10))
      .then((resposta) => {
        if (!cancelado) setProgresso({ total: resposta.total, concluidas: resposta.concluidas })
      })
      .catch(() => {})
    listarCpeOffline({ start: 0, limit: 1 })
      .then((resposta) => {
        if (!cancelado) setTotalOffline(resposta.total)
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    const termo = busca.trim()
    if (termo.length < 2) {
      setResultadosBusca([])
      setOnusBusca([])
      setConexoesBusca([])
      return
    }
    let cancelado = false
    setBuscando(true)
    const temporizador = setTimeout(() => {
      const semEspaco = !/\s/.test(termo)
      Promise.allSettled([
        buscarClientes(detectarTipoBusca(termo)),
        semEspaco ? buscarOnu({ serial: termo }) : Promise.resolve({ results: [] as OnuDto[] }),
        semEspaco ? buscarCpe({ username: termo }) : Promise.resolve({ results: [] as CpeDto[] }),
      ])
        .then(([clientes, onus, conexoes]) => {
          if (cancelado) return
          setResultadosBusca(clientes.status === 'fulfilled' ? clientes.value.results : [])
          setOnusBusca(onus.status === 'fulfilled' ? onus.value.results : [])
          setConexoesBusca(conexoes.status === 'fulfilled' ? conexoes.value.results : [])
        })
        .finally(() => {
          if (!cancelado) setBuscando(false)
        })
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [busca])

  async function atualizarTela() {
    setRecarga((atual) => atual + 1)
    await Promise.all([
      resumoDoDia(dataParaFormatoServidor(new Date()).slice(0, 10))
        .then((resposta) => setProgresso({ total: resposta.total, concluidas: resposta.concluidas }))
        .catch(() => {}),
      listarCpeOffline({ start: 0, limit: 1 })
        .then((resposta) => setTotalOffline(resposta.total))
        .catch(() => {}),
    ])
  }

  async function aoClicarInstalarMenu() {
    setConfiguracoesAberta(false)
    await aoClicarInstalar()
  }

  function aoBuscar(evento: FormEvent) {
    evento.preventDefault()
    const termo = busca.trim()
    // Mesmo parâmetro que BuscaCliente.tsx já lê sozinho ao montar
    // (?busca=...) — chegar lá com o termo na URL já dispara a busca,
    // sem precisar digitar de novo na outra tela.
    navigate(termo ? `/clientes?busca=${encodeURIComponent(termo)}` : '/clientes', { viewTransition: true })
  }

  return (
    <PullToRefresh aoAtualizar={atualizarTela}>
      <div className="home-tela tela-entrada">
        <div className="home-conteudo">
          <header className="home-cabecalho">
            <div className="home-header-saudacao">
              <span className="home-saudacao">{saudacaoPorHorario(tecnico?.username ?? 'Técnico')}</span>
              <span className="home-resumo">{textoHoje()}</span>
            </div>

            <div className="home-avatar-wrapper">
              <button className="home-avatar" onClick={() => setConfiguracoesAberta(true)} aria-label="Configurações">
                {iniciais(tecnico?.username)}
              </button>
            </div>
            {/* Números do dia: o que está aberto, o que atrasou e o que já
                foi concluído hoje. */}
            {/* Os três com o mesmo destaque. Abertas e Atrasadas levam à tela
                de OS já filtrada; Concluídas não tem lista (a tela de OS só
                carrega OS em aberto). */}
            <nav className="home-numeros" aria-label="OS do dia">
              <Link to="/suporte?quando=hoje" className="home-numero" viewTransition>
                <strong>{resumoDia?.total ?? '–'}</strong>
                <span>Abertas</span>
              </Link>
              <Link to="/suporte?quando=atrasadas" className="home-numero" viewTransition>
                <strong>{resumoDia?.atrasadas ?? '–'}</strong>
                <span>Atrasadas</span>
              </Link>
              <div className="home-numero">
                <strong>{progresso?.concluidas ?? '–'}</strong>
                <span>Concluídas</span>
              </div>
            </nav>
            {progresso && progresso.total > 0 && (
              <div className="home-progresso">
                <div
                  className="home-progresso-trilho"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={progresso.total}
                  aria-valuenow={progresso.concluidas}
                  aria-label="OS concluídas hoje"
                >
                  <span style={{ width: `${(progresso.concluidas / progresso.total) * 100}%` }} />
                </div>
                <span className="home-progresso-texto">
                  {progresso.concluidas} de {progresso.total} OS concluída{progresso.total > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </header>

          <form className="home-busca home-combobox" onSubmit={aoBuscar}>
            <div className="home-busca-campo">
              <MdSearch size={20} className="home-busca-icone" aria-hidden="true" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onFocus={() => setListaAberta(true)}
                onBlur={() => setTimeout(() => setListaAberta(false), 150)}
                placeholder="Cliente, CPF, contrato, ONU, PPPoE"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="home-busca-leitor"
                onClick={() => setLendoCodigo(true)}
                aria-label="Ler código de barras ou QR pela câmera"
                title="Ler código de barras ou QR pela câmera"
              >
                <MdQrCodeScanner size={22} />
              </button>
            </div>
            {listaAberta && busca.trim().length >= 2 && (
              <ul className="home-combobox-lista">
                {buscando && <li className="home-combobox-vazio">Buscando…</li>}
                {!buscando && resultadosBusca.length + onusBusca.length + conexoesBusca.length === 0 && (
                  <li className="home-combobox-vazio">Nada encontrado.</li>
                )}
                {!buscando &&
                  onusBusca.map((onu) => (
                    <li key={`onu-${onu.pk}`}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setListaAberta(false)
                          navigate(`/onu?serial=${encodeURIComponent(onu.sn ?? '')}`, { viewTransition: true })
                        }}
                      >
                        <span className="home-combobox-tipo" style={{ color: CORES.onu }}>
                          ONU
                        </span>
                        <strong>{onu.sn ?? `ONU #${onu.pk}`}</strong>
                        {onu.client_name && ` — ${onu.client_name}`}
                      </button>
                    </li>
                  ))}
                {!buscando &&
                  conexoesBusca.map((cpe) => (
                    <li key={`cpe-${cpe.pk}`}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setListaAberta(false)
                          navigate(`/conexao?cpe_pk=${cpe.pk}`, { viewTransition: true })
                        }}
                      >
                        <span className="home-combobox-tipo" style={{ color: CORES.conexao }}>
                          PPPoE
                        </span>
                        <strong>{cpe.username ?? `Conexão #${cpe.pk}`}</strong>
                        {cpe.client_complete_name && ` — ${cpe.client_complete_name}`}
                      </button>
                    </li>
                  ))}
                {!buscando &&
                  resultadosBusca.map((resultado) => (
                    <li key={resultado.client_pk}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setListaAberta(false)
                          navigate(`/clientes/${resultado.client_pk}`, { viewTransition: true })
                        }}
                      >
                        <strong>
                          {resultado.cliente.client_complete_name ?? resultado.cliente.client_name ?? `Cliente #${resultado.client_pk}`}
                        </strong>
                        {resultado.cliente.client_doc1 && ` — ${formatarDocumento(resultado.cliente.client_doc1)}`}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </form>

          <MinhasOsHoje key={recarga} onResumo={setResumoDia} />

          <nav className="home-atalhos" aria-label="Atalhos">
            <Link to="/suporte?quando=proximas" className="home-atalho" viewTransition>
              <span className="home-atalho-icone" style={{ background: comAlpha(CORES.suporte, 14), color: CORES.suporte }}>
                <LuCalendarClock size={22} />
              </span>
              <span className="home-atalho-texto">
                <strong>Próximas OS</strong>
                <span>
                  {resumoDia == null
                    ? 'Agendadas para os próximos dias'
                    : resumoDia.proximas === 0
                      ? 'Nenhuma agendada para os próximos dias'
                      : `${plural(resumoDia.proximas, 'agendada', 'agendadas')} para os próximos dias`}
                </span>
              </span>
              <LuChevronRight size={20} className="home-atalho-seta" aria-hidden="true" />
            </Link>
            <Link to="/offline" className="home-atalho" viewTransition>
              <span className="home-atalho-icone" style={{ background: comAlpha(CORES.offline, 14), color: CORES.offline }}>
                <LuWifiOff size={22} />
              </span>
              <span className="home-atalho-texto">
                <strong>Clientes offline</strong>
                <span>
                  {totalOffline == null ? (
                    'Sem sessão de internet agora'
                  ) : (
                    <>
                      <b className="home-atalho-destaque">{totalOffline}</b> offline agora
                    </>
                  )}
                </span>
              </span>
              <LuChevronRight size={20} className="home-atalho-seta" aria-hidden="true" />
            </Link>
            <Link to="/ferramentas" className="home-atalho" viewTransition>
              <span className="home-atalho-icone" style={{ background: comAlpha(CORES.ferramentas, 14), color: CORES.ferramentas }}>
                <LuHammer size={22} />
              </span>
              <span className="home-atalho-texto">
                <strong>Ferramentas</strong>
                <span>Meu IP e testes de velocidade</span>
              </span>
              <LuChevronRight size={20} className="home-atalho-seta" aria-hidden="true" />
            </Link>
            {/* Coletor de OLTs: outro app no mesmo domínio (/olt/), opcional —
                só aparece se estiver instalado. Link normal (não do router):
                sai do PWA do técnico e abre o coletor, que usa a mesma sessão. */}
            {coletorOlt && (
              <a href="/olt/" className="home-atalho">
                <span className="home-atalho-icone" style={{ background: comAlpha(CORES.olts, 14), color: CORES.olts }}>
                  <LuServer size={22} />
                </span>
                <span className="home-atalho-texto">
                  <strong>OLTs</strong>
                  <span>Coletor de OLTs</span>
                </span>
                <LuChevronRight size={20} className="home-atalho-seta" aria-hidden="true" />
              </a>
            )}
          </nav>

        </div>

        {/* O código lido entra no campo: a busca geral já procura serial de
            ONU, PPPoE e cliente ao mesmo tempo. */}
        {lendoCodigo && (
          <LeitorCodigoBarras
            onDetectado={(valor) => {
              setLendoCodigo(false)
              setBusca(valor.trim())
              setListaAberta(true)
            }}
            onFechar={() => setLendoCodigo(false)}
          />
        )}
        <ModalInstalarIos aberto={modalIosAberto} onFechar={fecharModalIos} />
        <FolhaConfiguracoes
          aberto={configuracoesAberta}
          usuario={tecnico?.username}
          avisos={avisos}
          dicaAvisos={dicaAvisos}
          podeInstalar={podeInstalar}
          onInstalar={aoClicarInstalarMenu}
          onSair={() => {
            setConfiguracoesAberta(false)
            setConfirmarSairAberto(true)
          }}
          onFechar={() => setConfiguracoesAberta(false)}
        />
        <ModalConfirmarLogout
          aberto={confirmarSairAberto}
          onCancelar={() => setConfirmarSairAberto(false)}
          onConfirmar={() => {
            setConfirmarSairAberto(false)
            // RotaProtegida já redireciona pro /login sozinho assim que
            // "logado" vira false (ver RotaProtegida.tsx) — navegar aqui
            // manualmente, sem esperar sair() terminar, desmontaria a tela
            // antes do POST /auth/logout ser disparado. Os avisos de OS
            // continuam ligados (só o interruptor do avatar desliga).
            sair()
          }}
        />
      </div>
    </PullToRefresh>
  )
}
