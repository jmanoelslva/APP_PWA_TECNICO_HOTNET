// Roda antes do CSS e do app (index.html): aplica o tema salvo e pinta o
// fundo dele, para não abrir com clarão branco no tema escuro. Arquivo
// separado porque a CSP do servidor (script-src 'self') bloqueia script
// embutido no HTML. Mesma chave de src/utils/tema.ts.
try {
  var tema = localStorage.getItem('hotnet-tecnico-tema')
  if (tema !== 'light' && tema !== 'dark') {
    tema = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  var sol = localStorage.getItem('hotnet-tecnico-sol') === '1'
  document.documentElement.setAttribute('data-theme', tema)
  if (sol) document.documentElement.setAttribute('data-sol', '1')
  if (localStorage.getItem('hotnet-tecnico-texto') === 'grande') {
    document.documentElement.setAttribute('data-texto', 'grande')
  }
  document.documentElement.style.background = sol ? '#ffffff' : tema === 'dark' ? '#121316' : '#f5f5f5'
} catch (e) {
  // sem armazenamento: o app aplica o tema ao carregar (tema.ts)
}
