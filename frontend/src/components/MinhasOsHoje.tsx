import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MdBuild, MdDirections, MdOpenInNew, MdPhone } from 'react-icons/md'
import { buscarDetalheCliente, listarOrdensServico, type EnderecoDto, type OrdemServicoDto } from '../api/client'
import { enderecoCurto, horarioOs, linkRota, osDoDia, primeiroTelefone, type OsDoDia } from '../utils/minhasOs'
import Skeleton from './Skeleton'
import './MinhasOsHoje.css'

// Mesmo limite da tela OS / Suporte: a lista já vem só com OS em aberto.
const LIMITE = 100

function tituloOs(os: OrdemServicoDto): string {
  return os.task_name ?? (os.op_desc?.trim() || `OS do chamado #${os.ticket_pk ?? '-'}`)
}

/**
 * "Minhas OS de hoje" na tela inicial: a próxima OS em destaque (rota,
 * ligar, abrir) e as demais do dia em linhas curtas. "Minhas" = OS em que
 * o técnico logado é o responsável (staff_username), ver
 * backend/app/routers/ordens_servico.py.
 */
export default function MinhasOsHoje() {
  const navigate = useNavigate()
  const [itens, setItens] = useState<OsDoDia[] | null>(null)
  const [erro, setErro] = useState(false)
  // Endereço completo (coordenadas) e telefone só da próxima OS — uma
  // chamada a mais ao Controllr, não uma por OS.
  const [endereco, setEndereco] = useState<EnderecoDto | null>(null)
  const [telefone, setTelefone] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    listarOrdensServico({ minhas: true, abertas: true, start: 0, limit: LIMITE })
      .then((resposta) => {
        if (cancelado) return
        const lista = osDoDia(resposta.results)
        setItens(lista)
        const proxima = lista[0]?.os
        if (!proxima?.client_pk) return
        buscarDetalheCliente(proxima.client_pk)
          .then((detalhe) => {
            if (cancelado) return
            setEndereco(detalhe.enderecos.find((e) => e.address_pk === proxima.address_pk) ?? detalhe.enderecos[0] ?? null)
            setTelefone(primeiroTelefone(detalhe.telefones ?? [], detalhe.cliente.client_phones))
          })
          .catch(() => {})
      })
      .catch(() => {
        if (!cancelado) setErro(true)
      })
    return () => {
      cancelado = true
    }
  }, [])

  function abrir(os: OrdemServicoDto) {
    if (os.ticket_pk) navigate(`/os/${os.ticket_pk}`, { state: { os }, viewTransition: true })
  }

  // Falha ao carregar não deve atrapalhar a tela inicial: some o bloco e
  // a lista completa continua em OS / Suporte.
  if (erro) return null

  if (itens === null) {
    return (
      <section className="minhas-os">
        <h2 className="minhas-os-titulo">Minhas OS de hoje</h2>
        <div className="minhas-os-proxima">
          <Skeleton width="40%" height={13} />
          <Skeleton width="70%" height={16} />
          <Skeleton width="55%" height={12} />
        </div>
      </section>
    )
  }

  const [proxima, ...demais] = itens
  const rota = proxima ? linkRota(endereco, proxima.os) : null

  return (
    <section className="minhas-os">
      <h2 className="minhas-os-titulo">
        Minhas OS de hoje
        {itens.length > 0 && <span className="minhas-os-contagem">{itens.length}</span>}
      </h2>

      {!proxima && (
        <div className="minhas-os-vazio">
          <MdBuild size={18} /> Nenhuma OS sua para hoje.
        </div>
      )}

      {proxima && (
        <div className="minhas-os-proxima">
          <div className="minhas-os-proxima-topo">
            <span className="minhas-os-rotulo">Próxima</span>
            <span className="minhas-os-hora">{horarioOs(proxima)}</span>
            {proxima.atrasada && <span className="minhas-os-atrasada">Atrasada</span>}
          </div>
          <strong className="minhas-os-tipo">{tituloOs(proxima.os)}</strong>
          {proxima.os.client_complete_name && <span className="minhas-os-cliente">{proxima.os.client_complete_name}</span>}
          {enderecoCurto(endereco ?? proxima.os) && (
            <span className="minhas-os-endereco">{enderecoCurto(endereco ?? proxima.os)}</span>
          )}
          <div className="minhas-os-acoes">
            {rota && (
              <a href={rota} target="_blank" rel="noreferrer" className="minhas-os-acao">
                <MdDirections size={18} /> Rota
              </a>
            )}
            {telefone && (
              <a href={`tel:${telefone}`} className="minhas-os-acao">
                <MdPhone size={18} /> Ligar
              </a>
            )}
            <button type="button" className="minhas-os-acao minhas-os-acao-principal" onClick={() => abrir(proxima.os)}>
              <MdOpenInNew size={18} /> Abrir OS
            </button>
          </div>
        </div>
      )}

      {demais.length > 0 && (
        <ul className="minhas-os-lista">
          {demais.map((item) => (
            <li key={item.os.op_pk ?? item.os.op_os_pk}>
              <button type="button" onClick={() => abrir(item.os)}>
                <span className="minhas-os-hora">{horarioOs(item)}</span>
                <span className="minhas-os-linha">
                  <strong>{tituloOs(item.os)}</strong>
                  <span>{[item.os.client_complete_name, item.os.address_neighborhood].filter(Boolean).join(' · ')}</span>
                </span>
                {item.atrasada && <span className="minhas-os-atrasada">Atrasada</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
