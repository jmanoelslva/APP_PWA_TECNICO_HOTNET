import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaWhatsapp } from 'react-icons/fa'
import { MdBuild, MdDirections, MdOpenInNew, MdPhone } from 'react-icons/md'
import { buscarDetalheCliente, listarOrdensServico, type EnderecoDto, type OrdemServicoDto } from '../api/client'
import { enderecoCurto, horarioOs, linkRota, osDoDia, telefonesDoCliente, type OsDoDia } from '../utils/minhasOs'
import { linkLigar, linkWhatsapp } from '../utils/formatacao'
import Skeleton from './Skeleton'
import './MinhasOsHoje.css'

// Mesmo limite da tela OS / Suporte: a lista já vem só com OS em aberto.
const LIMITE = 100

function tituloOs(os: OrdemServicoDto): string {
  return os.task_name ?? (os.op_desc?.trim() || `OS do chamado #${os.ticket_pk ?? '-'}`)
}

/**
 * "Minhas OS de hoje" na tela inicial: a próxima OS em destaque (rota,
 * ligar, WhatsApp, abrir) e as demais do dia em linhas curtas. "Minhas" = OS
 * em que o técnico logado é o responsável (staff_username), ver
 * backend/app/routers/ordens_servico.py.
 */
export interface ResumoDoDia {
  total: number
  atrasadas: number
}

export default function MinhasOsHoje({ onResumo }: { onResumo?: (resumo: ResumoDoDia | null) => void }) {
  const navigate = useNavigate()
  const [itens, setItens] = useState<OsDoDia[] | null>(null)
  const [erro, setErro] = useState(false)
  // Endereço completo (coordenadas) e telefone só da próxima OS — uma
  // chamada a mais ao Controllr, não uma por OS.
  const [endereco, setEndereco] = useState<EnderecoDto | null>(null)
  const [telefones, setTelefones] = useState<string[]>([])

  useEffect(() => {
    let cancelado = false
    listarOrdensServico({ minhas: true, abertas: true, start: 0, limit: LIMITE })
      .then((resposta) => {
        if (cancelado) return
        const lista = osDoDia(resposta.results)
        setItens(lista)
        onResumo?.({ total: lista.length, atrasadas: lista.filter((item) => item.atrasada).length })
        const proxima = lista[0]?.os
        if (!proxima?.client_pk) return
        buscarDetalheCliente(proxima.client_pk)
          .then((detalhe) => {
            if (cancelado) return
            setEndereco(detalhe.enderecos.find((e) => e.address_pk === proxima.address_pk) ?? detalhe.enderecos[0] ?? null)
            setTelefones(telefonesDoCliente(detalhe.telefones ?? [], detalhe.cliente.client_phones))
          })
          .catch(() => {})
      })
      .catch(() => {
        if (cancelado) return
        setErro(true)
        onResumo?.(null)
      })
    return () => {
      cancelado = true
    }
    // Carrega uma vez ao abrir a tela inicial; onResumo só repassa o resultado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // Ligar: o primeiro número; WhatsApp: o primeiro que for celular.
  const telefone = telefones[0] ?? null
  const whatsapp = telefones.map(linkWhatsapp).find(Boolean) ?? null

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
              <a href={linkLigar(telefone) ?? `tel:${telefone}`} className="minhas-os-acao">
                <MdPhone size={18} /> Ligar
              </a>
            )}
            {whatsapp && (
              <a
                href={whatsapp}
                target="_blank"
                rel="noreferrer"
                className="minhas-os-acao minhas-os-acao-whatsapp"
                aria-label="WhatsApp"
                title="WhatsApp"
              >
                <FaWhatsapp size={18} />
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
