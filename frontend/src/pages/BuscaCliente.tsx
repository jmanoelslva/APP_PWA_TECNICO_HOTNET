import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MdPeopleAlt, MdSearch } from 'react-icons/md'
import { ApiError, buscarClientes, type BuscaClienteResultado } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import { CORES } from '../utils/cores'
import './BuscaCliente.css'

// Um campo só decide sozinho o que foi digitado, em vez de pedir pro
// técnico escolher entre nome/contrato/documento: CPF tem 11 dígitos,
// CNPJ tem 14 — só números com uma dessas contagens vira busca por
// documento; outra quantidade de dígitos vira busca por contrato;
// qualquer coisa com letra vira busca por nome.
function detectarTipoBusca(valor: string): { doc?: string; contrato?: number; nome?: string } {
  const termo = valor.trim()
  const somenteDigitos = termo.replace(/\D/g, '')
  if (somenteDigitos && somenteDigitos.length === termo.length) {
    if (somenteDigitos.length === 11 || somenteDigitos.length === 14) return { doc: somenteDigitos }
    return { contrato: Number(somenteDigitos) }
  }
  return { nome: termo }
}

export default function BuscaCliente() {
  const [params, setParams] = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')
  const [carregando, setCarregando] = useState(false)
  const [jaBuscou, setJaBuscou] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultados, setResultados] = useState<BuscaClienteResultado[]>([])

  async function buscar(termo: string) {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await buscarClientes(detectarTipoBusca(termo))
      setResultados(resposta.results)
      setJaBuscou(true)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível buscar o cliente.')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    // Refaz a busca sozinho quando a tela é montada com o termo já na
    // URL — sem isso, sair pra ver Conexão/ONU/detalhe de um resultado e
    // voltar perdia a busca inteira, obrigando o técnico a buscar de novo.
    const termoInicial = params.get('busca')
    if (termoInicial) buscar(termoInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function aoBuscar(evento: FormEvent) {
    evento.preventDefault()
    if (!busca.trim()) {
      setErro('Digite um nome, número de contrato ou CPF/CNPJ.')
      return
    }
    setParams({ busca: busca.trim() })
    buscar(busca)
  }

  return (
    <div className="busca-cliente-tela tela-entrada">
      <CabecalhoTela
        icone={MdPeopleAlt}
        cor={CORES.cliente}
        titulo="Clientes"
        subtitulo="Busque por nome, contrato ou CPF/CNPJ."
      />

      <form className="busca-cliente-form" onSubmit={aoBuscar}>
        <label htmlFor="busca">Nome, contrato ou CPF/CNPJ</label>
        <input
          id="busca"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Ex: João Silva, 12345 ou 12345678900"
        />

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
