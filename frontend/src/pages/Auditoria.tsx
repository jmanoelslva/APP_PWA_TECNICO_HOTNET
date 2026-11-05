import { useEffect, useState, type CSSProperties } from 'react'
import type { IconType } from 'react-icons'
import { LuFileSearch } from 'react-icons/lu'
import {
  MdAddLocationAlt,
  MdAssignmentTurnedIn,
  MdAttachMoney,
  MdArrowForward,
  MdCancel,
  MdDeleteOutline,
  MdEdit,
  MdEditLocationAlt,
  MdHub,
  MdLink,
  MdLogin,
  MdLocationOff,
  MdManageSearch,
  MdMyLocation,
  MdNotes,
  MdPlayArrow,
  MdPhone,
  MdReplay,
  MdRestartAlt,
  MdRouter,
  MdSync,
  MdUndo,
  MdWifi,
} from 'react-icons/md'
import { ApiError, listarAuditoria } from '../api/client'
import Abas, { type Aba } from '../components/Abas'
import CabecalhoTela from '../components/CabecalhoTela'
import PullToRefresh from '../components/PullToRefresh'
import EstadoVazio from '../components/EstadoVazio'
import Skeleton from '../components/Skeleton'
import {
  agruparPorDia,
  datasDoPeriodo,
  detalhes,
  hora,
  mudancas,
  type DiaAuditoria,
  type PeriodoAuditoria,
} from '../utils/auditoria'
import { CORES } from '../utils/cores'
import './Auditoria.css'

/**
 * Quem fez o quê, de qual IP: ações que mexem no cadastro e no equipamento
 * do cliente (ONU, Wi-Fi, acesso ao roteador, CTO, endereço, telefone, OS,
 * liberação financeira) e as entradas no app. Só
 * para os usuários liberados em AUDITORIA_USUARIOS no servidor.
 */

const ACOES: { valor: string; rotulo: string; icone: IconType; cor: string }[] = [
  { valor: 'onu.remover', rotulo: 'Removeu ONU', icone: MdDeleteOutline, cor: CORES.erro },
  { valor: 'onu.reiniciar', rotulo: 'Reiniciou ONU', icone: MdRestartAlt, cor: CORES.alerta },
  { valor: 'onu.renomear', rotulo: 'Renomeou ONU', icone: MdEdit, cor: CORES.primaria },
  { valor: 'onu.associar_cliente', rotulo: 'Associou ONU a cliente', icone: MdLink, cor: CORES.cliente },
  { valor: 'onu.atualizar', rotulo: 'Atualizou dados da ONU', icone: MdSync, cor: CORES.onu },
  { valor: 'cpe.editar_wifi', rotulo: 'Alterou Wi-Fi', icone: MdWifi, cor: CORES.conexao },
  { valor: 'cpe.editar_acesso_roteador', rotulo: 'Alterou acesso ao roteador', icone: MdRouter, cor: CORES.ferramentas },
  { valor: 'cpe.localizacao', rotulo: 'Alterou localização do equipamento', icone: MdMyLocation, cor: CORES.endereco },
  { valor: 'cpe.editar_cto', rotulo: 'Alterou CTO da conexão', icone: MdHub, cor: CORES.conexao },
  { valor: 'cpe.editar_observacao', rotulo: 'Alterou observação da conexão', icone: MdNotes, cor: CORES.conexao },
  { valor: 'endereco.criar', rotulo: 'Criou endereço', icone: MdAddLocationAlt, cor: CORES.endereco },
  { valor: 'endereco.editar', rotulo: 'Editou endereço', icone: MdEditLocationAlt, cor: CORES.endereco },
  { valor: 'endereco.excluir', rotulo: 'Excluiu endereço', icone: MdLocationOff, cor: CORES.erro },
  { valor: 'telefone.criar', rotulo: 'Adicionou telefone', icone: MdPhone, cor: CORES.cliente },
  { valor: 'telefone.editar', rotulo: 'Editou telefone', icone: MdPhone, cor: CORES.cliente },
  { valor: 'os.responder', rotulo: 'Respondeu OS', icone: MdAssignmentTurnedIn, cor: CORES.suporte },
  { valor: 'os.iniciar', rotulo: 'Iniciou OS', icone: MdPlayArrow, cor: CORES.suporte },
  { valor: 'os.finalizar', rotulo: 'Finalizou OS', icone: MdAssignmentTurnedIn, cor: CORES.sucesso },
  { valor: 'os.desfazer_resposta', rotulo: 'Desfez resposta da OS', icone: MdUndo, cor: CORES.alerta },
  { valor: 'os.desfazer_inicio', rotulo: 'Desfez início da OS', icone: MdUndo, cor: CORES.alerta },
  { valor: 'os.desfazer_finalizacao', rotulo: 'Desfez finalização da OS', icone: MdUndo, cor: CORES.alerta },
  { valor: 'os.cancelar', rotulo: 'Cancelou OS', icone: MdCancel, cor: CORES.erro },
  { valor: 'os.reabrir', rotulo: 'Reabriu OS', icone: MdReplay, cor: CORES.suporte },
  { valor: 'financeiro.liberacao', rotulo: 'Liberou fatura (confiança)', icone: MdAttachMoney, cor: CORES.financeiro },
  { valor: 'auth.login', rotulo: 'Entrou no app', icone: MdLogin, cor: CORES.textoSecundario },
]
const POR_ACAO = Object.fromEntries(ACOES.map((a) => [a.valor, a]))
// Ações que apagam algo: borda vermelha no cartão.
const GRAVES = new Set(['onu.remover', 'endereco.excluir', 'os.cancelar'])

