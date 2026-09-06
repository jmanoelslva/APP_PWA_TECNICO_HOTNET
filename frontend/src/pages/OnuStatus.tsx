import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MdRefresh, MdRouter } from 'react-icons/md'
import { ApiError, atualizarInfoOnu, buscarOnu, type OnuDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import VoltarInicio from '../components/VoltarInicio'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import './OnuStatus.css'

/**
 * Faixas de sinal óptico (dBm) pra GPON — heurística comum de mercado,
 * não confirmada contra a documentação oficial do Controllr: RX entre
 * -8 e -25 dBm costuma indicar sinal normal, entre -25 e -27 é alerta,
 * abaixo de -27 (ou acima de -8, sinal forte demais) é crítico.
 */
function corDoSinal(rx: number | undefined): 'boa' | 'alerta' | 'critica' | 'desconhecida' {
  if (rx == null) return 'desconhecida'
  if (rx <= -8 && rx >= -25) return 'boa'
  if (rx < -25 && rx >= -27) return 'alerta'
  return 'critica'
}

const TEXTO_SINAL: Record<ReturnType<typeof corDoSinal>, string> = {
  boa: 'Sinal normal',
  alerta: 'Sinal fraco — atenção',
  critica: 'Sinal crítico',
  desconhecida: 'Sinal não informado',
}

export default function OnuStatus() {
  const [params] = useSearchParams()
  const cpePkParam = params.get('cpe_pk')
  const { toast } = useToast()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [onu, setOnu] = useState<OnuDto | null>(null)
  const [atualizando, setAtualizando] = useState(false)

  useEffect(() => {
    if (!cpePkParam) {
      setCarregando(false)
      return
    }
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpePkParam])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await buscarOnu({ cpe_pk: Number(cpePkParam) })
      setOnu(resposta.results[0] ?? null)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar o status da ONU.')
    } finally {
      setCarregando(false)
    }
  }

  async function atualizarAgora() {
    if (!onu?.pk || onu.olt_pk == null || !onu.sn || onu.slot == null || onu.pon == null || onu.id == null) {
      toast('Dados insuficientes pra atualizar esta ONU.')
      return
    }
    setAtualizando(true)
    try {
      await atualizarInfoOnu(onu.pk, {
        olt_pk: onu.olt_pk,
        onu_serial: onu.sn,
        slot_id: onu.slot,
        port_id: onu.pon,
        onu_id: onu.id,
        frame_id: onu.frame ?? 1,
      })
      await carregar()
      toast('ONU atualizada.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar a ONU.')
    } finally {
      setAtualizando(false)
    }
  }

  const status = corDoSinal(onu?.omddm_rx_power)

  return (
    <div className="onu-tela tela-entrada">
      <VoltarInicio />
      <CabecalhoTela icone={MdRouter} cor={CORES.onu} titulo="ONU" subtitulo="Sinal óptico e status do equipamento." />

      {!cpePkParam && (
        <EstadoVazio icone={MdRouter} titulo="Nenhuma ONU selecionada" subtitulo="Acesse esta tela a partir dos detalhes de um cliente." />
      )}

      {cpePkParam && carregando && (
        <div className="onu-card">
          <Skeleton width="50%" height={16} />
          <Skeleton width="70%" height={13} />
        </div>
      )}

      {cpePkParam && !carregando && erro && (
        <div className="onu-status-erro">
          <p>{erro}</p>
          <button onClick={carregar}>Tentar novamente</button>
        </div>
      )}

      {cpePkParam && !carregando && !erro && !onu && (
        <EstadoVazio icone={MdRouter} titulo="Nenhuma ONU encontrada para esta conexão." />
      )}

      {cpePkParam && !carregando && !erro && onu && (
        <>
          <div className={`onu-card onu-sinal onu-sinal-${status}`}>
            <span className="onu-sinal-titulo">{TEXTO_SINAL[status]}</span>
            <div className="onu-sinal-grid">
              <div>
                <span>RX</span>
                <strong>{onu.omddm_rx_power != null ? `${onu.omddm_rx_power} dBm` : '—'}</strong>
              </div>
              <div>
                <span>TX</span>
                <strong>{onu.omddm_tx_power != null ? `${onu.omddm_tx_power} dBm` : '—'}</strong>
              </div>
            </div>
          </div>

          <div className="onu-card">
            <div className="onu-linha">
              <span>Serial</span>
              <strong>{onu.sn ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Modelo</span>
              <strong>{onu.model ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Fabricante</span>
              <strong>{onu.vendor ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Estado</span>
              <strong>{onu.state ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Distância</span>
              <strong>{onu.distance != null ? `${onu.distance} m` : '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Temperatura</span>
              <strong>{onu.omddm_temperature != null ? `${onu.omddm_temperature} °C` : '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>OLT</span>
              <strong>{onu.olt_name ?? '—'}</strong>
            </div>
            <div className="onu-linha">
              <span>Splitter (DP)</span>
              <strong>{onu.dp_name ?? '—'}</strong>
            </div>
          </div>

          <button className="onu-btn-atualizar" onClick={atualizarAgora} disabled={atualizando}>
            <MdRefresh size={18} className={atualizando ? 'onu-girando' : ''} /> {atualizando ? 'Atualizando…' : 'Atualizar agora'}
          </button>
        </>
      )}
    </div>
  )
}
