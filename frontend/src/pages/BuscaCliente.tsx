import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MdCable, MdHistory, MdPeopleAlt, MdWifi } from 'react-icons/md'
import { ApiError, buscarClientes, type BuscaClienteResultado } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import { CORES } from '../utils/cores'
import { detectarTipoBusca, formatarDocumento } from '../utils/formatacao'
import { atalhosDaBusca, lerRecentes, limparRecentes, type ClienteRecente } from '../utils/buscaUnica'
import './BuscaCliente.css'

export default function BuscaCliente() {
  const [params, setParams] = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')
  const [carregando, setCarregando] = useState(false)
  const [jaBuscou, setJaBuscou] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultados, setResultados] = useState<BuscaClienteResultado[]>([])
  const [recentes, setRecentes] = useState<ClienteRecente[]>(lerRecentes)
  // Serial de ONU / login PPPoE reconhecidos no texto: atalho direto.
  const atalhos = atalhosDaBusca(busca)

  // Busca ao vivo, como a da Home e as de Conexão/ONU: digitou 2 letras,
  // espera 350 ms parado e já consulta, sem precisar tocar em Buscar. O
  // termo fica na URL (?busca=) para voltar de um resultado e achar a
  // mesma lista.
  useEffect(() => {
    const termo = busca.trim()
    if (termo.length < 2) {
      setResultados([])
      setJaBuscou(false)
      setCarregando(false)
      setErro(null)
      return
    }
    let cancelado = false
    setCarregando(true)
    setErro(null)
    const temporizador = setTimeout(() => {
      setParams({ busca: termo }, { replace: true })
      buscarClientes(detectarTipoBusca(termo))
        .then((resposta) => {
          if (cancelado) return
          setResultados(resposta.results)
          setJaBuscou(true)
        })
        .catch((excecao) => {
          if (!cancelado) setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível buscar o cliente.')
        })
        .finally(() => {
          if (!cancelado) setCarregando(false)
        })
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  function aoBuscar(evento: FormEvent) {
    evento.preventDefault()
    if (busca.trim().length < 2) {
      setErro('Digite um nome, contrato, CPF/CNPJ, serial da ONU ou login PPPoE.')
      return
    }
    // A busca já roda sozinha; Enter só fecha o teclado.
    ;(document.activeElement as HTMLElement | null)?.blur()
  }

  return (
    <div className="busca-cliente-tela tela-entrada">
      <CabecalhoTela
        icone={MdPeopleAlt}
        cor={CORES.cliente}
        titulo="Buscar"
        subtitulo="Cliente, serial da ONU ou login PPPoE."
      />

      <form className="busca-cliente-form" onSubmit={aoBuscar}>
        <label htmlFor="busca">Nome, contrato, CPF/CNPJ, serial ou PPPoE</label>
        <input
          id="busca"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Ex: João Silva, 12345 ou FHTT9A3C21B0"
          autoFocus={!params.get('busca')}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />

        {atalhos.length > 0 && (
          <div className="busca-cliente-atalhos">
            {atalhos.map((atalho) => (
              <Link
                key={atalho.tipo}
                to={atalho.rota}
                className="botao botao-secundario"
                style={{ '--botao-cor': atalho.tipo === 'onu-serial' ? CORES.onu : CORES.conexao } as CSSProperties}
                viewTransition
              >
                {atalho.tipo === 'onu-serial' ? <MdCable size={18} /> : <MdWifi size={18} />}
                {atalho.tipo === 'onu-serial' ? `Abrir ONU ${atalho.valor}` : `Abrir conexão ${atalho.valor}`}
              </Link>
            ))}
          </div>
        )}

        {erro && <p className="busca-cliente-erro">{erro}</p>}
      </form>

      {carregando && (
        <ul className="busca-cliente-lista">
          {[0, 1].map((i) => (
            <li key={i} className="ticket-card">
              <Skeleton width="60%" height={15} />
              <Skeleton width="40%" height={12} />
            </li>
          ))}
        </ul>
      )}

      {!carregando && !jaBuscou && recentes.length > 0 && (
        <section className="busca-cliente-recentes">
          <div className="busca-cliente-recentes-topo">
            <h2>
              <MdHistory size={16} /> Abertos por último
            </h2>
            <button
              type="button"
              className="botao botao-fantasma botao-pequeno"
              onClick={() => {
                limparRecentes()
                setRecentes([])
              }}
            >
              Limpar
            </button>
          </div>
          <ul className="busca-cliente-lista">
            {recentes.map((cliente) => (
              <li key={cliente.pk} className="ticket-card">
                <Link to={`/clientes/${cliente.pk}`} className="busca-cliente-link" viewTransition>
                  <strong>{cliente.nome}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!carregando && jaBuscou && resultados.length === 0 && (
        <EstadoVazio
          icone={MdPeopleAlt}
          titulo="Nenhum cliente encontrado"
          subtitulo={
            atalhos.length > 0
              ? 'Se for serial da ONU ou login PPPoE, use o atalho acima.'
              : 'Confira os dados e tente novamente.'
          }
        />
      )}

      {!carregando && resultados.length > 0 && (
        <ul className="busca-cliente-lista">
          {resultados.map((resultado) => (
            <li key={resultado.client_pk} className="ticket-card">
              <Link to={`/clientes/${resultado.client_pk}`} className="busca-cliente-link" viewTransition>
                <strong>{resultado.cliente.client_complete_name ?? resultado.cliente.client_name ?? `Cliente #${resultado.client_pk}`}</strong>
                {resultado.cliente.client_doc1 && <p>Documento: {formatarDocumento(resultado.cliente.client_doc1)}</p>}
                {resultado.cpes.length > 0 && (
                  <p>
                    {resultado.cpes.length} conexão(ões) — contrato(s):{' '}
                    {resultado.cpes.map((c) => c.contract_number ?? c.contract_pk).filter(Boolean).join(', ') || 'não informado'}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
