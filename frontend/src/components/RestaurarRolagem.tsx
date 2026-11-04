import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const CHAVE = 'hotnet-tecnico-rolagem'

function lerPosicoes(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

/**
 * Volta para a mesma altura da lista ao sair de um detalhe com "voltar";
 * tela nova (link) abre do topo. A posição fica por entrada do histórico
 * (location.key) e é anotada a cada rolagem — não na saída, quando a tela
 * nova já trocou a altura da página. Como as listas chegam depois
 * (consulta ao servidor), tenta por até 2 s até a página ter altura.
 */
export default function RestaurarRolagem() {
  const location = useLocation()
  const tipo = useNavigationType()
  const posicoes = useRef<Record<string, number>>(lerPosicoes())
  const chaveAtual = useRef(location.key)

  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    let agendado = 0
    let gravar = 0
    const aoRolar = () => {
      if (agendado) return
      agendado = requestAnimationFrame(() => {
        agendado = 0
        posicoes.current[chaveAtual.current] = window.scrollY
        clearTimeout(gravar)
        gravar = window.setTimeout(() => {
          try {
            sessionStorage.setItem(CHAVE, JSON.stringify(posicoes.current))
          } catch {
            // sem armazenamento: vale só enquanto o app estiver aberto
          }
        }, 300)
      })
    }
    window.addEventListener('scroll', aoRolar, { passive: true })
    return () => {
      window.removeEventListener('scroll', aoRolar)
      cancelAnimationFrame(agendado)
      clearTimeout(gravar)
    }
  }, [])

  useLayoutEffect(() => {
    chaveAtual.current = location.key
    if (tipo !== 'POP') {
      window.scrollTo(0, 0)
      return
    }
    const alvo = posicoes.current[location.key]
    if (!alvo) return
    let quadro = 0
    const limite = performance.now() + 2000
    const tentar = () => {
      const maximo = document.documentElement.scrollHeight - window.innerHeight
      if (maximo >= alvo || performance.now() > limite) {
        window.scrollTo(0, Math.min(alvo, Math.max(0, maximo)))
        return
      }
      quadro = requestAnimationFrame(tentar)
    }
    tentar()
    // Toque do técnico interrompe a tentativa — não puxa a tela de volta.
    const parar = () => cancelAnimationFrame(quadro)
    window.addEventListener('touchstart', parar, { once: true, passive: true })
    return () => {
      cancelAnimationFrame(quadro)
      window.removeEventListener('touchstart', parar)
    }
  }, [location.key, tipo])

  return null
}
