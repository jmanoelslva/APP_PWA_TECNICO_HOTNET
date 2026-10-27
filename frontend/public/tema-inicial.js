// Roda antes do CSS e do app (index.html): aplica o tema salvo e pinta o
// fundo dele, para não abrir com clarão branco no tema escuro. Arquivo
// separado porque a CSP do servidor (script-src 'self') bloqueia script
// embutido no HTML. Mesma chave de src/utils/tema.ts.
try {
  var tema = localStorage.getItem('hotnet-tecnico-tema')
  if (tema !== 'light' && tema !== 'dark') {
    tema = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.setAttribute('data-theme', tema)
  document.documentElement.style.background = tema === 'dark' ? '#121316' : '#f5f5f5'
} catch (e) {
  // sem armazenamento: o app aplica o tema ao carregar (tema.ts)
}
