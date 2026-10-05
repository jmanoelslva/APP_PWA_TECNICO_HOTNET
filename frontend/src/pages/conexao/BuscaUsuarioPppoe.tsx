import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { MdSearch } from 'react-icons/md'
import { buscarCpe, type CpeDto } from '../../api/client'
import { CORES } from '../../utils/cores'

/**
 * Busca por usuário PPPoE — igual ao combobox de CTO: digita um pedaço do
 * usuário e a lista vai filtrando ao vivo (busca no backend com debounce),
 * sem precisar do nome exato nem apertar buscar. Só aparece quando a tela
 * abre sem conexão escolhida.
 */
export default function BuscaUsuarioPppoe({
  onEscolher,
}: {
  // Guarda na URL (?username=... ou ?cpe_pk=...) — mesmo motivo da busca de
  // cliente: sair para outra tela e voltar não deve perder a busca.
  onEscolher: (parametros: { username: string } | { cpe_pk: string }) => void
}) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<CpeDto[]>([])
  const [buscando, setBuscando] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)

  useEffect(() => {
    // Menos de 2 caracteres não busca — evita trazer metade da base de
    // usuários a cada tecla.
    if (busca.trim().length < 2) {
      setResultados([])
      return
    }
    let cancelado = false
    setBuscando(true)
    const temporizador = setTimeout(() => {
      buscarCpe({ username: busca.trim() })
        .then((resposta) => {
          if (!cancelado) setResultados(resposta.results)
        })
        .catch(() => {
          if (!cancelado) setResultados([])
        })
        .finally(() => {
          if (!cancelado) setBuscando(false)
        })
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [busca])

  function aoBuscar(evento: FormEvent) {
    evento.preventDefault()
    const usuario = busca.trim()
    if (usuario) onEscolher({ username: usuario })
  }

  return (
    <form className="conexao-card conexao-busca conexao-combobox" onSubmit={aoBuscar}>
      <label htmlFor="conexao-usuario-input">Usuário PPPoE</label>
      <div className="conexao-busca-campo">
        <input
          id="conexao-usuario-input"
          type="text"
          placeholder="Digite o usuário"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onFocus={() => setListaAberta(true)}
          onBlur={() => setTimeout(() => setListaAberta(false), 150)}
        />
        <button
          type="submit"
          className="botao botao-secundario botao-quadrado"
          style={{ '--botao-cor': CORES.conexao } as CSSProperties}
          aria-label="Buscar"
        >
          <MdSearch size={20} />
        </button>
      </div>
      {listaAberta && busca.trim().length >= 2 && (
        <ul className="conexao-combobox-lista">
          {buscando && <li className="conexao-combobox-vazio">Buscando…</li>}
          {!buscando && resultados.length === 0 && <li className="conexao-combobox-vazio">Nenhum usuário encontrado.</li>}
          {!buscando &&
            resultados.map((resultado) => (
              <li key={resultado.pk}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setListaAberta(false)
                    if (resultado.pk) onEscolher({ cpe_pk: String(resultado.pk) })
                  }}
                >
                  <strong>{resultado.username}</strong>
                  {resultado.client_complete_name && ` — ${resultado.client_complete_name}`}
                </button>
              </li>
            ))}
        </ul>
      )}
    </form>
  )
}
