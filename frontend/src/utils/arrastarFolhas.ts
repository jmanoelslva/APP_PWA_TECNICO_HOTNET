/**
 * Janelas que sobem de baixo fecham ao arrastar para baixo, como num app
 * nativo. Um só ouvinte para o app todo: vale para qualquer fundo de janela
 * cuja classe termina em "-fundo" (folha de configurações, modais da OS, do
 * cliente, da ONU…). Soltar depois de arrastar o bastante equivale a tocar
 * fora da janela — o mesmo onClick do fundo que cada tela já tem fecha.
 */

// Distância (px) que conta como "quis fechar".
export const LIMITE_FECHAR = 90
// Fundos que não são janela de arrastar (câmera, imagem ampliada).
const IGNORADOS = ['leitor-codigo-fundo', 'chamado-imagem-modal-fundo']

/** Arrasto já soltou: fecha ou volta para o lugar. */
export function deveFechar(deslocamento: number): boolean {
  return deslocamento >= LIMITE_FECHAR
}

function fundoDaJanela(alvo: EventTarget | null): { fundo: HTMLElement; janela: HTMLElement } | null {
  if (!(alvo instanceof Element)) return null
  // Campo de texto, lista com rolagem própria etc.: arrastar é rolar/editar.
  if (alvo.closest('input, textarea, select, [data-sem-arrastar]')) return null
  let atual: Element | null = alvo
  while (atual && atual.parentElement) {
    const pai: HTMLElement = atual.parentElement
    const classe = typeof pai.className === 'string' ? pai.className : ''
    const ehFundo = classe.split(/\s+/).some((c) => c.endsWith('-fundo') && !IGNORADOS.includes(c))
    if (ehFundo && atual instanceof HTMLElement) return { fundo: pai, janela: atual }
    atual = pai
  }
  return null
}

/** Algum elemento entre o toque e a janela (inclusive ela) está rolado para baixo. */
function algumRolado(alvo: EventTarget | null, janela: HTMLElement): boolean {
  let atual = alvo instanceof Element ? alvo : null
  while (atual) {
    if (atual.scrollTop > 0) return true
    if (atual === janela) return false
    atual = atual.parentElement
  }
  return false
}

export function iniciarArrastarFolhas(): void {
  let ativo: { fundo: HTMLElement; janela: HTMLElement; inicioY: number; deslocamento: number } | null = null

  document.addEventListener(
    'touchstart',
    (evento) => {
      const achado = fundoDaJanela(evento.target)
      // Só arrasta com o conteúdo já no topo — da janela e de qualquer lista
      // com rolagem própria dentro dela (senão puxar para baixo é rolar).
      if (!achado || algumRolado(evento.target, achado.janela) || evento.touches.length !== 1) return
      ativo = { ...achado, inicioY: evento.touches[0].clientY, deslocamento: 0 }
    },
    { passive: true },
  )

  document.addEventListener(
    'touchmove',
    (evento) => {
      if (!ativo) return
      // Segundo dedo (pinça) não é arrastar a janela: volta para o lugar.
      if (evento.touches.length > 1) {
        ativo.janela.style.transform = ''
        ativo = null
        return
      }
      const deslocamento = evento.touches[0].clientY - ativo.inicioY
      if (deslocamento <= 0) {
        ativo.deslocamento = 0
        ativo.janela.style.transform = ''
        return
      }
      ativo.deslocamento = deslocamento
      ativo.janela.style.transition = 'none'
      ativo.janela.style.transform = `translateY(${deslocamento}px)`
    },
    { passive: true },
  )

  function soltar() {
    if (!ativo) return
    const { fundo, janela, deslocamento } = ativo
    ativo = null
    janela.style.transition = 'transform 0.2s ease'
    if (deveFechar(deslocamento)) {
      janela.style.transform = 'translateY(100%)'
      // Toque "fora": dispara o onClick do próprio fundo.
      setTimeout(() => fundo.dispatchEvent(new MouseEvent('click', { bubbles: true })), 150)
    } else {
      janela.style.transform = ''
    }
  }

  document.addEventListener('touchend', soltar, { passive: true })
  document.addEventListener('touchcancel', soltar, { passive: true })
}
