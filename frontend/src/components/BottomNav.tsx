import { useState, type CSSProperties } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MdBuild, MdHome, MdLogout, MdPeopleAlt, MdWifi } from 'react-icons/md'
import { useSessao } from '../auth/useSessao'
import { CORES, comAlpha } from '../utils/cores'
import ModalConfirmarLogout from './ModalConfirmarLogout'
import './BottomNav.css'

const ITENS = [
  { to: '/', icone: MdHome, cor: CORES.primaria, label: 'Início', fim: true },
  { to: '/clientes', icone: MdPeopleAlt, cor: CORES.cliente, label: 'Clientes' },
  { to: '/suporte', icone: MdBuild, cor: CORES.suporte, label: 'OS' },
  { to: '/conexao', icone: MdWifi, cor: CORES.conexao, label: 'Conexão' },
]

/** Barra de navegação fixa no rodapé, sempre visível nas telas autenticadas. */
export default function BottomNav() {
  const { sair } = useSessao()
  const location = useLocation()
  const [confirmarSairAberto, setConfirmarSairAberto] = useState(false)

  const indiceAtivo = ITENS.findIndex((item) =>
    item.fim ? location.pathname === item.to : location.pathname.startsWith(item.to),
  )

  return (
    <>
      <nav className="bottom-nav">
        {indiceAtivo >= 0 && (
          <span
            className="bottom-nav-indicador"
            style={
              {
                '--indice': indiceAtivo,
                '--cor-pill': comAlpha(ITENS[indiceAtivo].cor, 14),
              } as CSSProperties
            }
          />
        )}
        {ITENS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.fim}
            viewTransition
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'ativo' : ''}`}
            style={({ isActive }) => ({ color: isActive ? item.cor : undefined })}
          >
            <item.icone size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button type="button" className="bottom-nav-item" onClick={() => setConfirmarSairAberto(true)}>
          <MdLogout size={22} />
          <span>Sair</span>
        </button>
      </nav>

      <ModalConfirmarLogout
        aberto={confirmarSairAberto}
        onCancelar={() => setConfirmarSairAberto(false)}
        onConfirmar={() => {
          setConfirmarSairAberto(false)
          sair()
        }}
      />
    </>
  )
}
