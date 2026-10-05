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

// Campos do "alvo" que ajudam a achar o caso; o resto (ids internos) fica de fora.
const CAMPOS_ALVO: Record<string, string> = {
  onu_name: 'Nome',
  cpe_access_login: 'Login do roteador',
  cpe_access_port: 'Porta',
  onu_pk: 'ONU',
  cpe_pk: 'Conexão',
  olt_pk: 'OLT',
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
              {Object.entries(CAMPOS_ALVO).some(([k]) => ev.alvo?.[k] != null && ev.alvo[k] !== '') && (
                <div className="auditoria-alvo">
                  {Object.entries(CAMPOS_ALVO)
                    .filter(([k]) => ev.alvo?.[k] != null && ev.alvo[k] !== '')
                    .map(([k, rotulo]) => (
                      <span key={k}>
                        {rotulo}: <strong>{String(ev.alvo[k])}</strong>
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
