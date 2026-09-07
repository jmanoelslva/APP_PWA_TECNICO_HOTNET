import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MdContentCopy, MdPeopleAlt, MdRefresh, MdRouter, MdVisibility, MdVisibilityOff, MdWifi } from 'react-icons/md'
import { ApiError, atualizarInfoOnu, buscarCpe, buscarOnu, type CpeDto, type OnuDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import { nivelSinalOnu, type NivelSinal } from '../utils/formatacao'
import './OnuStatus.css'

/**
 * Faixa de sinal óptico (dBm) da OLT — mesma origem/critério de
 * nivelSinalOnu (utils/formatacao.ts), mas com cortes diferentes (não é
 * a mesma faixa da ONU, ver comentário lá).
 */
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

type ResultadoCombo = { tipo: 'serial'; item: OnuDto } | { tipo: 'usuario'; item: CpeDto }

export default function OnuStatus() {
  const [params, setParams] = useSearchParams()
  const cpePkParam = params.get('cpe_pk')
  const usernameParam = params.get('username')
  const serialParam = params.get('serial')
  // Usuário PPPoE do CPE é o jeito confiável de achar a ONU de um
  // cliente (ver backend/app/routers/onu.py) — cpe_pk sozinho é
  // ambíguo em /fiber_ctl/onu/list e já causou mostrar a ONU de outro
  // cliente. Prioriza username quando os dois vierem informados.
  const temParametroInicial = !!usernameParam || !!serialParam || !!cpePkParam
  const { toast } = useToast()

  function buscarInicial() {
    if (usernameParam) return buscarOnu({ username: usernameParam })
    if (serialParam) return buscarOnu({ serial: serialParam })
    return buscarOnu({ cpe_pk: Number(cpePkParam) })
  }

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [onu, setOnu] = useState<OnuDto | null>(null)
  const [atualizando, setAtualizando] = useState(false)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  // Combobox único — busca por serial (/fiber_ctl/onu/list no formato
  // "wizard", confirmado ao vivo que filtra por PREFIXO: "ZTEG" já
  // filtrou de 2550 pra 764 resultados) e por usuário PPPoE (/cpe/busca,
  // que suporta ILIKE parcial) em paralelo, e mistura os dois num só
  // dropdown — o técnico não precisa saber de antemão se tem o serial ou
  // o usuário em mãos. Selecionar um item de serial já é a própria ONU;
  // selecionar um item de usuário busca a ONU pelo usuário exato dele.
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ResultadoCombo[]>([])
  const [buscandoCombo, setBuscandoCombo] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)

  useEffect(() => {
    if (!temParametroInicial) {
      setCarregando(false)
      return
    }
    carregar(buscarInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpePkParam, usernameParam, serialParam])

  useEffect(() => {
    const valor = busca.trim()
    if (valor.length < 2) {
      setResultados([])
      return
    }
    let cancelado = false
    setBuscandoCombo(true)
    const temporizador = setTimeout(() => {
      Promise.all([
        buscarOnu({ serial: valor }).catch(() => ({ results: [] as OnuDto[] })),
        buscarCpe({ username: valor }).catch(() => ({ results: [] as CpeDto[] })),
      ])
        .then(([respostaOnu, respostaCpe]) => {
          if (cancelado) return
          setResultados([
            ...respostaOnu.results.map((item): ResultadoCombo => ({ tipo: 'serial', item })),
            ...respostaCpe.results.map((item): ResultadoCombo => ({ tipo: 'usuario', item })),
          ])
        })
        .finally(() => {
          if (!cancelado) setBuscandoCombo(false)
        })
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [busca])

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

  function selecionar(resultado: ResultadoCombo) {
    setListaAberta(false)
    setBusca('')
    if (resultado.tipo === 'serial' && resultado.item.sn) setParams({ serial: resultado.item.sn })
    else if (resultado.tipo === 'usuario' && resultado.item.username) setParams({ username: resultado.item.username })
  }

  function aoSubmeterBusca(evento: FormEvent) {
    evento.preventDefault()
    if (resultados.length === 1) selecionar(resultados[0])
  }

  function tentarNovamente() {
    carregar(buscarInicial)
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
      if (temParametroInicial) await carregar(buscarInicial)
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
  const semSelecao = !temParametroInicial && !onu && !carregando

  return (
    <div className="onu-tela tela-entrada">
      <CabecalhoTela icone={MdRouter} cor={CORES.onu} titulo="ONU" subtitulo="Sinal óptico e status do equipamento." />

      <form className="onu-card onu-busca onu-combobox" onSubmit={aoSubmeterBusca}>
        <label htmlFor="onu-busca-input">Serial da ONU ou usuário PPPoE</label>
        <div className="onu-busca-campo">
          <input
            id="onu-busca-input"
            type="text"
            placeholder="Digite o serial ou o usuário"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setListaAberta(true)
            }}
            onFocus={() => setListaAberta(true)}
            onBlur={() => setTimeout(() => setListaAberta(false), 150)}
          />
        </div>
        {listaAberta && busca.trim().length >= 2 && (
          <ul className="onu-combobox-lista">
            {buscandoCombo && <li className="onu-combobox-vazio">Buscando…</li>}
            {!buscandoCombo && resultados.length === 0 && <li className="onu-combobox-vazio">Nada encontrado.</li>}
            {!buscandoCombo &&
              resultados.map((resultado) => (
                <li key={`${resultado.tipo}-${resultado.item.pk}`}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selecionar(resultado)}>
                    {resultado.tipo === 'serial' ? (
                      <>
                        <strong>{resultado.item.sn}</strong>
                        {resultado.item.client_name && ` — ${resultado.item.client_name}`}
                      </>
                    ) : (
                      <>
                        <strong>{resultado.item.username}</strong>
                        {resultado.item.client_complete_name && ` — ${resultado.item.client_complete_name}`}
                      </>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </form>

      {semSelecao && !erro && (
        <EstadoVazio
          icone={MdRouter}
          titulo="Busque pelo serial da ONU ou pelo usuário PPPoE"
          subtitulo="Ou acesse esta tela a partir dos detalhes de um cliente."
        />
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

      {temParametroInicial && !carregando && !erro && !onu && (
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
                  <Link
                    to={`/conexao?username=${encodeURIComponent(onu.wancfg_pppoe_username)}`}
                    className="onu-btn-link"
                    aria-label="Ver conexão deste usuário"
                    viewTransition
                  >
                    <MdWifi size={16} />
                  </Link>
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

          {onu.wificfg_name && (
            <div className="onu-card">
              <h2>Wi-Fi</h2>
              <div className="onu-campo">
                <span>Rede (SSID)</span>
                <div className="onu-campo-valor">
                  <strong>{onu.wificfg_name}</strong>
                  <button onClick={() => copiar(onu.wificfg_name, 'Nome da rede')} aria-label="Copiar nome da rede">
                    <MdContentCopy size={16} />
                  </button>
                </div>
              </div>
              {onu.wificfg_password && (
                <div className="onu-campo">
                  <span>Senha</span>
                  <div className="onu-campo-valor">
                    <strong>{mostrarSenha ? onu.wificfg_password : '••••••••'}</strong>
                    <button onClick={() => setMostrarSenha((v) => !v)} aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}>
                      {mostrarSenha ? <MdVisibilityOff size={16} /> : <MdVisibility size={16} />}
                    </button>
                    <button onClick={() => copiar(onu.wificfg_password, 'Senha da rede')} aria-label="Copiar senha da rede">
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
              {onu.client_pk ? (
                <Link to={`/clientes/${onu.client_pk}`} className="onu-link" viewTransition>
                  <MdPeopleAlt size={14} /> {onu.client_name ?? '—'}
                </Link>
              ) : (
                <strong>{onu.client_name ?? '—'}</strong>
              )}
            </div>
            {(onu.contract_number ?? onu.contract_pk) != null && (
              <div className="onu-linha">
                <span>Contrato</span>
                {onu.contract_pk ? (
                  <Link to={`/conexao?contract_pk=${onu.contract_pk}`} className="onu-link" viewTransition>
                    <MdWifi size={14} /> {onu.contract_number ?? onu.contract_pk}
                  </Link>
                ) : (
                  <strong>{onu.contract_number}</strong>
                )}
              </div>
            )}
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
              {/* onu_distance vem em KM, não metros (confirmado: exemplo
                  "0.931" na doc oficial só faz sentido pra alcance de
                  GPON como km — 0.931 m seria o cliente colado na OLT). */}
              <span>Distância</span>
              <strong>{onu.distance != null ? `${onu.distance} km` : '—'}</strong>
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
            <div className="onu-linha">
              <span>Porta da CTO</span>
              <strong>{onu.cpe_dp_port ?? '—'}</strong>
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
