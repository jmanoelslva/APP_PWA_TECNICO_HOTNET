import { useEffect, useState, type CSSProperties } from 'react'
import type { IconType } from 'react-icons'
import { LuCable, LuReceipt, LuUser, LuWifi, LuWrench } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  EVENTO_ATENDIMENTO,
  destinosAtendimento,
  lerAtendimento,
  registrarAtendimento,
  type Atendimento,
  type DadosAtendimento,
  type TelaAtendimento,
} from '../utils/atendimento'
import { CORES } from '../utils/cores'
import './BarraAtendimento.css'

const ITENS: { tela: TelaAtendimento; rotulo: string; Icone: IconType; cor: string }[] = [
  { tela: 'cliente', rotulo: 'Cliente', Icone: LuUser, cor: CORES.cliente },
  { tela: 'conexao', rotulo: 'Conexão', Icone: LuWifi, cor: CORES.conexao },
  { tela: 'onu', rotulo: 'ONU', Icone: LuCable, cor: CORES.onu },
  { tela: 'os', rotulo: 'OS', Icone: LuWrench, cor: CORES.suporte },
  { tela: 'financeiro', rotulo: 'Financeiro', Icone: LuReceipt, cor: CORES.financeiro },
]

/**
 * Barra do atendimento, fixa no topo de Cliente, Conexão, ONU, OS e
 * Financeiro: as cinco telas do cliente atendido. Sem o nome do cliente:
 * cada tela já mostra quem é (o usuário achou a linha repetida). Trocar por ela não
 * empilha (replace), então um Voltar devolve à tela de onde o técnico veio
 * (lista de OS, busca, Início). `dados`: o que esta tela sabe do cliente;
 * null enquanto carrega.
 */
export default function BarraAtendimento({ tela, dados }: { tela: TelaAtendimento; dados: DadosAtendimento | null }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [atendimento, setAtendimento] = useState<Atendimento | null>(() => lerAtendimento())
  const chave = dados ? JSON.stringify(dados) : ''

  useEffect(() => {
    if (!dados) return
    registrarAtendimento(dados, tela, location.pathname + location.search)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, tela, location.pathname, location.search])

  useEffect(() => {
    const atualizar = () => setAtendimento(lerAtendimento())
    window.addEventListener(EVENTO_ATENDIMENTO, atualizar)
    return () => window.removeEventListener(EVENTO_ATENDIMENTO, atualizar)
  }, [])

  // Até registrar, vale o que a tela sabe (não mostra o cliente anterior).
  const valido =
    dados &&
    atendimento &&
    ((dados.clientPk != null && atendimento.clientPk === dados.clientPk) ||
      (dados.cpePk != null && atendimento.cpePk === dados.cpePk))
  const atual = valido ? atendimento : dados ? { ...dados, em: 0 } : null
  const destinos = destinosAtendimento(atual)
  const itens = ITENS.filter((item) => item.tela === tela || destinos[item.tela])
  if (!atual || itens.length < 2) return null

  return (
    <div className="barra-atendimento">
      <nav className="barra-atendimento-itens" aria-label="Telas do atendimento">
        {itens.map(({ tela: destino, rotulo, Icone, cor }) => {
          const ativo = destino === tela
          return (
            <button
              key={destino}
              type="button"
              className="barra-atendimento-item"
              data-ativo={ativo}
              aria-current={ativo ? 'page' : undefined}
              style={{ '--item-cor': cor } as CSSProperties}
              onClick={() => {
                const para = destinos[destino]
                if (!ativo && para) navigate(para, { replace: true, viewTransition: true })
              }}
            >
              <Icone size={20} aria-hidden />
              {rotulo}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
