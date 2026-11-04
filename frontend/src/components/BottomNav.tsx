import type { CSSProperties } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
// Ícones Lucide (traço uniforme, mesmo conjunto dos atalhos do Início).
import { LuCable, LuHouse, LuWifi, LuWrench } from 'react-icons/lu'
import { CORES, comAlpha } from '../utils/cores'
import './BottomNav.css'

// Sem "Buscar" de propósito: a busca geral é o campo do topo da Home
// (cliente, serial da ONU e PPPoE) — um item aqui só a repetia.
const ITENS = [
  { to: '/', icone: LuHouse, cor: CORES.primaria, label: 'Início', fim: true },
  { to: '/suporte', icone: LuWrench, cor: CORES.suporte, label: 'OS' },
  { to: '/conexao', icone: LuWifi, cor: CORES.conexao, label: 'Conexão' },
  { to: '/onu', icone: LuCable, cor: CORES.onu, label: 'ONU' },
]
// Sem "Sair" de propósito: já fica em Configurações (avatar da tela
// inicial); aqui só repetia. A pill usa o total para calcular a largura
// (ver BottomNav.css).
const TOTAL_SLOTS = ITENS.length

/** Barra de navegação fixa no rodapé, sempre visível nas telas autenticadas. */
export default function BottomNav() {
  const location = useLocation()

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
      </nav>
    </>
  )
}
