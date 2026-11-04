import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MdBuild, MdCable, MdConstruction, MdRouter, MdSearch, MdWifi, MdWifiOff } from 'react-icons/md'
import { useSessao } from '../auth/useSessao'
import { CORES, comAlpha } from '../utils/cores'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useColetorOlt } from '../hooks/useColetorOlt'
import { useAvisos } from '../hooks/useAvisos'
import ModalInstalarIos from '../components/ModalInstalarIos'
import ModalConfirmarLogout from '../components/ModalConfirmarLogout'
import FolhaConfiguracoes from '../components/FolhaConfiguracoes'
import MinhasOsHoje, { type ResumoDoDia } from '../components/MinhasOsHoje'
import PullToRefresh from '../components/PullToRefresh'
import {
  buscarClientes,
  buscarCpe,
  buscarOnu,
  resumoDoDia,
  type BuscaClienteResultado,
  type CpeDto,
  type OnuDto,
} from '../api/client'
import { dataParaFormatoServidor, detectarTipoBusca, formatarDocumento } from '../utils/formatacao'
import './Home.css'

function saudacaoPorHorario(nome: string): string {
  const hora = new Date().getHours()
  const periodo = hora >= 5 && hora < 12 ? 'Bom dia' : hora >= 12 && hora < 18 ? 'Boa tarde' : 'Boa noite'
  return `${periodo}, ${nome}!`
}

// "Clientes" saiu daqui de propósito — virou o campo de busca direto no
// topo da tela (ver <form> abaixo), como primeira opção, em vez de mais
// um botão que só leva para outra tela para então buscar.
const ITENS_MENU = [
  { to: '/suporte', Icone: MdBuild, cor: CORES.suporte, label: 'OS / Suporte' },
  { to: '/conexao', Icone: MdWifi, cor: CORES.conexao, label: 'Conexão' },
  { to: '/onu', Icone: MdCable, cor: CORES.onu, label: 'ONU' },
  { to: '/offline', Icone: MdWifiOff, cor: CORES.offline, label: 'Clientes Offline' },
  { to: '/ferramentas', Icone: MdConstruction, cor: CORES.ferramentas, label: 'Ferramentas' },
]

/** "JM" de "jmanoelslva"; "MS" de "maria.silva" (partes separadas por . _ - ou espaço). */
function iniciais(usuario: string | undefined): string {
  const partes = (usuario ?? '').split(/[.\s_-]+/).filter(Boolean)
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase()
  return (partes[0] ?? '?').slice(0, 2).toUpperCase()
}

function textoResumo(resumo: ResumoDoDia | null): string {
  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
  if (!resumo) return hoje
  if (resumo.total === 0) return `${hoje} · nenhuma OS para hoje`
  const os = resumo.total === 1 ? '1 OS para hoje' : `${resumo.total} OS para hoje`
  return resumo.atrasadas ? `${os} · ${resumo.atrasadas} atrasada${resumo.atrasadas > 1 ? 's' : ''}` : os
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
    await resumoDoDia(dataParaFormatoServidor(new Date()).slice(0, 10))
      .then((resposta) => setProgresso({ total: resposta.total, concluidas: resposta.concluidas }))
      .catch(() => {})
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
          <header
            className="home-cabecalho"
            style={{ background: comAlpha(CORES.primaria, 8), borderColor: comAlpha(CORES.primaria, 20) }}
          >
            <div className="home-header-saudacao">
              <span className="home-saudacao">{saudacaoPorHorario(tecnico?.username ?? 'Técnico')}</span>
              <span className="home-resumo">{textoResumo(resumoDia)}</span>
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
            </div>

            <div className="home-avatar-wrapper">
              <button className="home-avatar" onClick={() => setConfiguracoesAberta(true)} aria-label="Configurações">
                {iniciais(tecnico?.username)}
              </button>
            </div>
          </header>

          <form className="home-busca home-combobox" onSubmit={aoBuscar}>
            <div className="home-busca-campo">
              <MdSearch size={20} className="home-busca-icone" aria-hidden="true" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onFocus={() => setListaAberta(true)}
                onBlur={() => setTimeout(() => setListaAberta(false), 150)}
                placeholder="Cliente, contrato, CPF, serial da ONU ou PPPoE"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
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

          <div className="home-menu">
            {ITENS_MENU.map((item) => (
              <Link key={item.to} to={item.to} className="home-menu-item" viewTransition>
                {/* Fundo em tom claro da cor da área e ícone na cor cheia: a
                    grade fica mais calma que 6 blocos sólidos e o ícone passa
                    no contraste nos dois temas. */}
                <span className="home-menu-icone" style={{ background: comAlpha(item.cor, 14), color: item.cor }}>
                  <item.Icone size={24} />
                </span>
                <span className="home-menu-label">{item.label}</span>
              </Link>
            ))}
            {/* Coletor de OLTs: outro app no mesmo domínio (/olt/), opcional —
                só aparece se estiver instalado. Link normal (não do router):
                sai do PWA do técnico e abre o coletor, que usa a mesma sessão. */}
            {coletorOlt && (
              <a href="/olt/" className="home-menu-item">
                <span className="home-menu-icone" style={{ background: comAlpha(CORES.olts, 14), color: CORES.olts }}>
                  <MdRouter size={24} />
                </span>
                <span className="home-menu-label">OLTs</span>
              </a>
            )}
          </div>

        </div>

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