// Tipo de ação numa lista agrupada (antes eram 11 botões em várias
// linhas). O backend filtra pelo começo do nome da ação, então "onu." pega
// todas da ONU e "endereco." criar, editar e excluir de uma vez.
const GRUPOS_ACAO: { grupo: string; opcoes: { valor: string; rotulo: string }[] }[] = [
  {
    grupo: 'ONU',
    opcoes: [
      { valor: 'onu.', rotulo: 'Tudo da ONU' },
      { valor: 'onu.remover', rotulo: 'Remoções' },
      { valor: 'onu.reiniciar', rotulo: 'Reinícios' },
      { valor: 'onu.renomear', rotulo: 'Renomeações' },
      { valor: 'onu.associar_cliente', rotulo: 'Associações a cliente' },
      { valor: 'onu.atualizar', rotulo: 'Atualizações' },
    ],
  },
  {
    grupo: 'Conexão',
    opcoes: [
      { valor: 'cpe.', rotulo: 'Tudo da conexão' },
      { valor: 'cpe.editar_wifi', rotulo: 'Wi-Fi' },
      { valor: 'cpe.editar_acesso_roteador', rotulo: 'Acesso ao roteador' },
      { valor: 'cpe.localizacao', rotulo: 'Localização' },
      { valor: 'cpe.editar_cto', rotulo: 'CTO e porta' },
      { valor: 'cpe.editar_observacao', rotulo: 'Observação' },
    ],
  },
  {
    grupo: 'Cliente',
    opcoes: [
      { valor: 'endereco.', rotulo: 'Endereços' },
      { valor: 'telefone.', rotulo: 'Telefones' },
      { valor: 'financeiro.', rotulo: 'Liberações financeiras' },
    ],
  },
  {
    grupo: 'OS',
    opcoes: [
      { valor: 'os.', rotulo: 'Tudo da OS' },
      { valor: 'os.responder', rotulo: 'Respostas' },
      { valor: 'os.iniciar', rotulo: 'Inícios' },
      { valor: 'os.finalizar', rotulo: 'Finalizações' },
      { valor: 'os.desfazer', rotulo: 'Etapas desfeitas' },
      { valor: 'os.cancelar', rotulo: 'Cancelamentos' },
      { valor: 'os.reabrir', rotulo: 'Reaberturas' },
    ],
  },
  { grupo: 'Acesso', opcoes: [{ valor: 'auth.login', rotulo: 'Entradas no app' }] },
]

const PERIODOS: Aba<PeriodoAuditoria>[] = [
  { chave: 'tudo', rotulo: 'Tudo' },
  { chave: 'hoje', rotulo: 'Hoje' },
  { chave: '7', rotulo: '7 dias' },
  { chave: '30', rotulo: '30 dias' },
  { chave: 'periodo', rotulo: 'Período' },
]

