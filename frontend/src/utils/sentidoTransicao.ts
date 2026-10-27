/**
 * Marca a próxima troca de tela como "voltar": o CSS (index.css,
 * html[data-sentido='voltar']) faz a tela entrar pela esquerda em vez da
 * direita, como num app nativo. Limpa sozinho depois da animação.
 */
export function marcarVoltar(): void {
  document.documentElement.dataset.sentido = 'voltar'
  setTimeout(() => {
    delete document.documentElement.dataset.sentido
  }, 400)
}
