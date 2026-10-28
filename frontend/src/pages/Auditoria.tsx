import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import type { IconType } from 'react-icons'
import {
  MdAddLocationAlt,
  MdArrowForward,
  MdCancel,
  MdDeleteOutline,
  MdEdit,
  MdEditLocationAlt,
  MdLink,
  MdLocationOff,
  MdManageSearch,
  MdMyLocation,
  MdPhone,
  MdReplay,
  MdRestartAlt,
  MdRouter,
  MdWifi,
} from 'react-icons/md'
import { ApiError, listarAuditoria } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import PullToRefresh from '../components/PullToRefresh'
import EstadoVazio from '../components/EstadoVazio'
import Skeleton from '../components/Skeleton'
import { agruparPorDia, detalhes, hora, mudancas, type DiaAuditoria } from '../utils/auditoria'
import { CORES } from '../utils/cores'
import './Auditoria.css'

/**
 * Quem fez o quê, de qual IP: ações que mexem no cadastro e no equipamento
 * do cliente (ONU, Wi-Fi, acesso ao roteador, endereço, telefone, OS). Só
 * para os usuários liberados em AUDITORIA_USUARIOS no servidor.
 */

const ACOES: { valor: string; rotulo: string; icone: IconType; cor: string }[] = [
  { valor: 'onu.remover', rotulo: 'Removeu ONU', icone: MdDeleteOutline, cor: CORES.erro },
  { valor: 'onu.reiniciar', rotulo: 'Reiniciou ONU', icone: MdRestartAlt, cor: CORES.alerta },
  { valor: 'onu.renomear', rotulo: 'Renomeou ONU', icone: MdEdit, cor: CORES.primaria },
  { valor: 'onu.associar_cliente', rotulo: 'Associou ONU a cliente', icone: MdLink, cor: CORES.cliente },
  { valor: 'cpe.editar_wifi', rotulo: 'Alterou Wi-Fi', icone: MdWifi, cor: CORES.conexao },
  { valor: 'cpe.editar_acesso_roteador', rotulo: 'Alterou acesso ao roteador', icone: MdRouter, cor: CORES.ferramentas },
  { valor: 'cpe.localizacao', rotulo: 'Alterou localização do equipamento', icone: MdMyLocation, cor: CORES.endereco },
  { valor: 'endereco.criar', rotulo: 'Criou endereço', icone: MdAddLocationAlt, cor: CORES.endereco },
  { valor: 'endereco.editar', rotulo: 'Editou endereço', icone: MdEditLocationAlt, cor: CORES.endereco },
  { valor: 'endereco.excluir', rotulo: 'Excluiu endereço', icone: MdLocationOff, cor: CORES.erro },
  { valor: 'telefone.criar', rotulo: 'Adicionou telefone', icone: MdPhone, cor: CORES.cliente },
  { valor: 'telefone.editar', rotulo: 'Editou telefone', icone: MdPhone, cor: CORES.cliente },
  { valor: 'os.cancelar', rotulo: 'Cancelou OS', icone: MdCancel, cor: CORES.erro },
  { valor: 'os.reabrir', rotulo: 'Reabriu OS', icone: MdReplay, cor: CORES.suporte },
]
const POR_ACAO = Object.fromEntries(ACOES.map((a) => [a.valor, a]))
// Ações que apagam algo: borda vermelha no cartão.
const GRAVES = new Set(['onu.remover', 'endereco.excluir', 'os.cancelar'])

// Chips do topo. O backend filtra pelo começo do nome da ação, então
// "endereco." pega criar, editar e excluir de uma vez.
const FILTROS: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'onu.remover', rotulo: 'Remoções' },
  { valor: 'onu.reiniciar', rotulo: 'Reinícios' },
  { valor: 'onu.renomear', rotulo: 'Renomeações' },
  { valor: 'onu.associar_cliente', rotulo: 'Associações' },
  { valor: 'cpe.editar_wifi', rotulo: 'Wi-Fi' },
  { valor: 'cpe.editar_acesso_roteador', rotulo: 'Acesso ao roteador' },
  { valor: 'endereco.', rotulo: 'Endereços' },
  { valor: 'cpe.localizacao', rotulo: 'Localização' },
  { valor: 'telefone.', rotulo: 'Telefones' },
  { valor: 'os.', rotulo: 'OS' },
]

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
  const [recarga, setRecarga] = useState(0)

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
  }, [filtro, limite, recarga])

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
    <PullToRefresh aoAtualizar={async () => setRecarga((atual) => atual + 1)}>
      <div className="auditoria-tela tela-entrada">
        <CabecalhoTela
          icone={MdManageSearch}
          cor={CORES.ferramentas}
          titulo="Auditoria"
          subtitulo="Quem mexeu no equipamento do cliente, quando e de qual IP."
        />

        <div className="auditoria-chips" role="group" aria-label="Tipo de ação">
          {FILTROS.map((a) => (
            <button
              key={a.valor}
              type="button"
              className="auditoria-chip"
              aria-pressed={filtro.acao === a.valor}
              onClick={() => escolherAcao(a.valor)}
            >
              {a.rotulo}
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
                      className={`auditoria-item${GRAVES.has(ev.acao) ? ' auditoria-item-grave' : ''}`}
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
    </PullToRefresh>
  )
}
