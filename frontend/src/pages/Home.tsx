import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  MdAccountCircle,
  MdBuild,
  MdDarkMode,
  MdGetApp,
  MdLightMode,
  MdLogout,
  MdPeopleAlt,
  MdRouter,
  MdWifi,
} from 'react-icons/md'
import { useSessao } from '../auth/useSessao'
import { CORES, comAlpha } from '../utils/cores'
import { usePwaInstall } from '../hooks/usePwaInstall'
import { useTema } from '../hooks/useTema'
import ModalInstalarIos from '../components/ModalInstalarIos'
import ModalConfirmarLogout from '../components/ModalConfirmarLogout'
import './Home.css'

function saudacaoPorHorario(nome: string): string {
  const hora = new Date().getHours()
  const periodo = hora >= 5 && hora < 12 ? 'Bom dia' : hora >= 12 && hora < 18 ? 'Boa tarde' : 'Boa noite'
  return `${periodo}, ${nome}!`
}

const ITENS_MENU = [
  { to: '/clientes', Icone: MdPeopleAlt, cor: CORES.cliente, label: 'Clientes' },
  { to: '/suporte', Icone: MdBuild, cor: CORES.suporte, label: 'OS / Suporte' },
  { to: '/conexao', Icone: MdWifi, cor: CORES.conexao, label: 'Conexão' },
  { to: '/onu', Icone: MdRouter, cor: CORES.onu, label: 'ONU' },
]

export default function Home() {
  const { tecnico, sair } = useSessao()
  const navigate = useNavigate()
  const { podeInstalar, aoClicarInstalar, modalIosAberto, fecharModalIos } = usePwaInstall()
  const { tema, alternarTema } = useTema()
  const [menuAvatarAberto, setMenuAvatarAberto] = useState(false)
  const [confirmarSairAberto, setConfirmarSairAberto] = useState(false)

  async function aoClicarInstalarMenu() {
    setMenuAvatarAberto(false)
    await aoClicarInstalar()
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
