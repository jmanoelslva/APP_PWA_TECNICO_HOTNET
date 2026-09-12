import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MdAccountCircle,
  MdBuild,
  MdConstruction,
  MdDarkMode,
  MdGetApp,
  MdLightMode,
  MdLogout,
  MdRouter,
  MdWifi,
  MdWifiOff,
} from 'react-icons/md'
import { useSessao } from '../auth/useSessao'
import { CORES, comAlpha } from '../utils/cores'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useTema } from '../hooks/useTema'
import ModalInstalarIos from '../components/ModalInstalarIos'
import ModalConfirmarLogout from '../components/ModalConfirmarLogout'
import { buscarClientes, type BuscaClienteResultado } from '../api/client'
import { detectarTipoBusca } from '../utils/formatacao'
import { buscarIpsPublicos } from '../utils/ipPublico'
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
  { to: '/onu', Icone: MdRouter, cor: CORES.onu, label: 'ONU' },
  { to: '/offline', Icone: MdWifiOff, cor: CORES.offline, label: 'Clientes Offline' },
  { to: '/ferramentas', Icone: MdConstruction, cor: CORES.ferramentas, label: 'Ferramentas' },
]

export default function Home() {
  const { tecnico, sair } = useSessao()
  const navigate = useNavigate()
  const { podeInstalar, aoClicarInstalar, modalIosAberto, fecharModalIos } = usePwaInstall()
  const { tema, alternarTema } = useTema()
  const [menuAvatarAberto, setMenuAvatarAberto] = useState(false)
  const [confirmarSairAberto, setConfirmarSairAberto] = useState(false)

  // Mesmo combobox de busca ao vivo já usado em Conexão (usuário PPPoE) e
  // ONU/CTO: digita um pedaço do nome/contrato/documento e a lista vai
  // filtrando no backend com debounce, sem precisar apertar buscar nem
  // sair da Home para ver o resultado — clicar num item já leva direto
  // para o cliente. Sem botão de buscar (lupa): o combobox já cobre a busca
  // sozinho; Enter no campo ainda leva para tela de busca completa, útil
  // quando há muitos resultados para rolar.
  const [busca, setBusca] = useState('')
  const [resultadosBusca, setResultadosBusca] = useState<BuscaClienteResultado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)

  // Rodapé com IPv4/IPv6 da rede atual — consulta automática ao entrar
  // na Home, sem precisar de clique (ver Ferramentas.tsx para a versão
  // com localização/provedor sob demanda).
  const [ipv4, setIpv4] = useState<string | null>(null)
  const [ipv6, setIpv6] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    buscarIpsPublicos().then((resultado) => {
      if (cancelado) return
      setIpv4(resultado.ipv4)
      setIpv6(resultado.ipv6)
    })
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    if (busca.trim().length < 2) {
      setResultadosBusca([])
      return
    }
    let cancelado = false
    setBuscando(true)
    const temporizador = setTimeout(() => {
      buscarClientes(detectarTipoBusca(busca))
        .then((resposta) => {
          if (!cancelado) setResultadosBusca(resposta.results)
        })
        .catch(() => {
          if (!cancelado) setResultadosBusca([])
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

  async function aoClicarInstalarMenu() {
    setMenuAvatarAberto(false)
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
    <div className="home-tela tela-entrada">
      <div className="home-conteudo">
        <header
          className="home-cabecalho"
          style={{ background: comAlpha(CORES.primaria, 8), borderColor: comAlpha(CORES.primaria, 20) }}
        >
          <span className="home-header-icone">
            <MdBuild size={22} color={CORES.branco} />
          </span>

          <div className="home-header-saudacao">
            <span className="home-saudacao">{saudacaoPorHorario(tecnico?.username ?? 'Técnico')}</span>
            <p className="home-subtitulo">O que você precisa hoje?</p>
          </div>

          <div className="home-avatar-wrapper">
            <button className="home-avatar" onClick={() => setMenuAvatarAberto((v) => !v)} aria-label="Menu do usuário">
              <MdAccountCircle size={26} />
            </button>
            {menuAvatarAberto && (
              <>
                <div className="home-avatar-menu-fundo" onClick={() => setMenuAvatarAberto(false)} />
                <div className="home-avatar-menu">
                  {podeInstalar && (
                    <button onClick={aoClicarInstalarMenu}>
                      <MdGetApp size={18} /> Instalar app
                    </button>
                  )}
                  <button onClick={alternarTema}>
                    {tema === 'dark' ? <MdLightMode size={18} /> : <MdDarkMode size={18} />}
                    {tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
                  </button>
                  <button
                    className="home-avatar-menu-sair"
                    onClick={() => {
                      setMenuAvatarAberto(false)
                      setConfirmarSairAberto(true)
                    }}
                  >
                    <MdLogout size={18} /> Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <form className="home-busca home-combobox" onSubmit={aoBuscar}>
          <div className="home-busca-campo">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onFocus={() => setListaAberta(true)}
              onBlur={() => setTimeout(() => setListaAberta(false), 150)}
              placeholder="Buscar cliente por nome, contrato ou CPF/CNPJ"
            />
          </div>
          {listaAberta && busca.trim().length >= 2 && (
            <ul className="home-combobox-lista">
              {buscando && <li className="home-combobox-vazio">Buscando…</li>}
              {!buscando && resultadosBusca.length === 0 && (
                <li className="home-combobox-vazio">Nenhum cliente encontrado.</li>
              )}
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
                      {resultado.cliente.client_doc1 && ` — ${resultado.cliente.client_doc1}`}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </form>

        <div className="home-menu">
          {ITENS_MENU.map((item) => (
            <Link key={item.to} to={item.to} className="home-menu-item" viewTransition>
              <span className="home-menu-icone" style={{ background: item.cor }}>
                <item.Icone size={26} color={CORES.branco} />
              </span>
              <span className="home-menu-label">{item.label}</span>
            </Link>
          ))}
        </div>

        {(ipv4 || ipv6) && (
          <footer className="home-rodape-ip">
            {ipv4 && (
              <span className="home-rodape-ip-item">
                <strong>IPv4</strong> {ipv4}
              </span>
            )}
            {ipv6 && (
              <span className="home-rodape-ip-item">
                <strong>IPv6</strong> {ipv6}
              </span>
            )}
          </footer>
        )}
      </div>

      <ModalInstalarIos aberto={modalIosAberto} onFechar={fecharModalIos} />
      <ModalConfirmarLogout
        aberto={confirmarSairAberto}
        onCancelar={() => setConfirmarSairAberto(false)}
        onConfirmar={() => {
          setConfirmarSairAberto(false)
          sair()
          navigate('/login', { viewTransition: true })
        }}
      />
    </div>
  )
}
