import type { CpeDto } from '../api/client'

/** Contrato que ainda prende a porta: ativado, alertado, pendente ou bloqueado. */
const CONTRATO_OCUPA_PORTA = new Set([1, 2, 3, 4])

/**
 * Quem prende a porta é o CPE habilitado (cpe_status 1), não o contrato: o
 * Controllr recusa com "duplicate" a porta de outro CPE habilitado, inclusive
 * de contrato cancelado (visto nos dados em 06/11: cancelados seguem com CPE
 * habilitado; a única porta repetida é de um desativado com CPE desabilitado).
 * Sem cpe_status, cai na regra do contrato.
 */
export const ocupaPorta = (cpe: CpeDto): boolean =>
  cpe.status != null ? cpe.status === 1 : CONTRATO_OCUPA_PORTA.has(cpe.contract_status ?? 1)

export interface PortaOcupada {
  porta: number
  cpePk: number
  usuario: string
  cliente?: string
  online: boolean
  /** contract_status do Controllr (0 desativado … 5 cancelado). */
  contrato?: number
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
  /**
   * Portas gravadas em conexões com CPE desabilitado (contrato desativado).
   * Não ocupam: a porta conta como livre, só com o registro do antigo ocupante.
   */
  liberadas: PortaOcupada[]
}

const numeroDaPorta = (cpe: CpeDto): number | null => {
  const porta = Number(cpe.dp_port)
  if (cpe.dp_port == null || String(cpe.dp_port) === '' || !Number.isInteger(porta) || porta <= 0) return null
  return porta
}

const paraOcupada = (cpe: CpeDto, porta: number): PortaOcupada => ({
  porta,
  cpePk: cpe.pk as number,
  usuario: cpe.username ?? `Conexão #${cpe.pk}`,
  cliente: cpe.client_complete_name,
  online: (cpe.sessions ?? 0) > 0,
  contrato: cpe.contract_status,
})

/**
 * Portas ocupadas e livres de uma CTO, a partir das conexões gravadas nela.
 * CPE desabilitado não ocupa a porta; CPE habilitado ocupa, mesmo com
 * contrato cancelado.
 */
export function portasDaCto(cpes: CpeDto[], limite: number | null | undefined): PortasDaCto {
  const comPk = cpes.filter((cpe) => cpe.pk != null)
  const ocupadas: PortaOcupada[] = []
  const liberadas: PortaOcupada[] = []
  let semPorta = 0
  for (const cpe of comPk) {
    const porta = numeroDaPorta(cpe)
    if (!ocupaPorta(cpe)) {
      if (porta != null) liberadas.push(paraOcupada(cpe, porta))
      continue
    }
    if (porta == null) {
      semPorta += 1
      continue
    }
    ocupadas.push(paraOcupada(cpe, porta))
  }
  ocupadas.sort((a, b) => a.porta - b.porta || a.usuario.localeCompare(b.usuario))
  const contagem = new Map<number, number>()
  for (const item of ocupadas) contagem.set(item.porta, (contagem.get(item.porta) ?? 0) + 1)
  const repetidas = [...contagem].filter(([, n]) => n > 1).map(([porta]) => porta)
  const livres: number[] = []
  if (limite && limite > 0) {
    for (let porta = 1; porta <= limite; porta += 1) if (!contagem.has(porta)) livres.push(porta)
  }
  liberadas.sort((a, b) => a.porta - b.porta)
  return { ocupadas, livres, semPorta, repetidas, liberadas }
}

export type SituacaoPorta = 'livre' | 'ocupada' | 'propria' | 'repetida'

export interface CasaPorta {
  porta: number
  situacao: SituacaoPorta
  /** Conexões ativas na porta (mais de uma = conflito). */
  ocupantes: PortaOcupada[]
  /** Antigo ocupante com contrato cancelado/desativado (porta livre). */
  anterior?: PortaOcupada
}

/**
 * Grade fixa de portas: 1 até o limite da CTO (ou até a maior porta gravada,
 * se passar do limite), cada uma com a sua situação. Sem limite, só as
 * portas gravadas. O tamanho não muda conforme a CTO enche.
 */
export function gradeDePortas(portas: PortasDaCto, limite: number | null | undefined, cpePkAtual: number | undefined): CasaPorta[] {
  const maior = Math.max(0, ...portas.ocupadas.map((o) => o.porta))
  const numeros =
    limite && limite > 0
      ? Array.from({ length: Math.max(limite, maior) }, (_, i) => i + 1)
      : [...new Set(portas.ocupadas.map((o) => o.porta))].sort((a, b) => a - b)
  return numeros.map((porta) => {
    const ocupantes = portas.ocupadas.filter((o) => o.porta === porta)
    const situacao: SituacaoPorta =
      ocupantes.length > 1
        ? 'repetida'
        : ocupantes.length === 0
          ? 'livre'
          : ocupantes[0].cpePk === cpePkAtual
            ? 'propria'
            : 'ocupada'
    // Antigo ocupante ainda com sessão (equipamento não retirado) vem primeiro.
    const antigos = ocupantes.length === 0 ? portas.liberadas.filter((l) => l.porta === porta) : []
    const anterior = antigos.find((l) => l.online) ?? antigos[0]
    return { porta, situacao, ocupantes, anterior }
  })
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
