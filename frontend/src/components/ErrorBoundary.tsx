import { Component, type ErrorInfo, type ReactNode } from 'react'
import './ErrorBoundary.css'

interface Props {
  children: ReactNode
}

interface State {
  comErro: boolean
}

/**
 * Rede de segurança contra erro de render não tratado em qualquer tela —
 * sem isso, uma exceção em qualquer componente derruba o app inteiro para
 * tela branca (só um error boundary de classe segura isso).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { comErro: false }

  static getDerivedStateFromError(): State {
    return { comErro: true }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Erro não tratado:', erro, info.componentStack)
  }

  render() {
    if (this.state.comErro) {
      return (
        <div className="error-boundary-tela">
          <div className="error-boundary-card">
            <span className="error-boundary-icone">⚠️</span>
            <h1>Ops, algo deu errado</h1>
            <p>Não foi possível carregar essa parte do app. Tente recarregar a página.</p>
            <button onClick={() => window.location.reload()}>Recarregar</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
