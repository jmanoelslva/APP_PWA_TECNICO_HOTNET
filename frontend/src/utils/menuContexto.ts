/**
 * Segurar o dedo num botão ou link abria o menu do navegador ("Abrir em nova
 * guia", "Copiar link", "Baixar imagem"). Como num app nativo, o menu só
 * continua nos campos de entrada de dados (colar, selecionar tudo).
 */

const CAMPOS = 'input, textarea, [contenteditable]:not([contenteditable="false"])'

/** O menu de contexto vale aqui? Só dentro de campos de entrada. */
export function permiteMenuContexto(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && alvo.closest(CAMPOS) !== null
}

export function iniciarSemMenuContexto(): void {
  document.addEventListener('contextmenu', (evento) => {
    if (!permiteMenuContexto(evento.target)) evento.preventDefault()
  })
}
