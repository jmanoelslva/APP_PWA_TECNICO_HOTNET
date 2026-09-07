import { useState, type CSSProperties } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { MdBuild, MdHome, MdLogout, MdWifi } from 'react-icons/md'
import { useSessao } from '../auth/useSessao'
import { CORES, comAlpha } from '../utils/cores'
import ModalConfirmarLogout from './ModalConfirmarLogout'
import './BottomNav.css'

// "Clientes" saiu daqui de propósito — a busca combobox da Home já leva
// direto pra tela do cliente, então essa aba virou um caminho redundante
// (ver Home.tsx).
const ITENS = [
  { to: '/', icone: MdHome, cor: CORES.primaria, label: 'Início', fim: true },
  { to: '/suporte', icone: MdBuild, cor: CORES.suporte, label: 'OS' },
  { to: '/conexao', icone: MdWifi, cor: CORES.conexao, label: 'Conexão' },
]
// +1 pelo botão "Sair", que ocupa o mesmo espaço dos itens acima mas não
// tem indicador/rota própria — a pill precisa saber o total pra calcular
// a largura certa (ver BottomNav.css).
const TOTAL_SLOTS = ITENS.length + 1

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
                '--total-slots': TOTAL_SLOTS,
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
