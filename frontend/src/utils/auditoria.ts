import type { EventoAuditoria } from '../api/client'
import { OPCOES_CRIPTOGRAFIA_WIFI } from './formatacao'

/**
 * Como cada evento da auditoria aparece na tela (pages/Auditoria.tsx):
 * o que mudou (antes → depois) separado de onde mudou (OLT, ONU, cliente).
 * Registros antigos só têm parte desses campos — cada item só aparece
 * quando o dado existe.
 */

export type Alvo = Record<string, unknown>

export interface Mudanca {
  rotulo: string
  antes?: string
  depois: string
  // Texto miúdo ao lado (ex: senha, que nunca é gravada).
  nota?: string
}

export interface Detalhe {
  rotulo: string
  valor: string
}

const tem = (v: unknown) => v != null && v !== ''
const texto = (v: unknown) => String(v)

function rotuloCriptografia(v: unknown): string {
  return OPCOES_CRIPTOGRAFIA_WIFI.find((o) => o.valor === Number(v))?.rotulo ?? String(v)
}

/** "antes → depois" só quando os dois existem e são diferentes; só o novo quando não há o antigo. */
function mudou(rotulo: string, antes: unknown, depois: unknown, formatar = texto): Mudanca | null {
  if (!tem(depois)) return null
  if (tem(antes) && formatar(antes) === formatar(depois)) return null
  return { rotulo, antes: tem(antes) ? formatar(antes) : undefined, depois: formatar(depois) }
}

function senha(rotulo: string, alterada: unknown): Mudanca | null {
  if (typeof alterada !== 'boolean') return null
  return { rotulo, depois: alterada ? 'alterada' : 'mantida', nota: alterada ? 'o valor não é gravado' : undefined }
}

// Na associação de ONU o cliente e o PPPoE SÃO a mudança (antes → depois);
// nas outras ações são só o "onde" (detalhes).
const ASSOCIACAO = 'onu.associar_cliente'

export function mudancas(alvo: Alvo, acao?: string): Mudanca[] {
  const associacao = acao === ASSOCIACAO
  return [
    associacao ? mudou('Cliente', alvo.cliente_anterior, alvo.cliente) : null,
    associacao ? mudou('PPPoE', alvo.pppoe_anterior, alvo.pppoe) : null,
    mudou('Nome', alvo.nome_anterior, alvo.onu_name),
    mudou('Criptografia', alvo.wifi_tipo_anterior, alvo.wifi_tipo, rotuloCriptografia),
    senha('Senha do Wi-Fi', alvo.senha_wifi_alterada),
    mudou('Login', alvo.login_anterior, alvo.cpe_access_login),
    mudou('Porta', alvo.porta_anterior, alvo.cpe_access_port),
    senha('Senha de acesso', alvo.senha_acesso_alterada),
  ].filter((m): m is Mudanca => m !== null)
}

export function detalhes(alvo: Alvo, acao?: string): Detalhe[] {
  const associacao = acao === ASSOCIACAO
  const itens: Detalhe[] = []
  // OLT sempre que for ação em ONU: pelo nome; sem ele, o número interno.
  if (tem(alvo.onu_pk) || tem(alvo.onu_id) || tem(alvo.olt_pk)) {
    itens.push({ rotulo: 'OLT', valor: tem(alvo.olt_nome) ? texto(alvo.olt_nome) : tem(alvo.olt_pk) ? texto(alvo.olt_pk) : '—' })
  }
  if (tem(alvo.onu_id)) {
    itens.push({ rotulo: 'ONU', valor: tem(alvo.porta) ? `PON ${alvo.porta} · nº ${alvo.onu_id}` : `nº ${alvo.onu_id}` })
  } else if (tem(alvo.onu_pk)) {
    itens.push({ rotulo: 'ONU', valor: texto(alvo.onu_pk) })
  }
  if (tem(alvo.serial)) itens.push({ rotulo: 'Serial', valor: texto(alvo.serial) })
  if (associacao) return itens
  if (tem(alvo.cliente)) itens.push({ rotulo: 'Cliente', valor: texto(alvo.cliente) })
  if (tem(alvo.pppoe)) itens.push({ rotulo: 'PPPoE', valor: texto(alvo.pppoe) })
  // Registros antigos de Wi-Fi/roteador só têm o número interno da conexão.
  if (tem(alvo.cpe_pk) && !tem(alvo.cliente) && !tem(alvo.pppoe)) itens.push({ rotulo: 'Conexão', valor: texto(alvo.cpe_pk) })
  return itens
}

// ------------------------------------------------------------- dias

export interface DiaAuditoria {
  dia: string // AAAA-MM-DD
  titulo: string
  eventos: EventoAuditoria[]
}

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

function diaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function tituloDia(dia: string, agora = new Date()): string {
  const [a, m, d] = dia.split('-').map(Number)
  if (!a || !m || !d) return dia
  const semana = DIAS_SEMANA[new Date(a, m - 1, d).getDay()]
  const ontem = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1)
  const curto = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
  if (dia === diaLocal(agora)) return `Hoje · ${semana}, ${curto}`
  if (dia === diaLocal(ontem)) return `Ontem · ${semana}, ${curto}`
  return `${semana[0].toUpperCase()}${semana.slice(1)}, ${curto}/${a}`
}

/** Eventos já vêm do mais novo para o mais antigo; agrupa mantendo a ordem. */
export function agruparPorDia(eventos: EventoAuditoria[], agora = new Date()): DiaAuditoria[] {
  const grupos: DiaAuditoria[] = []
  for (const ev of eventos) {
    const dia = ev.quando.slice(0, 10)
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.dia === dia) ultimo.eventos.push(ev)
    else grupos.push({ dia, titulo: tituloDia(dia, agora), eventos: [ev] })
  }
  return grupos
}

export function hora(quando: string): string {
  return quando.slice(11, 16)
}
