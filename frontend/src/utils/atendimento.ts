// Atendimento em andamento: o cliente (e a conexão e a OS dele) que o
// técnico está vendo. Alimenta a barra do atendimento (troca entre
// Cliente, Conexão, ONU, OS e Financeiro sem empilhar telas) e o
// "Continuar atendimento" do Início. Fica no localStorage por até 12 h e
// é apagado ao sair da conta.

export interface Atendimento {
  clientPk?: number
  cliente?: string
  cpePk?: number
  pppoe?: string
  ticketPk?: number
  // Última tela do atendimento (caminho + busca), para o "Continuar".
  caminho?: string
  tela?: TelaAtendimento
  em: number
}

export type TelaAtendimento = 'cliente' | 'conexao' | 'onu' | 'os' | 'financeiro'

export const NOME_TELA: Record<TelaAtendimento, string> = {
  cliente: 'Cliente',
  conexao: 'Conexão',
  onu: 'ONU',
  os: 'OS',
  financeiro: 'Financeiro',
}

const CHAVE = 'hotnet-tecnico-atendimento'
export const EVENTO_ATENDIMENTO = 'hotnet-atendimento-mudou'
const VALIDADE_MS = 12 * 60 * 60 * 1000

export function lerAtendimento(agora = Date.now()): Atendimento | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (!bruto) return null
    const a = JSON.parse(bruto) as Atendimento
    if (!a || typeof a.em !== 'number' || agora - a.em > VALIDADE_MS) return null
    return a
  } catch {
    return null
  }
}

function gravar(a: Atendimento | null): void {
  try {
    if (a) localStorage.setItem(CHAVE, JSON.stringify(a))
    else localStorage.removeItem(CHAVE)
  } catch {
    // sem armazenamento: a barra só usa o que a tela atual sabe
  }
  window.dispatchEvent(new Event(EVENTO_ATENDIMENTO))
}

export type DadosAtendimento = Omit<Atendimento, 'em' | 'caminho' | 'tela'>

/**
 * Junta o que a tela sabe ao atendimento guardado. Mesmo cliente (ou mesma
 * conexão): completa. Outro cliente: começa um atendimento novo, para a
 * barra nunca misturar a conexão de um com o cliente de outro.
 */
export function juntarAtendimento(atual: Atendimento | null, novo: DadosAtendimento, agora = Date.now()): Atendimento {
  const mesmoCliente = atual && novo.clientPk != null && atual.clientPk === novo.clientPk
  const mesmaConexao = atual && novo.cpePk != null && atual.cpePk === novo.cpePk
  const semCliente = novo.clientPk == null && novo.cpePk == null
  const base = atual && (mesmoCliente || mesmaConexao || semCliente) ? atual : null
  const limpo = Object.fromEntries(Object.entries(novo).filter(([, v]) => v != null && v !== '')) as DadosAtendimento
  return { ...(base ?? {}), ...limpo, em: agora }
}

export function registrarAtendimento(novo: DadosAtendimento, tela: TelaAtendimento, caminho: string): void {
  gravar({ ...juntarAtendimento(lerAtendimento(), novo), tela, caminho })
}

export function limparAtendimento(): void {
  gravar(null)
}

/** Caminho de cada tela do atendimento; ausente quando falta o dado. */
export function destinosAtendimento(a: Atendimento | null): Partial<Record<TelaAtendimento, string>> {
  if (!a) return {}
  const d: Partial<Record<TelaAtendimento, string>> = {}
  if (a.clientPk != null) d.cliente = `/clientes/${a.clientPk}`
  if (a.cpePk != null) d.conexao = `/conexao?cpe_pk=${a.cpePk}`
  if (a.pppoe) d.onu = `/onu?username=${encodeURIComponent(a.pppoe)}`
  if (a.ticketPk != null) d.os = `/os/${a.ticketPk}`
  else if (a.cliente) d.os = `/suporte?busca=${encodeURIComponent(a.cliente)}`
  if (a.clientPk != null) d.financeiro = `/financeiro?client_pk=${a.clientPk}`
  return d
}
