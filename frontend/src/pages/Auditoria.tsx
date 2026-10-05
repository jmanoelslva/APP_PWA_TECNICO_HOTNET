import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import type { IconType } from 'react-icons'
import { MdArrowForward, MdDeleteOutline, MdEdit, MdLink, MdManageSearch, MdRestartAlt, MdRouter, MdWifi } from 'react-icons/md'
import { ApiError, listarAuditoria } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import EstadoVazio from '../components/EstadoVazio'
import Skeleton from '../components/Skeleton'
import { agruparPorDia, detalhes, hora, mudancas, type DiaAuditoria } from '../utils/auditoria'
import { CORES } from '../utils/cores'
import './Auditoria.css'

/**
 * Quem fez o quê, de qual IP: ações que mexem no equipamento do cliente
 * (reiniciar/remover/renomear/associar ONU, Wi-Fi e acesso ao roteador). Só para os
 * usuários liberados em AUDITORIA_USUARIOS no servidor.
 */

const ACOES: { valor: string; rotulo: string; filtro: string; icone: IconType; cor: string }[] = [
  { valor: 'onu.remover', rotulo: 'Removeu ONU', filtro: 'Remoções', icone: MdDeleteOutline, cor: CORES.erro },
  { valor: 'onu.reiniciar', rotulo: 'Reiniciou ONU', filtro: 'Reinícios', icone: MdRestartAlt, cor: CORES.alerta },
  { valor: 'onu.renomear', rotulo: 'Renomeou ONU', filtro: 'Renomeações', icone: MdEdit, cor: CORES.primaria },
  { valor: 'onu.associar_cliente', rotulo: 'Associou ONU a cliente', filtro: 'Associações', icone: MdLink, cor: CORES.cliente },
  { valor: 'cpe.editar_wifi', rotulo: 'Alterou Wi-Fi', filtro: 'Wi-Fi', icone: MdWifi, cor: CORES.conexao },
  {
    valor: 'cpe.editar_acesso_roteador',
    rotulo: 'Alterou acesso ao roteador',
    filtro: 'Acesso ao roteador',
    icone: MdRouter,
    cor: CORES.ferramentas,
  },
]
const POR_ACAO = Object.fromEntries(ACOES.map((a) => [a.valor, a]))

const PASSO = 100

function plural(n: number): string {
  return n === 1 ? '1 ação' : `${n} ações`
}

export default function Auditoria() {
  const [tecnico, setTecnico] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [filtro, setFiltro] = useState({ tecnico: '', acao: '', de: '', ate: '' })
  const [limite, setLimite] = useState(PASSO)
  const [dias, setDias] = useState<DiaAuditoria[] | null>(null)
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
        setDias(agruparPorDia(r.eventos))
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
    setFiltro((f) => ({ ...f, tecnico: tecnico.trim(), de, ate }))
  }

  // O tipo de ação filtra na hora; técnico e datas esperam o "Filtrar".
  function escolherAcao(acao: string) {
    setLimite(PASSO)
    setFiltro((f) => ({ ...f, acao }))
  }

  return (
    <div className="auditoria-tela tela-entrada">
      <CabecalhoTela
        icone={MdManageSearch}
        cor={CORES.ferramentas}
        titulo="Auditoria"
        subtitulo="Quem mexeu no equipamento do cliente, quando e de qual IP."
      />

      <div className="auditoria-chips" role="group" aria-label="Tipo de ação">
        {[{ valor: '', filtro: 'Todas' }, ...ACOES].map((a) => (
          <button
            key={a.valor}
            type="button"
            className="auditoria-chip"
            aria-pressed={filtro.acao === a.valor}
            onClick={() => escolherAcao(a.valor)}
          >
            {a.filtro}
          </button>
        ))}
      </div>

      <form className="auditoria-filtros" onSubmit={buscar}>
        {/* Duas colunas: datas (De em cima de Até) e técnico em cima do Filtrar. */}
        <label className="auditoria-filtro-de">
          De
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
        </label>
        <label className="auditoria-filtro-ate">
          Até
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </label>
        <label className="auditoria-filtro-tecnico">
          Técnico
          <input value={tecnico} onChange={(e) => setTecnico(e.target.value)} placeholder="Usuário" />
        </label>
        <button
          className="botao botao-secundario auditoria-filtro-botao"
          style={{ '--botao-cor': CORES.ferramentas } as CSSProperties}
        >
          Filtrar
        </button>
      </form>

      {erro && <p className="auditoria-erro">{erro}</p>}
      {!erro && carregando && !dias && (
        <div className="auditoria-item">
          <Skeleton width="60%" height={14} />
          <Skeleton width="40%" height={12} />
        </div>
      )}
      {!erro && dias?.length === 0 && <EstadoVazio icone={MdManageSearch} titulo="Nenhuma ação encontrada." />}

      {!erro &&
        dias?.map((grupo) => (
          <section key={grupo.dia} className="auditoria-dia">
            <h2 className="auditoria-dia-titulo">
              <span>{grupo.titulo}</span>
              <span>{plural(grupo.eventos.length)}</span>
            </h2>
            <ul className="auditoria-lista">
              {grupo.eventos.map((ev, i) => {
                const acao = POR_ACAO[ev.acao]
                const Icone = acao?.icone ?? MdManageSearch
                const alvo = ev.alvo ?? {}
                const listaMudancas = mudancas(alvo, ev.acao)
                const listaDetalhes = detalhes(alvo, ev.acao)
                return (
                  <li
                    key={`${ev.quando}-${i}`}
                    className={`auditoria-item${ev.acao === 'onu.remover' ? ' auditoria-item-grave' : ''}`}
                    style={{ '--acao-cor': acao?.cor ?? CORES.ferramentas } as CSSProperties}
                  >
                    <div className="auditoria-topo">
                      <span className="auditoria-icone" aria-hidden="true">
                        <Icone size={18} />
                      </span>
                      <div className="auditoria-titulo">
                        <strong>{acao?.rotulo ?? ev.acao}</strong>
                        <span>
                          {ev.tecnico} · {hora(ev.quando)}
                        </span>
                        <span>IP {ev.ip}</span>
                      </div>
                    </div>

                    {listaMudancas.length > 0 && (
                      <div className="auditoria-mudancas">
                        {listaMudancas.map((m) => (
                          <div key={m.rotulo} className="auditoria-mudanca">
                            <span className="auditoria-rotulo">{m.rotulo}</span>
                            {m.antes !== undefined && (
                              <>
                                <s className="auditoria-antes">{m.antes}</s>
                                <MdArrowForward size={14} aria-label="para" />
                              </>
                            )}
                            <strong className="auditoria-depois">{m.depois}</strong>
                            {m.nota && <span className="auditoria-nota">({m.nota})</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {listaDetalhes.length > 0 && (
                      <dl className="auditoria-detalhes">
                        {listaDetalhes.map((d) => (
                          <div key={d.rotulo}>
                            <dt>{d.rotulo}</dt>
                            <dd>{d.valor}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

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
