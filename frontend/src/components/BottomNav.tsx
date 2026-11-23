import { useEffect, type CSSProperties, type MouseEvent } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
// Ícones Lucide (traço uniforme, mesmo conjunto dos atalhos do Início).
import { LuCable, LuHouse, LuWifi, LuWrench } from 'react-icons/lu'
import { CORES, comAlpha } from '../utils/cores'
import { idxHistorico, passoAba } from '../utils/navegacaoAbas'
import './BottomNav.css'

// Sem "Buscar" de propósito: a busca geral é o campo do topo da Home
// (cliente, serial da ONU e PPPoE) — um item aqui só a repetia.
const ITENS = [
  { to: '/', icone: LuHouse, label: 'Início', fim: true },
  { to: '/suporte', icone: LuWrench, label: 'OS' },
  { to: '/conexao', icone: LuWifi, label: 'Conexão' },
  { to: '/onu', icone: LuCable, label: 'ONU' },
]
// Sem "Sair" de propósito: já fica em Configurações (avatar da tela
// inicial); aqui só repetia. A pill usa o total para calcular a largura
// (ver BottomNav.css).
const TOTAL_SLOTS = ITENS.length

/**
 * Item marcado na barra. Telas fora das quatro abas marcam a aba de origem:
 * detalhe da OS fica em "OS"; cliente, mapa, offline, ferramentas e as
 * demais (abertas pelo Início ou pela busca dele) ficam em "Início".
 */
export function itemMarcado(caminho: string): number {
  const direto = ITENS.findIndex((item) => (item.fim ? caminho === item.to : caminho.startsWith(item.to)))
  if (direto >= 0) return direto
  if (caminho.startsWith('/os/')) return ITENS.findIndex((item) => item.to === '/suporte')
  if (caminho === '/login') return -1
  return 0
}

// Posição do Início no histórico (quando está por baixo da tela atual) e
// aba a abrir depois de descer até ele. Fora do componente: a barra some
// em algumas telas e volta a montar.
let idxInicio: number | null = null
let abaPendente: string | null = null

/** Barra de navegação fixa no rodapé, sempre visível nas telas autenticadas. */
export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const idx = idxHistorico()
    if (location.pathname === '/') idxInicio = idx
    else if (idxInicio !== null && idx <= idxInicio) idxInicio = null
    if (abaPendente) {
      const para = abaPendente
      abaPendente = null
      if (location.pathname !== para) navigate(para, { replace: true })
    }
  }, [location.key, location.pathname, navigate])

  // Abas no jeito de app nativo (ver utils/navegacaoAbas.ts).
  function irPara(evento: MouseEvent, destino: string) {
    evento.preventDefault()
    const passo = passoAba(destino, location.pathname, idxHistorico(), idxInicio)
    if (passo.tipo === 'empilhar') navigate(passo.para, { viewTransition: true })
    else if (passo.tipo === 'trocar') navigate(passo.para, { replace: true, viewTransition: true })
    else if (passo.tipo === 'voltar') {
      abaPendente = passo.depois ?? null
      navigate(passo.delta)
    }
  }

  const indiceAtivo = itemMarcado(location.pathname)

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
                '--cor-pill': comAlpha(CORES.primaria, 14),
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
            onClick={(evento) => irPara(evento, item.to)}
            className={`bottom-nav-item ${ITENS[indiceAtivo] === item ? 'ativo' : ''}`}
            style={{ color: ITENS[indiceAtivo] === item ? CORES.primaria : undefined }}
          >
            <item.icone size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
