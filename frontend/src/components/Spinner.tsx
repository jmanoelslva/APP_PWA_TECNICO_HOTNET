import './Spinner.css'

/** Spinner simples para carregamentos de tela inteira (ex: checagem de sessão). */
export default function Spinner({ tela = false }: { tela?: boolean }) {
  if (tela) {
    return (
      <div className="spinner-tela">
        <span className="spinner" />
      </div>
    )
  }
  return <span className="spinner" />
}
