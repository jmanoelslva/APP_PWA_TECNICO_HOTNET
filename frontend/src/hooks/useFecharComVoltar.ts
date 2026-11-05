import { useEffect, useRef } from 'react'

/**
 * Botão/gesto "Voltar" do celular fecha a janela aberta (modal, folha,
 * câmera), como num app nativo, em vez de sair da tela por baixo dela.
 *
 * Enquanto houver janela aberta, o histórico tem uma entrada extra marcada
 * (mesma URL, preservando o estado do roteador). "Voltar" consome essa
 * entrada e fecha só a janela de cima; se ainda houver outra aberta, a
 * entrada é recolocada. Fechando pelo botão da própria janela, a entrada é
 * retirada (history.back) — com atraso de um ciclo, para o caso de outra
 * janela abrir logo em seguida (ex.: Configurações → "Sair" → confirmação).
 */
interface JanelaAberta {
  fechar: () => void
  fechadaPeloVoltar: boolean
}

const pilha: JanelaAberta[] = []
let ouvindo = false

function entradaMarcada(): boolean {
  return (window.history.state as { janelaAberta?: boolean } | null)?.janelaAberta === true
}

function marcarEntrada(): void {
  const estado = (window.history.state as Record<string, unknown> | null) ?? {}
  window.history.pushState({ ...estado, janelaAberta: true }, '')
}

function aoVoltar(): void {
  if (entradaMarcada() || pilha.length === 0) return
  const topo = pilha.pop()!
  topo.fechadaPeloVoltar = true
  topo.fechar()
  if (pilha.length > 0) marcarEntrada()
}

export function useFecharComVoltar(aberto: boolean, fechar: () => void): void {
  const fecharRef = useRef(fechar)
  useEffect(() => {
    fecharRef.current = fechar
  })

  useEffect(() => {
    if (!aberto) return
    if (!ouvindo) {
      window.addEventListener('popstate', aoVoltar)
      ouvindo = true
    }
    const janela: JanelaAberta = { fechar: () => fecharRef.current(), fechadaPeloVoltar: false }
    if (pilha.length === 0 && !entradaMarcada()) marcarEntrada()
    pilha.push(janela)
    return () => {
      const indice = pilha.indexOf(janela)
      if (indice >= 0) pilha.splice(indice, 1)
      if (janela.fechadaPeloVoltar || pilha.length > 0) return
      setTimeout(() => {
        if (pilha.length === 0 && entradaMarcada()) window.history.back()
      }, 0)
    }
  }, [aberto])
}
