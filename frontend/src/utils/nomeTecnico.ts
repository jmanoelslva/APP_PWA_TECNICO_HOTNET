import { primeiroNome } from './mensagensCliente'

/**
 * Como o técnico aparece no app e nas mensagens ao cliente: primeiro nome do
 * cadastro do Controllr ("Edson Santos" → "Edson"); sem nome, o usuário com a
 * inicial maiúscula ("edsonsantos" → "Edsonsantos").
 */
export function nomeExibicao(tecnico: { username: string; nome?: string | null } | null | undefined): string {
  return primeiroNome(tecnico?.nome) || primeiroNome(tecnico?.username)
}

// O login acontece antes de o app saber o nome: fica guardado no aparelho
// (só o nome de exibição, junto do usuário a que pertence).
const CHAVE_NOME = 'hotnet-tecnico-nome-lembrado'

export function lembrarNome(username: string, nome: string | null | undefined): void {
  try {
    if (nome?.trim()) localStorage.setItem(CHAVE_NOME, JSON.stringify({ usuario: username, nome: nome.trim() }))
  } catch {
    // sem armazenamento: o login mostra o usuário
  }
}

/** Nome de exibição para o usuário lembrado na tela de login. */
export function nomeLembrado(username: string): string {
  let nome: string | null = null
  try {
    const dado = JSON.parse(localStorage.getItem(CHAVE_NOME) ?? 'null') as { usuario?: string; nome?: string } | null
    if (dado?.usuario?.toLowerCase() === username.trim().toLowerCase()) nome = dado.nome ?? null
  } catch {
    // ilegível: segue com o usuário
  }
  return nomeExibicao({ username, nome })
}
