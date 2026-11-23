import { linkWhatsapp, separarTelefones } from './formatacao'

/**
 * Mensagens prontas para o técnico avisar o cliente pelo WhatsApp (tela da
 * OS). Os textos ficam só aqui, para mudar sem mexer na tela.
 */
export interface MensagemCliente {
  chave: string
  rotulo: string
  dica: string
  texto: (nome: string) => string
}

function saudacao(nome: string): string {
  return nome ? `Olá, ${nome}!` : 'Olá!'
}

export const MENSAGENS_CLIENTE: MensagemCliente[] = [
  {
    chave: 'caminho',
    rotulo: 'Estou a caminho',
    dica: 'ao sair para o endereço',
    texto: (nome) => `${saudacao(nome)} Sou o técnico da HOTNET e estou a caminho do seu endereço.`,
  },
  {
    chave: 'cheguei',
    rotulo: 'Cheguei',
    dica: 'quando ninguém atende',
    texto: (nome) => `${saudacao(nome)} Sou o técnico da HOTNET e já estou no seu endereço.`,
  },
  {
    chave: 'concluido',
    rotulo: 'Atendimento concluído',
    dica: 'ao terminar o serviço',
    texto: (nome) =>
      `${saudacao(nome)} O atendimento foi concluído e sua internet está funcionando. Qualquer dúvida, fale com a HOTNET.`,
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
