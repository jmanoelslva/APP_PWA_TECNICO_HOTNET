import { linkWhatsapp, separarTelefones } from './formatacao'

/**
 * Mensagens prontas para o técnico avisar o cliente pelo WhatsApp (tela da
 * OS). Os textos ficam só aqui, para mudar sem mexer na tela.
 */
export interface MensagemCliente {
  chave: string
  rotulo: string
  /** nome = primeiro nome do cliente; tecnico = nome do técnico (ou o usuário). */
  texto: (nome: string, tecnico: string) => string
}

function saudacao(nome: string): string {
  return nome ? `Olá, ${nome}!` : 'Olá!'
}

function apresentacao(tecnico: string): string {
  return tecnico ? `Sou ${tecnico}, técnico da HOTNET,` : 'Sou o técnico da HOTNET'
}

/** Nome do técnico na mensagem: o do Controllr ou, sem ele, o usuário. */
export function identificacaoTecnico(tecnico: { username: string; nome?: string | null } | null | undefined): string {
  return (tecnico?.nome ?? '').trim() || (tecnico?.username ?? '').trim()
}

export const MENSAGENS_CLIENTE: MensagemCliente[] = [
  {
    chave: 'caminho',
    rotulo: 'A caminho',
    texto: (nome, tecnico) => `${saudacao(nome)} ${apresentacao(tecnico)} e estou a caminho do seu endereço.`,
  },
  {
    chave: 'cheguei',
    rotulo: 'Cheguei',
    texto: (nome, tecnico) => `${saudacao(nome)} ${apresentacao(tecnico)} e já estou no seu endereço.`,
  },
  {
    chave: 'concluido',
    rotulo: 'Concluído',
    texto: (nome, tecnico) =>
      `${saudacao(nome)} ${apresentacao(tecnico)} e informo que o atendimento foi concluído e sua internet está funcionando. Qualquer dúvida, fale com a HOTNET.`,
  },
]

/** "MARIA DA SILVA" → "Maria". Vazio quando não há nome. */
export function primeiroNome(nomeCompleto: string | null | undefined): string {
  const primeiro = (nomeCompleto ?? '').trim().split(/\s+/)[0] ?? ''
  if (!primeiro) return ''
  return primeiro.charAt(0).toLocaleUpperCase('pt-BR') + primeiro.slice(1).toLocaleLowerCase('pt-BR')
}

/** Link do WhatsApp do primeiro celular do texto, já com a mensagem. */
export function linkWhatsappComTexto(telefones: string | null | undefined, texto: string): string | null {
  for (const numero of separarTelefones(telefones)) {
    const link = linkWhatsapp(numero)
    if (link) return `${link}?text=${encodeURIComponent(texto)}`
  }
  return null
}
