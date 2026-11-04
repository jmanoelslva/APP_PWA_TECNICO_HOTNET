/**
 * Busca única (botão Buscar da barra de navegação): o mesmo campo aceita
 * nome/contrato/CPF (busca de cliente) e reconhece serial de ONU, MAC e
 * login PPPoE para oferecer o atalho direto para a tela certa.
 */

export type AtalhoBusca =
  | { tipo: 'onu-serial'; valor: string; rota: string }
  | { tipo: 'pppoe'; valor: string; rota: string }

// Serial GPON: 4 letras do fabricante + 8 hexadecimais (ex.: FHTT9A3C21B0, ZTEGC1234567).
const SERIAL_ONU = /^[A-Za-z]{4}[0-9A-Fa-f]{8}$/
// Login PPPoE: sem espaço, com letra e com ponto, @, _ ou - (ex.: maria.santos, joao@hotnet).
const LOGIN_PPPOE = /^(?=.*[A-Za-z])[A-Za-z0-9._@-]+$/

export function atalhosDaBusca(texto: string): AtalhoBusca[] {
  const termo = texto.trim()
  if (termo.length < 3 || /\s/.test(termo)) return []
  const atalhos: AtalhoBusca[] = []
  if (SERIAL_ONU.test(termo)) {
    const serial = termo.toUpperCase()
    atalhos.push({ tipo: 'onu-serial', valor: serial, rota: `/onu?serial=${encodeURIComponent(serial)}` })
  }
  if (LOGIN_PPPOE.test(termo) && /[._@-]/.test(termo)) {
    atalhos.push({ tipo: 'pppoe', valor: termo, rota: `/conexao?username=${encodeURIComponent(termo)}` })
  }
  return atalhos
}

// Clientes abertos por último, só neste celular.
const CHAVE_RECENTES = 'hotnet-tecnico-clientes-recentes'
const MAX_RECENTES = 6

export interface ClienteRecente {
  pk: number
  nome: string
}

export function lerRecentes(): ClienteRecente[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? '[]') as unknown
    if (!Array.isArray(lista)) return []
    return lista.filter(
      (item): item is ClienteRecente => typeof item?.pk === 'number' && typeof item?.nome === 'string',
    )
  } catch {
    return []
  }
}

export function registrarRecente(cliente: ClienteRecente): void {
  try {
    const lista = [cliente, ...lerRecentes().filter((item) => item.pk !== cliente.pk)].slice(0, MAX_RECENTES)
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify(lista))
  } catch {
    // sem armazenamento: só não lembra os recentes
  }
}

export function limparRecentes(): void {
  try {
    localStorage.removeItem(CHAVE_RECENTES)
  } catch {
    // sem armazenamento
  }
}
