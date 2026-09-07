import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MdPeopleAlt, MdSearch } from 'react-icons/md'
import { ApiError, buscarClientes, type BuscaClienteResultado } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import { CORES } from '../utils/cores'
import './BuscaCliente.css'

export default function BuscaCliente() {
  const [params, setParams] = useSearchParams()
  const [doc, setDoc] = useState(params.get('doc') ?? '')
  const [contrato, setContrato] = useState(params.get('contrato') ?? '')
  const [nome, setNome] = useState(params.get('nome') ?? '')
  const [carregando, setCarregando] = useState(false)
  const [jaBuscou, setJaBuscou] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultados, setResultados] = useState<BuscaClienteResultado[]>([])

  async function buscar(filtros: { doc: string; contrato: string; nome: string }) {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await buscarClientes({
        doc: filtros.doc.trim() || undefined,
        contrato: filtros.contrato.trim() ? Number(filtros.contrato.trim()) : undefined,
        nome: filtros.nome.trim() || undefined,
      })
      setResultados(resposta.results)
      setJaBuscou(true)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível buscar o cliente.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    // Refaz a busca sozinho quando a tela é montada com filtros já na
    // URL — sem isso, sair pra ver Conexão/ONU/detalhe de um resultado e
    // voltar perdia a busca inteira, obrigando o técnico a buscar nome/
    // CPF de novo do zero.
    if (params.get('doc') || params.get('contrato') || params.get('nome')) {
      buscar({ doc: params.get('doc') ?? '', contrato: params.get('contrato') ?? '', nome: params.get('nome') ?? '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function aoBuscar(evento: FormEvent) {
    evento.preventDefault()
    if (!doc.trim() && !contrato.trim() && !nome.trim()) {
      setErro('Preencha ao menos um campo: documento, contrato ou nome.')
      return
    }
    const novosParams: Record<string, string> = {}
    if (doc.trim()) novosParams.doc = doc.trim()
    if (contrato.trim()) novosParams.contrato = contrato.trim()
    if (nome.trim()) novosParams.nome = nome.trim()
    setParams(novosParams)
    buscar({ doc, contrato, nome })
  }

  return (
    <div className="busca-cliente-tela tela-entrada">
      <CabecalhoTela
        icone={MdPeopleAlt}
        cor={CORES.cliente}
        titulo="Clientes"
        subtitulo="Busque por documento, contrato ou nome."
      />

      <form className="busca-cliente-form" onSubmit={aoBuscar}>
        <label htmlFor="doc">CPF/CNPJ</label>
        <input id="doc" value={doc} onChange={(e) => setDoc(e.target.value)} placeholder="Somente números" />

        <label htmlFor="contrato">Número do contrato</label>
        <input
          id="contrato"
          value={contrato}
          onChange={(e) => setContrato(e.target.value)}
          inputMode="numeric"
          placeholder="Ex: 12345"
        />

        <label htmlFor="nome">Nome</label>
        <input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome ou razão social" />

        {erro && <p className="busca-cliente-erro">{erro}</p>}

        <button type="submit" className="busca-cliente-btn" disabled={carregando}>
          <MdSearch size={18} /> {carregando ? 'Buscando…' : 'Buscar'}
        </button>
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

      {!carregando && jaBuscou && resultados.length === 0 && (
        <EstadoVazio icone={MdPeopleAlt} titulo="Nenhum cliente encontrado" subtitulo="Confira os dados e tente novamente." />
      )}

      {!carregando && resultados.length > 0 && (
        <ul className="busca-cliente-lista">
          {resultados.map((resultado) => (
            <li key={resultado.client_pk} className="ticket-card">
              <Link to={`/clientes/${resultado.client_pk}`} className="busca-cliente-link" viewTransition>
                <strong>{resultado.cliente.client_complete_name ?? resultado.cliente.client_name ?? `Cliente #${resultado.client_pk}`}</strong>
                {resultado.cliente.client_doc1 && <p>Documento: {resultado.cliente.client_doc1}</p>}
                {resultado.cpes.length > 0 && (
                  <p>
                    {resultado.cpes.length} conexão(ões) — contrato(s):{' '}
                    {resultado.cpes.map((c) => c.contract_pk).filter(Boolean).join(', ') || 'não informado'}
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
