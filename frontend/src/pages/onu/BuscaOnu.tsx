import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { MdQrCodeScanner } from 'react-icons/md'
import { buscarCpe, buscarOnu, type CpeDto, type OnuDto } from '../../api/client'
import LeitorCodigoBarras from '../../components/LeitorCodigoBarras'
import { CORES } from '../../utils/cores'

type ResultadoCombo = { tipo: 'serial'; item: OnuDto } | { tipo: 'usuario'; item: CpeDto }

/**
 * Combobox único — busca por serial (/fiber_ctl/onu/list no formato
 * "wizard", que filtra por prefixo) e por usuário PPPoE (/cpe/busca, que
 * suporta ILIKE parcial) em paralelo, e mistura os dois num só dropdown —
 * o técnico não precisa saber de antemão se tem o serial ou o usuário em
 * mãos. Também lê o serial pela câmera (código de barras/QR da etiqueta,
 * ver LeitorCodigoBarras.tsx).
 */
export default function BuscaOnu({
  onEscolher,
}: {
  onEscolher: (parametros: { serial: string } | { username: string }) => void
}) {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ResultadoCombo[]>([])
  const [buscando, setBuscando] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)
  const [lendoCodigo, setLendoCodigo] = useState(false)

  useEffect(() => {
    const valor = busca.trim()
    if (valor.length < 2) {
      setResultados([])
      return
    }
    let cancelado = false
    setBuscando(true)
    const temporizador = setTimeout(() => {
      Promise.all([
        buscarOnu({ serial: valor }).catch(() => ({ results: [] as OnuDto[] })),
        buscarCpe({ username: valor }).catch(() => ({ results: [] as CpeDto[] })),
      ])
        .then(([respostaOnu, respostaCpe]) => {
          if (cancelado) return
          setResultados([
            ...respostaOnu.results.map((item): ResultadoCombo => ({ tipo: 'serial', item })),
            ...respostaCpe.results.map((item): ResultadoCombo => ({ tipo: 'usuario', item })),
          ])
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

  // Selecionar um item de serial já é a própria ONU; um item de usuário
  // busca a ONU pelo usuário exato dele.
  function selecionar(resultado: ResultadoCombo) {
    setListaAberta(false)
    setBusca('')
    if (resultado.tipo === 'serial' && resultado.item.sn) onEscolher({ serial: resultado.item.sn })
    else if (resultado.tipo === 'usuario' && resultado.item.username) onEscolher({ username: resultado.item.username })
  }

  function aoSubmeter(evento: FormEvent) {
    evento.preventDefault()
    if (resultados.length === 1) selecionar(resultados[0])
  }

  function aoLerCodigo(valor: string) {
    setLendoCodigo(false)
    setListaAberta(false)
    setBusca('')
    onEscolher({ serial: valor.trim().toUpperCase() })
  }

  return (
    <>
      <form className="onu-card onu-busca onu-combobox" onSubmit={aoSubmeter}>
        <label htmlFor="onu-busca-input">Serial da ONU ou usuário PPPoE</label>
        <div className="onu-busca-campo">
          <input
            id="onu-busca-input"
            type="text"
            placeholder="Digite o serial ou o usuário"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setListaAberta(true)
            }}
            onFocus={() => setListaAberta(true)}
            onBlur={() => setTimeout(() => setListaAberta(false), 150)}
          />
          <button
            type="button"
            className="botao botao-secundario botao-quadrado"
            style={{ '--botao-cor': CORES.onu } as CSSProperties}
            onClick={() => setLendoCodigo(true)}
            aria-label="Ler código de barras ou QR pela câmera"
            title="Ler código de barras ou QR pela câmera"
          >
            <MdQrCodeScanner size={20} />
          </button>
        </div>
        {listaAberta && busca.trim().length >= 2 && (
          <ul className="onu-combobox-lista">
            {buscando && <li className="onu-combobox-vazio">Buscando…</li>}
            {!buscando && resultados.length === 0 && <li className="onu-combobox-vazio">Nada encontrado.</li>}
            {!buscando &&
              resultados.map((resultado) => (
                <li key={`${resultado.tipo}-${resultado.item.pk}`}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selecionar(resultado)}>
                    {resultado.tipo === 'serial' ? (
                      <>
                        <strong>{resultado.item.sn}</strong>
                        {resultado.item.client_name && ` — ${resultado.item.client_name}`}
                      </>
                    ) : (
                      <>
                        <strong>{resultado.item.username}</strong>
                        {resultado.item.client_complete_name && ` — ${resultado.item.client_complete_name}`}
                      </>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </form>
      {lendoCodigo && <LeitorCodigoBarras onDetectado={aoLerCodigo} onFechar={() => setLendoCodigo(false)} />}
    </>
  )
}
