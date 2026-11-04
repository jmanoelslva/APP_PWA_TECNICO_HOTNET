/**
 * Versão nova do app sem precisar fechar e abrir.
 *
 * O service worker novo assume na hora (skipWaiting + clientsClaim, ver
 * vite.config.ts), mas a tela aberta continua com o JavaScript antigo — e
 * as telas carregadas sob demanda (lazy) pedem arquivos da versão anterior,
 * que o servidor já apagou (respondem com o index.html, e a tela quebra ou
 * fica velha). Então:
 * - quando a versão nova assume, recarrega na próxima troca de tela ou
 *   quando o app volta ao primeiro plano (nunca no meio do que está aberto);
 * - se um arquivo de tela falhar ao carregar, recarrega na hora.
 */

let versaoNova = false
let recarregando = false

function recarregar(): void {
  if (recarregando) return
  recarregando = true
  window.location.reload()
}

/** Chamado a cada troca de tela (App.tsx): aplica a versão nova, se houver. */
export function aplicarVersaoNovaSePreciso(): void {
  if (versaoNova) recarregar()
}

export function iniciarAtualizacaoApp(): void {
  // Arquivo de tela (import dinâmico) que não existe mais: versão velha.
  window.addEventListener('vite:preloadError', (evento) => {
    evento.preventDefault()
    recarregar()
  })

  if (!('serviceWorker' in navigator)) return
  // Sem controlador = primeira instalação: o SW assumir não é versão nova.
  const jaTinhaVersao = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (jaTinhaVersao) versaoNova = true
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') aplicarVersaoNovaSePreciso()
  })
}
