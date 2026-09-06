import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MdContentCopy, MdRefresh, MdRouter, MdSearch, MdVisibility, MdVisibilityOff } from 'react-icons/md'
import { ApiError, atualizarInfoOnu, buscarOnu, type OnuDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import VoltarInicio from '../components/VoltarInicio'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import './OnuStatus.css'

type NivelSinal = 'boa' | 'alerta' | 'critica' | 'desconhecida'

/**
 * Faixas de sinal óptico (dBm) — confirmadas contra um script de
 * monitoramento (bot de Telegram) já em uso interno na empresa, que usa
 * exatamente esses cortes pra classificar RX de ONU e de OLT (são faixas
 * diferentes uma da outra). Não é uma norma GPON genérica — é o critério
 * já calibrado e adotado por esta operação.
 */
function nivelSinalOnu(rx: number | undefined): NivelSinal {
  if (rx == null) return 'desconhecida'
  if (rx >= -22) return 'boa'
  if (rx >= -24) return 'alerta'
  return 'critica'
}

function nivelSinalOlt(rx: number | undefined): NivelSinal {
  if (rx == null) return 'desconhecida'
  if (rx >= -25) return 'boa'
  if (rx >= -27) return 'alerta'
  return 'critica'
}

const TEXTO_SINAL: Record<NivelSinal, string> = {
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
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [serialBusca, setSerialBusca] = useState('')

  useEffect(() => {
    if (!cpePkParam) {
      setCarregando(false)
      return
    }
    carregar(() => buscarOnu({ cpe_pk: Number(cpePkParam) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpePkParam])

  async function carregar(chamada: () => ReturnType<typeof buscarOnu>) {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await chamada()
      setOnu(resposta.results[0] ?? null)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar o status da ONU.')
    } finally {
      setCarregando(false)
    }
  }

  function buscarPorSerialAtual() {
    const serial = serialBusca.trim()
    if (!serial) return
    carregar(() => buscarOnu({ serial }))
  }

  function aoBuscarSerial(evento: FormEvent) {
    evento.preventDefault()
    buscarPorSerialAtual()
  }

  function tentarNovamente() {
    if (cpePkParam) carregar(() => buscarOnu({ cpe_pk: Number(cpePkParam) }))
    else buscarPorSerialAtual()
  }

  async function atualizarAgora() {
    if (!onu?.pk || onu.olt_pk == null || !onu.sn || onu.slot == null || onu.pon == null || onu.id == null) {
      toast('Dados insuficientes pra atualizar esta ONU.')
      return
    }
    setAtualizando(true)
    // Reconecta a OLT antes de reler (força ela a recarregar os dados) —
    // demora de propósito (~45s), ver backend/app/routers/onu.py.
    toast('Reconectando a OLT e aguardando atualizar — isso leva cerca de 1 minuto.', 'info')
    try {
      await atualizarInfoOnu(onu.pk, {
        olt_pk: onu.olt_pk,
        onu_serial: onu.sn,
        slot_id: onu.slot,
        port_id: onu.pon,
        onu_id: onu.id,
        frame_id: onu.frame ?? 1,
      })
      if (cpePkParam) await carregar(() => buscarOnu({ cpe_pk: Number(cpePkParam) }))
      else if (onu.sn) await carregar(() => buscarOnu({ serial: onu.sn }))
      toast('ONU atualizada.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível atualizar a ONU.')
    } finally {
      setAtualizando(false)
    }
  }

  async function copiar(valor: string | undefined, rotulo: string) {
    if (!valor) return
    try {
      await navigator.clipboard.writeText(valor)
      toast(`${rotulo} copiado.`, 'sucesso')
    } catch {
      toast('Não foi possível copiar.')
    }
  }

  const statusOnu = nivelSinalOnu(onu?.omddm_rx_power)
  const statusOlt = nivelSinalOlt(onu?.olt_omddm_rx_power)
  const semSelecao = !cpePkParam && !onu && !carregando

  return (
    <div className="onu-tela tela-entrada">
      <VoltarInicio />
      <CabecalhoTela icone={MdRouter} cor={CORES.onu} titulo="ONU" subtitulo="Sinal óptico e status do equipamento." />

      {semSelecao && (
        <>
          <form className="onu-card onu-busca" onSubmit={aoBuscarSerial}>
            <label htmlFor="onu-serial-input">Serial da ONU</label>
            <div className="onu-busca-campo">
              <input
                id="onu-serial-input"
                type="text"
                placeholder="Ex: ZTEGCEC2A8EF"
                value={serialBusca}
                onChange={(e) => setSerialBusca(e.target.value)}
                autoCapitalize="characters"
              />
              <button type="submit" aria-label="Buscar">
                <MdSearch size={20} />
              </button>
            </div>
          </form>
          {!erro && (
            <EstadoVazio
              icone={MdRouter}
              titulo="Busque pelo serial da ONU"
              subtitulo="Ou acesse esta tela a partir dos detalhes de um cliente."
            />
          )}
        </>
      )}

      {carregando && (
        <div className="onu-card">
          <Skeleton width="50%" height={16} />
          <Skeleton width="70%" height={13} />
        </div>
      )}

      {!carregando && erro && (
        <div className="onu-status-erro">
          <p>{erro}</p>
          <button onClick={tentarNovamente}>Tentar novamente</button>
        </div>
      )}

      {cpePkParam && !carregando && !erro && !onu && (
        <EstadoVazio icone={MdRouter} titulo="Nenhuma ONU encontrada para esta conexão." />
      )}

      {!carregando && !erro && onu && (
        <>
          <div className={`onu-card onu-sinal onu-sinal-${statusOnu}`}>
            <span className="onu-sinal-titulo">ONU — {TEXTO_SINAL[statusOnu]}</span>
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

          {(onu.olt_omddm_rx_power != null || onu.olt_omddm_tx_power != null) && (
            <div className={`onu-card onu-sinal onu-sinal-${statusOlt}`}>
              <span className="onu-sinal-titulo">OLT — {TEXTO_SINAL[statusOlt]}</span>
              <div className="onu-sinal-grid">
                <div>
                  <span>RX</span>
                  <strong>{onu.olt_omddm_rx_power != null ? `${onu.olt_omddm_rx_power} dBm` : '—'}</strong>
                </div>
                <div>
                  <span>TX</span>
                  <strong>{onu.olt_omddm_tx_power != null ? `${onu.olt_omddm_tx_power} dBm` : '—'}</strong>
                </div>
              </div>
            </div>
          )}

          {onu.wancfg_pppoe_username && (
            <div className="onu-card">
              <h2>Acesso PPPoE (ONU)</h2>
              <div className="onu-campo">
                <span>Usuário</span>
                <div className="onu-campo-valor">
                  <strong>{onu.wancfg_pppoe_username}</strong>
                  <button onClick={() => copiar(onu.wancfg_pppoe_username, 'Usuário')} aria-label="Copiar usuário">
                    <MdContentCopy size={16} />
                  </button>
                </div>
              </div>
              {onu.wancfg_pppoe_passwd && (
                <div className="onu-campo">
                  <span>Senha</span>
                  <div className="onu-campo-valor">
                    <strong>{mostrarSenha ? onu.wancfg_pppoe_passwd : '••••••••'}</strong>
                    <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                      {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                    </button>
                    <button onClick={() => copiar(onu.wancfg_pppoe_passwd, 'Senha')} aria-label="Copiar senha">
                      <MdContentCopy size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="onu-card">
            <div className="onu-linha">
              <span>Cliente</span>
              <strong>{onu.client_name ?? '—'}</strong>
            </div>
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
              <span>IP</span>
              <strong>{onu.cpe_v4_ip_last ?? '—'}</strong>
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
            <MdRefresh size={18} className={atualizando ? 'onu-girando' : ''} /> {atualizando ? 'Reconectando OLT… (~1 min)' : 'Atualizar agora'}
          </button>
        </>
      )}
    </div>
  )
}
