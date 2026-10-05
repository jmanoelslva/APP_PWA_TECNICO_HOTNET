import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { MdManageSearch } from 'react-icons/md'
import { ApiError, listarAuditoria, type EventoAuditoria } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import EstadoVazio from '../components/EstadoVazio'
import Skeleton from '../components/Skeleton'
import { CORES } from '../utils/cores'
import './Auditoria.css'

/**
 * Quem fez o quê, de qual IP: ações que mexem no equipamento do cliente
 * (reiniciar/remover/renomear ONU, Wi-Fi e acesso ao roteador). Só para os
 * usuários liberados em AUDITORIA_USUARIOS no servidor.
 */

const ACOES: { valor: string; rotulo: string }[] = [
  { valor: 'onu.reiniciar', rotulo: 'Reiniciou ONU' },
  { valor: 'onu.remover', rotulo: 'Removeu ONU' },
  { valor: 'onu.renomear', rotulo: 'Renomeou ONU' },
  { valor: 'cpe.editar_wifi', rotulo: 'Alterou Wi-Fi' },
  { valor: 'cpe.editar_acesso_roteador', rotulo: 'Alterou acesso ao roteador' },
]
const ROTULO = Object.fromEntries(ACOES.map((a) => [a.valor, a.rotulo]))

type Alvo = Record<string, unknown>
const tem = (v: unknown) => v != null && v !== ''

/**
 * O que foi alterado, do jeito que aparece na tela da ONU: OLT pelo nome,
 * PON e número da ONU, serial e o nome novo (renomear). Registros antigos
 * só têm os números internos do Controllr; o backend completa o que achar.
 */
function descrever(alvo: Alvo): { rotulo: string; valor: string }[] {
  const itens: { rotulo: string; valor: string }[] = []
  // OLT sempre: pelo nome; sem ele (ONU e OLT já fora do Controllr), o número.
  const ehOnu = tem(alvo.onu_pk) || tem(alvo.onu_id) || tem(alvo.olt_pk)
  if (ehOnu) itens.push({ rotulo: 'OLT', valor: tem(alvo.olt_nome) ? String(alvo.olt_nome) : tem(alvo.olt_pk) ? String(alvo.olt_pk) : '—' })
  if (tem(alvo.onu_id)) {
    itens.push({ rotulo: 'ONU', valor: tem(alvo.porta) ? `PON ${alvo.porta} · ${alvo.onu_id}` : String(alvo.onu_id) })
  } else if (tem(alvo.onu_pk)) {
    itens.push({ rotulo: 'ONU', valor: String(alvo.onu_pk) })
  }
  if (tem(alvo.serial)) itens.push({ rotulo: 'Serial', valor: String(alvo.serial) })
  if (tem(alvo.onu_name)) {
    itens.push({
      rotulo: 'Nome',
      valor: tem(alvo.nome_anterior) ? `${alvo.nome_anterior} → ${alvo.onu_name}` : String(alvo.onu_name),
    })
  }
  if (tem(alvo.cpe_pk)) itens.push({ rotulo: 'Conexão', valor: String(alvo.cpe_pk) })
  if (tem(alvo.cpe_access_login)) itens.push({ rotulo: 'Login do roteador', valor: String(alvo.cpe_access_login) })
  if (tem(alvo.cpe_access_port)) itens.push({ rotulo: 'Porta de acesso', valor: String(alvo.cpe_access_port) })
  return itens
}

const PASSO = 100

function dataHora(quando: string): string {
  const m = quando.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : quando
}

export default function Auditoria() {
  const [tecnico, setTecnico] = useState('')
  const [acao, setAcao] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [filtro, setFiltro] = useState({ tecnico: '', acao: '', de: '', ate: '' })
  const [limite, setLimite] = useState(PASSO)
  const [eventos, setEventos] = useState<EventoAuditoria[] | null>(null)
  const [mais, setMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    listarAuditoria({
      tecnico: filtro.tecnico || undefined,
      acao: filtro.acao || undefined,
      de: filtro.de || undefined,
      ate: filtro.ate || undefined,
      limite,
    })
      .then((r) => {
        if (cancelado) return
        setEventos(r.eventos)
        setMais(r.mais)
        setErro(null)
      })
      .catch((e) => !cancelado && setErro(e instanceof ApiError ? e.message : 'Não foi possível carregar a auditoria.'))
      .finally(() => !cancelado && setCarregando(false))
    return () => {
      cancelado = true
    }
  }, [filtro, limite])

  function buscar(e: FormEvent) {
    e.preventDefault()
    setLimite(PASSO)
    setFiltro({ tecnico: tecnico.trim(), acao, de, ate })
  }

  return (
    <div className="auditoria-tela tela-entrada">
      <CabecalhoTela
        icone={MdManageSearch}
        cor={CORES.ferramentas}
        titulo="Auditoria"
        subtitulo="Quem mexeu no equipamento do cliente, quando e de qual IP."
      />

      <form className="auditoria-filtros" onSubmit={buscar}>
        <label>
          Técnico
          <input value={tecnico} onChange={(e) => setTecnico(e.target.value)} placeholder="Usuário" />
        </label>
        <label>
          Ação
          <select value={acao} onChange={(e) => setAcao(e.target.value)}>
            <option value="">Todas</option>
            {ACOES.map((a) => (
              <option key={a.valor} value={a.valor}>
                {a.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          De
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </label>
        <button className="botao botao-secundario" style={{ '--botao-cor': CORES.ferramentas } as CSSProperties}>
          Filtrar
        </button>
      </form>

      {erro && <p className="auditoria-erro">{erro}</p>}
      {!erro && carregando && !eventos && (
        <div className="auditoria-item">
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={12} />
        </div>
      )}
      {!erro && eventos?.length === 0 && <EstadoVazio icone={MdManageSearch} titulo="Nenhuma ação encontrada." />}

      {!erro && eventos && eventos.length > 0 && (
        <ul className="auditoria-lista">
          {eventos.map((ev, i) => (
            <li key={`${ev.quando}-${i}`} className="auditoria-item">
              <div className="auditoria-topo">
                <strong>{ROTULO[ev.acao] ?? ev.acao}</strong>
                <time>{dataHora(ev.quando)}</time>
              </div>
              <div className="auditoria-quem">
                <span>{ev.tecnico}</span>
                <span className="auditoria-ip">IP {ev.ip}</span>
              </div>
              {descrever(ev.alvo ?? {}).length > 0 && (
                <div className="auditoria-alvo">
                  {descrever(ev.alvo ?? {}).map((item) => (
                    <span key={item.rotulo}>
                      {item.rotulo}: <strong>{item.valor}</strong>
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!erro && mais && (
        <button
          className="botao botao-secundario botao-bloco"
          style={{ '--botao-cor': CORES.ferramentas } as CSSProperties}
          onClick={() => setLimite((l) => l + PASSO)}
          disabled={carregando}
        >
          {carregando ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </div>
  )
}
