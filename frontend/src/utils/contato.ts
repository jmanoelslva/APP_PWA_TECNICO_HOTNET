import { buscarDetalheCliente } from '../api/client'
import { linkLigar } from './formatacao'
import { primeiroTelefone } from './minhasOs'

/**
 * Link tel: do primeiro telefone do cliente, buscado na hora — para telas
 * cuja lista não traz o telefone (ex.: Clientes Offline). Mesma regra do
 * AcoesContato: telefones cadastrados primeiro, depois client_phones.
 * null = cliente sem telefone. Erros da API sobem para quem chamou.
 */
export async function linkLigarDoCliente(clientPk: number): Promise<string | null> {
  const detalhe = await buscarDetalheCliente(clientPk)
  return linkLigar(primeiroTelefone(detalhe.telefones, detalhe.cliente.client_phones))
}
