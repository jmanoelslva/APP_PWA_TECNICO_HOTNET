import type { CpeDto, EnderecoDto, OnuDto } from '../api/client'
import { nivelSinalOnu } from './formatacao'
import { nivelSinalOlt } from '../pages/onu/formato'

export type SituacaoFechamento = 'ok' | 'atencao' | 'pendente' | 'verificando'

export interface ItemFechamento {
  chave: 'onu' | 'sinal' | 'pppoe' | 'cto' | 'endereco'
  rotulo: string
  situacao: SituacaoFechamento
  detalhe: string
}

export interface DadosFechamento {
  cpe: CpeDto | null
  onu: OnuDto | null
  carregandoOnu: boolean
  /** true/false pela sessão online; null enquanto consulta. */
  online: boolean | null
  clientPk?: number
  endereco: EnderecoDto | null
}

function coordenadaValida(valor: string | undefined): boolean {
  const numero = Number(valor)
  return !!valor && Number.isFinite(numero) && numero !== 0
}

function formatarRx(rx: number | undefined): string {
  return rx != null ? `${rx.toLocaleString('pt-BR')} dBm` : 'sem leitura'
}

/**
 * O que precisa estar certo para fechar a OS sem voltar ao cliente: ONU
 * registrada para ele, sinal na faixa, PPPoE conectado, CTO e porta
 * gravadas e coordenada do endereço.
 */
export function verificarFechamento(d: DadosFechamento): ItemFechamento[] {
  const itens: ItemFechamento[] = []

  if (d.carregandoOnu) {
    itens.push({ chave: 'onu', rotulo: 'ONU registrada', situacao: 'verificando', detalhe: 'Consultando…' })
    itens.push({ chave: 'sinal', rotulo: 'Sinal na faixa', situacao: 'verificando', detalhe: 'Consultando…' })
  } else if (!d.onu) {
    itens.push({ chave: 'onu', rotulo: 'ONU registrada', situacao: 'pendente', detalhe: 'Nenhuma ONU com este PPPoE' })
    itens.push({ chave: 'sinal', rotulo: 'Sinal na faixa', situacao: 'pendente', detalhe: 'Sem ONU para ler o sinal' })
  } else {
    const doCliente = d.clientPk != null && d.onu.client_pk === d.clientPk
    itens.push({
      chave: 'onu',
      rotulo: 'ONU registrada',
      situacao: doCliente ? 'ok' : 'pendente',
      detalhe: doCliente
        ? (d.onu.sn ?? 'Registrada para este cliente')
        : d.onu.client_pk
          ? `Registrada para ${d.onu.client_name ?? 'outro cliente'}`
          : 'ONU sem cliente registrado',
    })
    const niveis = [nivelSinalOnu(d.onu.omddm_rx_power), nivelSinalOlt(d.onu.olt_omddm_rx_power)]
    const situacao: SituacaoFechamento =
      niveis.includes('critica') || niveis.includes('desconhecida')
        ? 'pendente'
        : niveis.includes('alerta')
          ? 'atencao'
          : 'ok'
    itens.push({
      chave: 'sinal',
      rotulo: 'Sinal na faixa',
      situacao,
      detalhe: `ONU ${formatarRx(d.onu.omddm_rx_power)} · OLT ${formatarRx(d.onu.olt_omddm_rx_power)}`,
    })
  }

  itens.push({
    chave: 'pppoe',
    rotulo: 'PPPoE conectado',
    situacao: !d.cpe ? 'pendente' : d.online === null ? 'verificando' : d.online ? 'ok' : 'pendente',
    detalhe: !d.cpe
      ? 'Sem conexão cadastrada'
      : d.online === null
        ? 'Consultando…'
        : d.online
          ? (d.cpe.username ?? 'Conectado')
          : `${d.cpe.username ?? 'Conexão'} sem sessão`,
  })

  const temCto = d.cpe?.dp_pk != null
  const temPorta = d.cpe?.dp_port != null && String(d.cpe.dp_port) !== ''
  itens.push({
    chave: 'cto',
    rotulo: 'CTO e porta',
    situacao: temCto && temPorta ? 'ok' : 'pendente',
    detalhe: !temCto
      ? 'CTO não gravada'
      : !temPorta
        ? `${d.cpe?.dp_name ?? 'CTO'} sem porta`
        : `${d.cpe?.dp_name ?? 'CTO'} · porta ${d.cpe?.dp_port}`,
  })

  const temCoordenada =
    coordenadaValida(d.endereco?.address_latitude) && coordenadaValida(d.endereco?.address_longitude)
  itens.push({
    chave: 'endereco',
    rotulo: 'Localização do endereço',
    situacao: temCoordenada ? 'ok' : 'pendente',
    detalhe: temCoordenada ? 'Coordenada gravada' : 'Sem coordenada no endereço',
  })

  return itens
}
