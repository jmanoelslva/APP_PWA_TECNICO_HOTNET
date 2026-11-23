/**
 * "Entrar com biometria" no PWA: usa o gerenciador de senhas do próprio
 * celular (Credential Management API). O Android pede a digital/rosto antes
 * de entregar a senha salva; o app nunca guarda a senha — só uma marca de
 * que existe credencial salva para aquele usuário, para mostrar o botão.
 * Navegadores sem PasswordCredential (iPhone/Safari) não mostram o botão:
 * lá o Face ID já aparece no teclado, pelo preenchimento automático.
 */

interface CredencialSenha {
  type: string
  id: string
  password?: string
}

type ConstrutorCredencial = new (dados: { id: string; password: string; name?: string }) => CredencialSenha

const CHAVE_MARCA = 'hotnet-tecnico-credencial-salva'

function construtor(): ConstrutorCredencial | null {
  const w = window as unknown as { PasswordCredential?: ConstrutorCredencial }
  return typeof w.PasswordCredential === 'function' && navigator.credentials ? w.PasswordCredential : null
}

export function suportaBiometria(): boolean {
  return construtor() !== null
}

/** Há credencial salva (por um login anterior neste aparelho) para o usuário. */
export function temCredencialSalva(usuario: string): boolean {
  if (!suportaBiometria() || !usuario.trim()) return false
  try {
    return localStorage.getItem(CHAVE_MARCA) === usuario.trim().toLowerCase()
  } catch {
    return false
  }
}

/** Depois de um login certo: oferece ao gerenciador de senhas guardar o par. */
export async function guardarCredencial(usuario: string, senha: string): Promise<void> {
  const Credencial = construtor()
  if (!Credencial) return
  try {
    await navigator.credentials.store(new Credencial({ id: usuario, password: senha, name: usuario }) as unknown as Credential)
    localStorage.setItem(CHAVE_MARCA, usuario.trim().toLowerCase())
  } catch {
    // recusado pelo técnico ou sem armazenamento: só não oferece a biometria
  }
}

export function esquecerCredencial(): void {
  try {
    localStorage.removeItem(CHAVE_MARCA)
  } catch {
    // sem armazenamento
  }
}

/**
 * Pede a credencial salva ao celular (com a digital/rosto). null se o
 * técnico cancelar ou não houver senha salva.
 */
export async function obterCredencial(): Promise<{ usuario: string; senha: string } | null> {
  if (!suportaBiometria()) return null
  try {
    const credencial = (await navigator.credentials.get({
      password: true,
      mediation: 'required',
    } as CredentialRequestOptions)) as CredencialSenha | null
    if (credencial && credencial.type === 'password' && credencial.password) {
      return { usuario: credencial.id, senha: credencial.password }
    }
  } catch {
    // cancelado
  }
  return null
}
