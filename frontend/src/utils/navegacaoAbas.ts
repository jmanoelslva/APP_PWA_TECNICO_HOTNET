/**
 * Abas do rodapé no jeito de app nativo: o Início fica sempre na base do
 * histórico e, acima dele, só a aba atual (com as telas abertas a partir
 * dela). Trocar de aba não empilha: "Voltar" de qualquer aba leva ao Início
 * e, no Início, sai do app.
 *
 * `idx` é a posição da entrada no histórico (o React Router grava em
 * history.state.idx); `idxInicio` é a posição do Início, quando ele está
 * por baixo da tela atual.
 */
export type PassoAba =
  | { tipo: 'nada' }
  | { tipo: 'empilhar'; para: string }
  | { tipo: 'trocar'; para: string }
  | { tipo: 'voltar'; delta: number; depois?: string }

export function passoAba(destino: string, caminhoAtual: string, idx: number, idxInicio: number | null): PassoAba {
  const inicioPorBaixo = idxInicio !== null && idxInicio < idx
  if (destino === '/') {
    if (caminhoAtual === '/') return { tipo: 'nada' }
    return inicioPorBaixo ? { tipo: 'voltar', delta: idxInicio - idx } : { tipo: 'trocar', para: '/' }
  }
  if (caminhoAtual === destino) return { tipo: 'nada' }
  if (caminhoAtual === '/') return { tipo: 'empilhar', para: destino }
  // Outra aba (ou tela aberta dela): desce até logo acima do Início e troca.
  if (inicioPorBaixo && idxInicio + 1 < idx) return { tipo: 'voltar', delta: idxInicio + 1 - idx, depois: destino }
  return { tipo: 'trocar', para: destino }
}

/** Posição da entrada atual no histórico (gravada pelo React Router). */
export function idxHistorico(): number {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx === 'number' ? idx : 0
}
