// "Por que está sem internet?" — cruza contrato, conexão, sessão PPPoE,
// ONU (estado e sinal) e quedas, e devolve um veredito com o próximo
// passo. Regra pura (sem chamada), testada em diagnostico.test.ts.

import { nivelSinalOnu } from './formatacao'
import type { ResumoQuedas } from './quedas'

export type GravidadeDiagnostico = 'ok' | 'atencao' | 'problema' | 'verificando'

export interface Diagnostico {
  gravidade: GravidadeDiagnostico
  titulo: string
  passo: string
  // Atalho sugerido para o próximo passo.
  atalho?: 'financeiro' | 'onu' | 'cto' | 'roteador' | 'historico'
}

export interface EntradaDiagnostico {
  contratoStatus?: number | null
  cpeStatus?: number | null
  // true = sessão PPPoE agora; false = consultou e não há; null = consultando/falhou.
  sessaoOnline: boolean | null
  // undefined = ainda carregando; null = sem ONU vinculada.
  onu?: { state?: string | null; rx?: number | null; ultimaQuedaMotivo?: string | null } | null
  quedas?: ResumoQuedas | null
}

// onu_state no Controllr (lido ao vivo em 28/11): Online, Up, Offline,
// Down. Os demais termos cobrem variações de fabricante.
const ONU_SEM_LINK = /\b(los|offline|off-line|dying|dyinggasp|power ?off|down|inativ|desconect)/i

export function onuSemLink(state: string | null | undefined): boolean {
  return !!state && ONU_SEM_LINK.test(state)
}

export function diagnosticar(e: EntradaDiagnostico): Diagnostico {
  const contrato = e.contratoStatus == null ? null : Number(e.contratoStatus)
  if (contrato === 4) {
    return {
      gravidade: 'problema',
      titulo: 'Contrato bloqueado',
      passo: 'O cliente cai na página de aviso. Confira o financeiro antes de mexer no equipamento.',
      atalho: 'financeiro',
    }
  }
  if (contrato === 0 || contrato === 5) {
    return {
      gravidade: 'problema',
      titulo: contrato === 5 ? 'Contrato cancelado' : 'Contrato desativado',
      passo: 'Sem contrato ativo a conexão não autentica. Confirme a situação com o escritório.',
    }
  }
  if (e.cpeStatus === 0) {
    return {
      gravidade: 'problema',
      titulo: 'Conexão desabilitada no sistema',
      passo: 'O PPPoE está desabilitado no Controllr. Peça ao escritório para habilitar.',
    }
  }
  if (e.sessaoOnline == null) {
    return { gravidade: 'verificando', titulo: 'Verificando a conexão…', passo: 'Consultando a sessão PPPoE e a ONU.' }
  }

  const sinal = nivelSinalOnu(e.onu?.rx ?? null)
  const caindo = e.quedas && e.quedas.nivel !== 'normal' ? e.quedas : null

  if (e.sessaoOnline) {
    if (sinal === 'critica') {
      return {
        gravidade: 'atencao',
        titulo: 'Online, mas com sinal crítico',
        passo: 'Pode cair a qualquer momento. Limpe ou refaça os conectores e confira o drop até a CTO.',
        atalho: 'onu',
      }
    }
    if (caindo) {
      const link = caindo.perdaDeLink > 0 ? `, ${caindo.perdaDeLink} por perda de link` : ''
      return {
        gravidade: 'atencao',
        titulo: `Online, mas caiu ${caindo.total} vezes em 7 dias${link}`,
        passo:
          caindo.perdaDeLink > 0
            ? 'Queda por perda de link aponta para energia (fonte, tomada) ou fibra (conector, drop).'
            : 'Confira o sinal, a fonte da ONU e o roteador; veja os horários na aba Histórico.',
        atalho: 'historico',
      }
    }
    if (sinal === 'alerta') {
      return {
        gravidade: 'atencao',
        titulo: 'Online, com sinal fraco',
        passo: 'Funciona, mas está no limite. Vale limpar os conectores enquanto está no local.',
        atalho: 'onu',
      }
    }
    return {
      gravidade: 'ok',
      titulo: 'Conexão funcionando',
      passo: 'PPPoE conectado e sinal bom. Se o cliente reclama, confira o Wi-Fi (sinal no cômodo, canal, aparelhos).',
      atalho: 'roteador',
    }
  }

  // Sem sessão PPPoE agora.
  if (e.onu === undefined) {
    return { gravidade: 'verificando', titulo: 'Sem sessão PPPoE', passo: 'Consultando a ONU…' }
  }
  if (e.onu === null) {
    return {
      gravidade: 'problema',
      titulo: 'Sem sessão PPPoE e sem ONU vinculada',
      passo: 'Nenhuma ONU está ligada a este PPPoE. Registre o cliente na ONU instalada.',
      atalho: 'onu',
    }
  }
  if (onuSemLink(e.onu.state)) {
    // "Dying gasp": a ONU avisou a OLT que perdeu a energia.
    if (/dying/i.test(e.onu.ultimaQuedaMotivo ?? '')) {
      return {
        gravidade: 'problema',
        titulo: 'ONU desligada (sem energia)',
        passo: 'A ONU avisou a falta de energia antes de cair. Confira a tomada, a fonte e se alguém a desligou.',
      }
    }
    const motivo = e.onu.ultimaQuedaMotivo ? ` (última queda: ${e.onu.ultimaQuedaMotivo})` : ''
    return {
      gravidade: 'problema',
      titulo: `ONU sem link${motivo}`,
      passo: 'Confira se a ONU está ligada na tomada e depois a fibra: conector, drop e porta na CTO.',
      atalho: 'cto',
    }
  }
  if (sinal === 'critica') {
    return {
      gravidade: 'problema',
      titulo: 'Sem sessão PPPoE, sinal crítico',
      passo: 'O sinal não sustenta a conexão. Limpe ou refaça os conectores e confira o drop até a CTO.',
      atalho: 'onu',
    }
  }
  return {
    gravidade: 'problema',
    titulo: 'ONU com sinal, mas sem PPPoE',
    passo: 'Confira se o roteador está ligado, o cabo da ONU ao roteador e o usuário e a senha PPPoE no roteador.',
    atalho: 'roteador',
  }
}
