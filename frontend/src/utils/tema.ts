export type Tema = 'light' | 'dark'

const CHAVE_TEMA = 'hotnet-tecnico-tema'
// Modo sol (alto contraste, ver index.css :root[data-sol]) — independente
// do tema claro/escuro; ligado, vale por cima dos dois.
const CHAVE_SOL = 'hotnet-tecnico-sol'

/** Modo sol ligado neste celular. */
export function solLigado(): boolean {
  try {
    return localStorage.getItem(CHAVE_SOL) === '1'
  } catch {
    return false
  }
}

function temaDoSistema(): Tema {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Tema efetivo agora: a escolha manual salva, ou o do sistema se o técnico nunca escolheu. */
export function temaAtual(): Tema {
  const salvo = localStorage.getItem(CHAVE_TEMA)
  return salvo === 'light' || salvo === 'dark' ? salvo : temaDoSistema()
}

function aplicar(tema: Tema): void {
  document.documentElement.setAttribute('data-theme', tema)
  // Fundo provisório de public/tema-inicial.js: a partir daqui vale o CSS.
  document.documentElement.style.background = ''
  // Barra de status do celular acompanha a escolha manual (o index.html
  // tem uma meta por tema do sistema; aqui as duas passam a seguir o app).
  const sol = solLigado()
  if (sol) document.documentElement.setAttribute('data-sol', '1')
  else document.documentElement.removeAttribute('data-sol')
  const corBarra = sol ? '#1d5487' : tema === 'dark' ? '#121316' : '#2a72b8'
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute('content', corBarra))
}

/** Liga/desliga o modo sol — fica salvo neste celular. */
export function definirSol(ligado: boolean): void {
  try {
    if (ligado) localStorage.setItem(CHAVE_SOL, '1')
    else localStorage.removeItem(CHAVE_SOL)
  } catch {
    // sem armazenamento: vale só até fechar o app
    if (ligado) document.documentElement.setAttribute('data-sol', '1')
    else document.documentElement.removeAttribute('data-sol')
    return
  }
  aplicar(temaAtual())
}

/** Escolha manual do técnico — fica salva e passa a ignorar o sistema. */
export function definirTema(tema: Tema): void {
  localStorage.setItem(CHAVE_TEMA, tema)
  aplicar(tema)
}

/**
 * Aplica o tema assim que o app carrega e mantém sincronizado com o
 * sistema operacional enquanto o técnico não tiver escolhido nada
 * manualmente — chamado uma vez em main.tsx, antes do primeiro render,
 * para não piscar no tema errado.
 */
export function iniciarTema(): void {
  aplicar(temaAtual())
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!localStorage.getItem(CHAVE_TEMA)) aplicar(temaDoSistema())
  })
}
