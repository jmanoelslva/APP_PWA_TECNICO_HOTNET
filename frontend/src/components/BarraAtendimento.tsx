import { useEffect, useState, type CSSProperties } from 'react'
import type { IconType } from 'react-icons'
import { LuCable, LuReceipt, LuUser, LuWifi, LuWrench } from 'react-icons/lu'
import { useLocation, useNavigate } from 'react-router-dom'
import { listarTodasOrdensServico, type OrdemServicoDto } from '../api/client'
import { useFecharComVoltar } from '../hooks/useFecharComVoltar'
import { quandoOs } from '../utils/minhasOs'
import { useToast } from './Toast/useToast'
import {
  EVENTO_ATENDIMENTO,
  destinosAtendimento,
  lerAtendimento,
  mesmoAtendimento,
  osDoCliente,
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
  const { toast } = useToast()
  const [atendimento, setAtendimento] = useState<Atendimento | null>(() => lerAtendimento())
  const [buscandoOs, setBuscandoOs] = useState(false)
  // Cliente com mais de uma OS aberta: escolha numa janela, sem sair do atendimento.
  const [escolherOs, setEscolherOs] = useState<OrdemServicoDto[] | null>(null)
  useFecharComVoltar(escolherOs !== null, () => setEscolherOs(null))
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
  const valido = !!dados && mesmoAtendimento(atendimento, dados)
  const atual = valido ? atendimento : dados ? { ...dados, em: 0 } : null
  const destinos = destinosAtendimento(atual)
  const itens = ITENS.filter((item) => item.tela === tela || destinos[item.tela])
  if (!atual || itens.length < 2) return null

  // OS sem chamado no atendimento: procura as OS abertas do cliente em vez
  // de abrir a lista inteira.
  async function abrirOs(para: string) {
    if (atual?.ticketPk != null || atual?.clientPk == null) {
      navigate(para, { replace: true, viewTransition: true })
      return
    }
    setBuscandoOs(true)
    try {
      const escolha = osDoCliente(await listarTodasOrdensServico({ minhas: false, abertas: true }), atual.clientPk)
      if (escolha.tipo === 'uma') navigate(`/os/${escolha.ticketPk}`, { replace: true, viewTransition: true })
      else if (escolha.tipo === 'varias') setEscolherOs(escolha.ordens)
      else toast('Este cliente não tem OS em aberto.')
    } catch {
      toast('Não foi possível buscar as OS do cliente agora.')
    } finally {
      setBuscandoOs(false)
    }
  }

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
              aria-busy={destino === 'os' && buscandoOs ? true : undefined}
              disabled={destino === 'os' && buscandoOs}
              style={{ '--item-cor': cor } as CSSProperties}
              onClick={() => {
                const para = destinos[destino]
                if (ativo || !para) return
                if (destino === 'os') void abrirOs(para)
                else navigate(para, { replace: true, viewTransition: true })
              }}
            >
              <Icone size={20} aria-hidden />
              {rotulo}
            </button>
          )
        })}
      </nav>

      {escolherOs && (
        <div className="barra-atendimento-os-fundo" onClick={() => setEscolherOs(null)}>
          <div
            className="barra-atendimento-os"
            role="dialog"
            aria-label="OS em aberto do cliente"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>OS em aberto</h2>
            <ul>
              {escolherOs.map((os) => (
                <li key={os.ticket_pk}>
                  <button
                    type="button"
                    onClick={() => {
                      // Fechar a janela tira a entrada dela do histórico (history.back,
                      // ver useFecharComVoltar); a troca de tela vem depois disso, para
                      // não sobrar tela empilhada.
                      let feito = false
                      const trocar = () => {
                        if (feito) return
                        feito = true
                        window.removeEventListener('popstate', trocar)
                        navigate(`/os/${os.ticket_pk}`, { replace: true, state: { os }, viewTransition: true })
                      }
                      window.addEventListener('popstate', trocar)
                      setTimeout(trocar, 400)
                      setEscolherOs(null)
                    }}
                  >
                    <strong>{os.task_name ?? os.op_desc ?? `OS ${os.op_number ?? os.ticket_pk}`}</strong>
                    <span>{quandoOs(os.op_date_sched) ?? 'Sem data'}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="botao botao-secundario botao-largo" onClick={() => setEscolherOs(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
