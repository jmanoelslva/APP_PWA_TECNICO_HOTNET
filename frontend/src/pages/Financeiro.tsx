import { useEffect, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MdAttachMoney, MdNoteAdd, MdReceipt } from 'react-icons/md'
import { ApiError, criarObservacaoFatura, listarFaturas, type FaturaDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import EstadoVazio from '../components/EstadoVazio'
import PullToRefresh from '../components/PullToRefresh'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import { formatarData, formatarMoeda } from '../utils/formatacao'
import './Financeiro.css'

type StatusFatura = 'paga' | 'atrasada' | 'aberta'

function statusFatura(fatura: FaturaDto): StatusFatura {
  if (fatura.invoice_date_credit) return 'paga'
  if (fatura.invoice_late) return 'atrasada'
  return 'aberta'
}

const ROTULO_STATUS: Record<StatusFatura, string> = {
  paga: 'Paga',
  atrasada: 'Atrasada',
  aberta: 'Em aberto',
}

export default function Financeiro() {
  const [params] = useSearchParams()
  const clientPk = Number(params.get('client_pk'))
  const contractPk = params.get('contract_pk') ? Number(params.get('contract_pk')) : null
  const { toast } = useToast()

  const [faturas, setFaturas] = useState<FaturaDto[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // 403 do Controllr = técnico sem liberação de ACL para o financeiro —
  // estado de permissão, não um erro para tentar de novo (ver
  // backend/app/routers/financeiro.py).
  const [naoPermitido, setNaoPermitido] = useState(false)
  const [faturaObservando, setFaturaObservando] = useState<FaturaDto | null>(null)

  useEffect(() => {
    if (!Number.isFinite(clientPk)) return
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientPk])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    setNaoPermitido(false)
    try {
      const resposta = await listarFaturas(clientPk)
      setFaturas(resposta.results)
    } catch (excecao) {
      if (excecao instanceof ApiError && excecao.status === 403) {
        setNaoPermitido(true)
      } else {
        setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar as faturas.')
      }
    } finally {
      setCarregando(false)
    }
  }

  if (!Number.isFinite(clientPk)) {
    return <p className="financeiro-status">Cliente não informado.</p>
  }

  return (
    <>
    <PullToRefresh aoAtualizar={carregar}>
      <div className="financeiro-tela tela-entrada">
        <CabecalhoTela
          icone={MdAttachMoney}
          cor={CORES.financeiro}
          titulo="Financeiro"
          subtitulo="Faturas e pagamentos em observação."
        />

        {carregando && (
          <ul className="financeiro-lista">
            {[0, 1, 2].map((i) => (
              <li key={i} className="fatura-card">
                <Skeleton width="50%" height={15} />
                <Skeleton width="30%" height={12} />
              </li>
            ))}
          </ul>
        )}

        {!carregando && naoPermitido && (
          <div className="financeiro-status">
            <p>Você não tem permissão para acessar o financeiro.</p>
          </div>
        )}

        {!carregando && !naoPermitido && erro && (
          <div className="financeiro-status">
            <p>{erro}</p>
            <button className="botao botao-secundario" style={{ '--botao-cor': CORES.financeiro } as CSSProperties} onClick={carregar}>
              Tentar novamente
            </button>
          </div>
        )}

        {!carregando && !naoPermitido && !erro && faturas.length === 0 && (
          <EstadoVazio icone={MdReceipt} titulo="Nenhuma fatura encontrada" />
        )}

        {!carregando && !naoPermitido && !erro && faturas.length > 0 && (
          <ul className="financeiro-lista">
            {faturas.map((fatura) => {
              const status = statusFatura(fatura)
              const emObservacao = fatura.obs_pk != null
              return (
                <li key={fatura.invoice_pk} className="fatura-card">
                  <div className="fatura-topo">
                    <span className="fatura-valor">R$ {formatarMoeda(fatura.invoice_amount_document)}</span>
                    <span className={`fatura-status-badge fatura-status-${status}`}>{ROTULO_STATUS[status]}</span>
                  </div>
                  <p className="fatura-info">Contrato {fatura.contract_number ?? fatura.contract_pk ?? '—'}</p>
                  <p className="fatura-info">Vencimento: {formatarData(fatura.invoice_date_due) ?? '—'}</p>
                  {status === 'paga' && (
                    <p className="fatura-info">Pago em {formatarData(fatura.invoice_date_credit) ?? '—'}</p>
                  )}
                  {emObservacao && (
                    <p className="fatura-observacao-ativa">
                      Em observação{fatura.obs_date_end ? ` até ${formatarData(fatura.obs_date_end)}` : ''}
                    </p>
                  )}
                  {status !== 'paga' && (
                    <div className="fatura-acoes">
                      <button
                        type="button"
                        className="fatura-chip-botao"
                        onClick={() => setFaturaObservando(fatura)}
                      >
                        <MdNoteAdd size={14} /> Adicionar observação
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PullToRefresh>

    {faturaObservando && (
      <ModalObservacao
        clientPk={clientPk}
        contractPk={contractPk ?? faturaObservando.contract_pk ?? 0}
        fatura={faturaObservando}
        onFechar={() => setFaturaObservando(null)}
        onSalvo={() => {
          setFaturaObservando(null)
          toast('Observação registrada com sucesso.', 'sucesso')
          carregar()
        }}
      />
    )}
    </>
  )
}

function ModalObservacao({
  clientPk,
  contractPk,
  fatura,
  onFechar,
  onSalvo,
}: {
  clientPk: number
  contractPk: number
  fatura: FaturaDto
  onFechar: () => void
  onSalvo: () => void
}) {
  const [tipo, setTipo] = useState<'data' | 'periodo'>('data')
  const [data, setData] = useState('')
  const [dias, setDias] = useState('7')
  const [texto, setTexto] = useState('')
  const [salvando, setSalvando] = useState(false)
  const { toast } = useToast()

  async function salvar() {
    if (!fatura.invoice_pk || !contractPk) {
      toast('Fatura sem contrato identificado — não é possível registrar a observação.')
      return
    }
    if (!texto.trim()) {
      toast('Descreva o motivo da observação.')
      return
    }
    if (tipo === 'data' && !data) {
      toast('Informe até quando o pagamento fica em observação.')
      return
    }
    setSalvando(true)
    try {
      await criarObservacaoFatura({
        client_pk: clientPk,
        contract_pk: contractPk,
        invoice_pk: fatura.invoice_pk,
        obs_text: texto.trim(),
        obs_release_date: tipo === 'data' ? `${data} 23:59:59` : undefined,
        obs_period_dias: tipo === 'periodo' ? Number(dias) : undefined,
      })
      onSalvo()
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível registrar a observação.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="financeiro-modal-fundo" onClick={onFechar}>
      <div className="financeiro-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Adicionar observação</h2>
        <p className="financeiro-modal-subtitulo">
          Contrato {fatura.contract_number ?? fatura.contract_pk ?? '—'} — R$ {formatarMoeda(fatura.invoice_amount_document)}
        </p>

        <label>Liberar por</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value as 'data' | 'periodo')}>
          <option value="data">Data</option>
          <option value="periodo">Período (dias)</option>
        </select>

        {tipo === 'data' ? (
          <>
            <label>Liberar até</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </>
        ) : (
          <>
            <label>Período (dias)</label>
            <input type="number" min={1} value={dias} onChange={(e) => setDias(e.target.value)} />
          </>
        )}

        <label>Descrição</label>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex: cliente combinou pagar em 3 dias" rows={3} />

        <div className="financeiro-modal-acoes">
          <button className="botao botao-secundario" onClick={onFechar}>Cancelar</button>
          <button
            className="botao botao-primario"
            style={{ '--botao-cor': CORES.financeiro } as CSSProperties}
            disabled={salvando}
            onClick={salvar}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