const FILTRO_VAZIO = { tecnico: '', acao: '', de: '', ate: '' }

const PASSO = 100

function plural(n: number): string {
  return n === 1 ? '1 ação' : `${n} ações`
}

export default function Auditoria() {
  const [tecnico, setTecnico] = useState('')
  const [periodo, setPeriodo] = useState<PeriodoAuditoria>('tudo')
  const [escolhido, setEscolhido] = useState({ de: '', ate: '' })
  const [filtro, setFiltro] = useState(FILTRO_VAZIO)
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

  // Tudo filtra sozinho (sem botão "Filtrar"): período e ação na hora,
  // técnico depois que para de digitar.
  function mudarFiltro(parcial: Partial<typeof FILTRO_VAZIO>) {
    setLimite(PASSO)
    setFiltro((f) => ({ ...f, ...parcial }))
  }

  useEffect(() => {
    const valor = tecnico.trim()
    if (valor === filtro.tecnico) return
    const temporizador = setTimeout(() => mudarFiltro({ tecnico: valor }), 400)
    return () => clearTimeout(temporizador)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tecnico])

  function escolherPeriodo(novo: PeriodoAuditoria, datas = escolhido) {
    setPeriodo(novo)
    mudarFiltro(datasDoPeriodo(novo, datas))
  }

  function escolherData(campo: 'de' | 'ate', valor: string) {
    const datas = { ...escolhido, [campo]: valor }
    setEscolhido(datas)
    escolherPeriodo('periodo', datas)
  }

  function limparFiltros() {
    setTecnico('')
    setPeriodo('tudo')
    setEscolhido({ de: '', ate: '' })
    setLimite(PASSO)
    setFiltro(FILTRO_VAZIO)
  }

  const comFiltro = !!(filtro.tecnico || filtro.acao || filtro.de || filtro.ate)
  const totalEventos = dias?.reduce((soma, dia) => soma + dia.eventos.length, 0) ?? 0

  return (
    <PullToRefresh aoAtualizar={async () => setRecarga((atual) => atual + 1)}>
      <div className="auditoria-tela tela-entrada">
        <CabecalhoTela
          icone={LuFileSearch}
          cor={CORES.ferramentas}
          titulo="Auditoria"
          subtitulo="Quem mexeu no equipamento do cliente, quando e de qual IP."
        />

        <div className="auditoria-filtros">
          <Abas abas={PERIODOS} ativa={periodo} onEscolher={(p) => escolherPeriodo(p)} cor={CORES.ferramentas} rotulo="Período" />
          {periodo === 'periodo' && (
            <div className="auditoria-datas">
              <label>
                De
                <input className="campo" type="date" value={escolhido.de} onChange={(e) => escolherData('de', e.target.value)} />
              </label>
              <label>
                Até
                <input className="campo" type="date" value={escolhido.ate} onChange={(e) => escolherData('ate', e.target.value)} />
              </label>
            </div>
          )}
          <div className="auditoria-campos">
            <select
              className="campo"
              value={filtro.acao}
              onChange={(e) => mudarFiltro({ acao: e.target.value })}
              aria-label="Tipo de ação"
            >
              <option value="">Todas as ações</option>
              {GRUPOS_ACAO.map((g) => (
                <optgroup key={g.grupo} label={g.grupo}>
                  {g.opcoes.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input
              className="campo"
              value={tecnico}
              onChange={(e) => setTecnico(e.target.value)}
              placeholder="Técnico"
              aria-label="Técnico"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          <div className="auditoria-resumo">
            <span>{dias ? plural(totalEventos) : ''}</span>
            {comFiltro && (
              <button type="button" className="auditoria-limpar" onClick={limparFiltros}>
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {erro && <p className="auditoria-erro">{erro}</p>}
        {!erro && carregando && !dias && (
          <div className="auditoria-item">
            <Skeleton width="60%" height={14} />
            <Skeleton width="40%" height={12} />
          </div>
        )}
        {!erro && dias?.length === 0 && <EstadoVazio icone={LuFileSearch} titulo="Nenhuma ação encontrada." />}

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
