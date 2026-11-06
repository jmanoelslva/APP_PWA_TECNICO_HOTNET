import type { CpeDto } from '../api/client'

/** Contrato que ainda prende a porta: ativado, alertado, pendente ou bloqueado. */
const CONTRATO_OCUPA_PORTA = new Set([1, 2, 3, 4])

export interface PortaOcupada {
  porta: number
  cpePk: number
  usuario: string
  cliente?: string
  online: boolean
}

export interface PortasDaCto {
  /** Por porta, em ordem; uma porta pode ter mais de uma conexão (conflito). */
  ocupadas: PortaOcupada[]
  /** Portas de 1 até o limite da CTO sem conexão. Vazio sem limite. */
  livres: number[]
  /** Conexões na CTO sem porta gravada. */
  semPorta: number
  /** Portas com mais de uma conexão. */
  repetidas: number[]
}

/**
 * Portas ocupadas e livres de uma CTO, a partir das conexões gravadas nela.
 * Contrato cancelado ou desativado não ocupa a porta.
 */
export function portasDaCto(cpes: CpeDto[], limite: number | null | undefined): PortasDaCto {
  const validas = cpes.filter((cpe) => cpe.pk != null && CONTRATO_OCUPA_PORTA.has(cpe.contract_status ?? 1))
  const ocupadas: PortaOcupada[] = []
  let semPorta = 0
  for (const cpe of validas) {
    const porta = Number(cpe.dp_port)
    if (cpe.dp_port == null || String(cpe.dp_port) === '' || !Number.isInteger(porta) || porta <= 0) {
      semPorta += 1
      continue
    }
    ocupadas.push({
      porta,
      cpePk: cpe.pk as number,
      usuario: cpe.username ?? `Conexão #${cpe.pk}`,
      cliente: cpe.client_complete_name,
      online: (cpe.sessions ?? 0) > 0,
    })
  }
  ocupadas.sort((a, b) => a.porta - b.porta || a.usuario.localeCompare(b.usuario))
  const contagem = new Map<number, number>()
  for (const item of ocupadas) contagem.set(item.porta, (contagem.get(item.porta) ?? 0) + 1)
  const repetidas = [...contagem].filter(([, n]) => n > 1).map(([porta]) => porta)
  const livres: number[] = []
  if (limite && limite > 0) {
    for (let porta = 1; porta <= limite; porta += 1) if (!contagem.has(porta)) livres.push(porta)
  }
  return { ocupadas, livres, semPorta, repetidas }
}

/** Outra conexão já gravada na porta digitada (ignora a própria conexão). */
export function ocupanteDaPorta(
  ocupadas: PortaOcupada[],
  porta: string,
  cpePkAtual: number | undefined,
): PortaOcupada | undefined {
  const numero = Number(porta.trim())
  if (!porta.trim() || !Number.isInteger(numero)) return undefined
  return ocupadas.find((item) => item.porta === numero && item.cpePk !== cpePkAtual)
}
