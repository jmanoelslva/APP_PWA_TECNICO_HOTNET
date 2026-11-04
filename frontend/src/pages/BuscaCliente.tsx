import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MdCable, MdHistory, MdPeopleAlt, MdWifi } from 'react-icons/md'
import {
  ApiError,
  buscarClientes,
  buscarCpe,
  buscarOnu,
  type BuscaClienteResultado,
  type CpeDto,
  type OnuDto,
} from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import { CORES } from '../utils/cores'
import { detectarTipoBusca, formatarDocumento } from '../utils/formatacao'
import { lerRecentes, limparRecentes, type ClienteRecente } from '../utils/buscaUnica'
import './BuscaCliente.css'

interface Resultados {
  clientes: BuscaClienteResultado[]
  onus: OnuDto[]
  conexoes: CpeDto[]
}

const VAZIO: Resultados = { clientes: [], onus: [], conexoes: [] }

/**
 * Busca única (item "Buscar" da barra de navegação). Ao vivo, como a da
 * Home e as de Conexão/ONU: digitou 2 letras, espera 350 ms parado e
 * consulta. Em paralelo: cliente (nome/contrato/CPF), ONU pelo serial
 * (prefixo, mesma consulta da tela ONU) e conexão pelo usuário PPPoE
 * (parcial). Texto com espaço é nome — aí só busca cliente. O termo fica
 * na URL (?busca=) para voltar de um resultado e achar a mesma lista.
 */
export default function BuscaCliente() {
  const [params, setParams] = useSearchParams()
  const [busca, setBusca] = useState(params.get('busca') ?? '')
  const [carregando, setCarregando] = useState(false)
  const [jaBuscou, setJaBuscou] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultados, setResultados] = useState<Resultados>(VAZIO)
  const [recentes, setRecentes] = useState<ClienteRecente[]>(lerRecentes)

  useEffect(() => {
    const termo = busca.trim()
    if (termo.length < 2) {
      setResultados(VAZIO)
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
      const semEspaco = !/\s/.test(termo)
      Promise.allSettled([
        buscarClientes(detectarTipoBusca(termo)),
        semEspaco ? buscarOnu({ serial: termo }) : Promise.resolve({ results: [] as OnuDto[] }),
        semEspaco ? buscarCpe({ username: termo }) : Promise.resolve({ results: [] as CpeDto[] }),
      ])
        .then(([clientes, onus, conexoes]) => {
          if (cancelado) return
          setResultados({
            clientes: clientes.status === 'fulfilled' ? clientes.value.results : [],
            onus: onus.status === 'fulfilled' ? onus.value.results : [],
            conexoes: conexoes.status === 'fulfilled' ? conexoes.value.results : [],
          })
          // Erro só quando as três falharam — uma falha sozinha só deixa
          // aquele grupo vazio.
          if (clientes.status === 'rejected' && onus.status === 'rejected' && conexoes.status === 'rejected') {
            const motivo = clientes.reason
            setErro(motivo instanceof ApiError ? motivo.message : 'Não foi possível buscar agora.')
          }
          setJaBuscou(true)
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

  const total = resultados.clientes.length + resultados.onus.length + resultados.conexoes.length

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
          placeholder="Ex: João Silva, 12345 ou FHTT9A3C"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />

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

      {!carregando && jaBuscou && !erro && total === 0 && (
        <EstadoVazio icone={MdPeopleAlt} titulo="Nada encontrado" subtitulo="Confira os dados e tente novamente." />
      )}

      {!carregando && resultados.onus.length > 0 && (
        <section className="busca-cliente-grupo">
          <h2>
            <MdCable size={16} /> ONU
          </h2>
          <ul className="busca-cliente-lista">
            {resultados.onus.map((onu) => (
              <li key={`onu-${onu.pk}`} className="ticket-card">
                <Link
                  to={`/onu?serial=${encodeURIComponent(onu.sn ?? '')}`}
                  className="busca-cliente-link"
                  viewTransition
                >
                  <strong>{onu.sn ?? `ONU #${onu.pk}`}</strong>
                  {onu.client_name && <p>{onu.client_name}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!carregando && resultados.conexoes.length > 0 && (
        <section className="busca-cliente-grupo">
          <h2>
            <MdWifi size={16} /> Conexão (PPPoE)
          </h2>
          <ul className="busca-cliente-lista">
            {resultados.conexoes.map((cpe) => (
              <li key={`cpe-${cpe.pk}`} className="ticket-card">
                <Link to={`/conexao?cpe_pk=${cpe.pk}`} className="busca-cliente-link" viewTransition>
                  <strong>{cpe.username ?? `Conexão #${cpe.pk}`}</strong>
                  {cpe.client_complete_name && <p>{cpe.client_complete_name}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!carregando && resultados.clientes.length > 0 && (
        <section className="busca-cliente-grupo">
          <h2>
            <MdPeopleAlt size={16} /> Clientes
          </h2>
          <ul className="busca-cliente-lista">
            {resultados.clientes.map((resultado) => (
              <li key={resultado.client_pk} className="ticket-card">
                <Link to={`/clientes/${resultado.client_pk}`} className="busca-cliente-link" viewTransition>
                  <strong>
                    {resultado.cliente.client_complete_name ?? resultado.cliente.client_name ?? `Cliente #${resultado.client_pk}`}
                  </strong>
                  {resultado.cliente.client_doc1 && <p>Documento: {formatarDocumento(resultado.cliente.client_doc1)}</p>}
                  {resultado.cpes.length > 0 && (
                    <p>
                      {resultado.cpes.length} conexão(ões) — contrato(s):{' '}
                      {resultado.cpes.map((c) => c.contract_number ?? c.contract_pk).filter(Boolean).join(', ') ||
                        'não informado'}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
