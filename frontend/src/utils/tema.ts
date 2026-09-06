export type Tema = 'light' | 'dark'

const CHAVE_TEMA = 'hotnet-tecnico-tema'

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
 * pra não piscar no tema errado.
 */
export function iniciarTema(): void {
  aplicar(temaAtual())
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!localStorage.getItem(CHAVE_TEMA)) aplicar(temaDoSistema())
  })
}
