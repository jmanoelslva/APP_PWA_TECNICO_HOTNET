import { ApiError, enviarAnexoTicket, SessaoExpiradaError } from '../api/client'

/**
 * Fila de anexos feitos sem internet: ficam guardados no aparelho
 * (IndexedDB) e saem sozinhos quando o sinal volta. Só anexos — etapas da
 * OS (iniciar, finalizar…) nunca entram na fila, porque dependem da ordem
 * conferida na hora com os dados do Controllr.
 */

export interface AnexoNaFila {
  id: number
  ticketPk: number
  nome: string
  tipo: string
  arquivo: Blob
  criadoEm: number
}

/** Avisa as telas abertas: um item da fila foi enviado ou descartado. */
export const EVENTO_FILA = 'hotnet-fila-anexos'
export interface DetalheEventoFila {
  id: number
  ticketPk: number
  resultado: 'enviado' | 'descartado'
}

const BANCO = 'hotnet-tecnico-fila'
const LOJA = 'anexos'

/**
 * Depois de uma falha: sem rede ou sessão expirada, o item fica para a
 * próxima tentativa; recusado pelo servidor (arquivo grande, chamado
 * fechado…), não adianta repetir.
 */
export function decidirAposFalha(erro: unknown): 'manter' | 'descartar' {
  if (erro instanceof SessaoExpiradaError) return 'manter'
  if (erro instanceof ApiError) return erro.status >= 500 ? 'manter' : 'descartar'
  return 'manter'
}

/** Erro de rede (sem sinal), não resposta do servidor. */
export function ehFalhaDeRede(erro: unknown): boolean {
  return !(erro instanceof ApiError) && !(erro instanceof SessaoExpiradaError)
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.open(BANCO, 1)
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA, { keyPath: 'id', autoIncrement: true })
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => rejeitar(pedido.error)
  })
}

async function transacao<T>(modo: IDBTransactionMode, agir: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const banco = await abrir()
  try {
    return await new Promise<T>((resolver, rejeitar) => {
      const pedido = agir(banco.transaction(LOJA, modo).objectStore(LOJA))
      pedido.onsuccess = () => resolver(pedido.result)
      pedido.onerror = () => rejeitar(pedido.error)
    })
  } finally {
    banco.close()
  }
}

/** Guarda o anexo na fila; devolve o id do item. */
export async function enfileirarAnexo(ticketPk: number, arquivo: File): Promise<number> {
  const item: Omit<AnexoNaFila, 'id'> = {
    ticketPk,
    nome: arquivo.name,
    tipo: arquivo.type,
    arquivo,
    criadoEm: Date.now(),
  }
  const id = await transacao('readwrite', (loja) => loja.add(item))
  return Number(id)
}

export function listarFila(): Promise<AnexoNaFila[]> {
  return transacao('readonly', (loja) => loja.getAll() as IDBRequest<AnexoNaFila[]>)
}

function remover(id: number): Promise<undefined> {
  return transacao('readwrite', (loja) => loja.delete(id) as IDBRequest<undefined>)
}

let processando = false

/** Tenta enviar tudo que está na fila, na ordem; para no primeiro sem rede. */
export async function processarFila(): Promise<void> {
  if (processando || typeof indexedDB === 'undefined') return
  processando = true
  try {
    const itens = await listarFila()
    for (const item of itens) {
      try {
        await enviarAnexoTicket(item.ticketPk, new File([item.arquivo], item.nome, { type: item.tipo }))
        await remover(item.id)
        avisar({ id: item.id, ticketPk: item.ticketPk, resultado: 'enviado' })
      } catch (erro) {
        if (decidirAposFalha(erro) === 'manter') break
        await remover(item.id)
        avisar({ id: item.id, ticketPk: item.ticketPk, resultado: 'descartado' })
      }
    }
  } catch {
    // IndexedDB indisponível (aba anônima etc.): sem fila
  } finally {
    processando = false
  }
}

function avisar(detalhe: DetalheEventoFila) {
  window.dispatchEvent(new CustomEvent<DetalheEventoFila>(EVENTO_FILA, { detail: detalhe }))
}

/** Chamado uma vez em main.tsx: envia o que sobrou e escuta a volta da rede. */
export function iniciarFilaAnexos(): void {
  window.addEventListener('online', () => void processarFila())
  if (navigator.onLine) void processarFila()
}
