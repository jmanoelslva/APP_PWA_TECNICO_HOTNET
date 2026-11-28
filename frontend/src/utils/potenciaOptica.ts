// Calculadora de potência óptica (Ferramentas): sinal esperado na ONU a
// partir da potência da porta PON e das perdas do caminho, comparado com
// as faixas do app (nivelSinalOnu) e com o sinal lido.

import { nivelSinalOnu, type NivelSinal } from './formatacao'

/** Perda típica de splitter PLC balanceado (dB, valor máximo de catálogo). */
export const PERDA_SPLITTER: Record<string, number> = {
  '1:2': 3.7,
  '1:4': 7.3,
  '1:8': 10.5,
  '1:16': 13.7,
  '1:32': 17.1,
  '1:64': 20.5,
}

// Valores de referência de projeto (ajustáveis na tela só pelo que muda
// em campo: potência, splitters, distância, conectores e emendas).
export const PERDA_KM_1490 = 0.3 // dB/km, sentido OLT → ONU
export const PERDA_CONECTOR = 0.5 // dB por conector
export const PERDA_EMENDA = 0.1 // dB por fusão

export interface EntradaPotencia {
  potenciaOlt: number // dBm na porta PON
  splitters: string[] // chaves de PERDA_SPLITTER, na ordem do caminho
  distanciaKm: number
  conectores: number
  emendas: number
  lido?: number | null // sinal lido na ONU (dBm), para comparar
}

export interface ResultadoPotencia {
  perdas: { rotulo: string; db: number }[]
  perdaTotal: number
  esperado: number
  nivel: NivelSinal
  // lido − esperado: negativo = chegando menos que o projeto.
  diferenca: number | null
  aviso: string | null
}

const arred = (n: number) => Math.round(n * 100) / 100

export function calcularPotencia(e: EntradaPotencia): ResultadoPotencia {
  const perdas: { rotulo: string; db: number }[] = []
  e.splitters.forEach((s, i) => {
    const db = PERDA_SPLITTER[s]
    if (db != null) perdas.push({ rotulo: `Splitter ${i + 1} (${s})`, db })
  })
  if (e.distanciaKm > 0) perdas.push({ rotulo: `Fibra (${e.distanciaKm} km)`, db: arred(e.distanciaKm * PERDA_KM_1490) })
  if (e.conectores > 0) perdas.push({ rotulo: `Conectores (${e.conectores})`, db: arred(e.conectores * PERDA_CONECTOR) })
  if (e.emendas > 0) perdas.push({ rotulo: `Emendas (${e.emendas})`, db: arred(e.emendas * PERDA_EMENDA) })
  const perdaTotal = arred(perdas.reduce((soma, p) => soma + p.db, 0))
  const esperado = arred(e.potenciaOlt - perdaTotal)
  const diferenca = e.lido == null || Number.isNaN(e.lido) ? null : arred(e.lido - esperado)

  let aviso: string | null = null
  if (diferenca != null && diferenca <= -3) {
    aviso = `Chegando ${Math.abs(diferenca).toLocaleString('pt-BR')} dB abaixo do esperado: procure conector sujo, emenda ruim ou curva acentuada no drop.`
  } else if (diferenca != null && diferenca >= 3) {
    aviso = 'Sinal acima do esperado: confira se o caminho informado (splitters, distância) é o real.'
  } else if (diferenca != null) {
    aviso = 'Sinal lido dentro do esperado para este caminho.'
  }
  return { perdas, perdaTotal, esperado, nivel: nivelSinalOnu(esperado), diferenca, aviso }
}
