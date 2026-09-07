import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MdContentCopy, MdPeopleAlt, MdRefresh, MdRouter, MdSearch, MdVisibility, MdVisibilityOff, MdWifi } from 'react-icons/md'
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
  // Combobox de busca por serial — confirmado ao vivo (aba de rede da
  // própria tela "ONU - Registrado" do painel) que /fiber_ctl/onu/list
  // no formato "wizard" (search_term=onu_serial) filtra por PREFIXO, não
  // só match exato: digitar "ZTEG" já filtrou de 2550 pra 764 resultados,
  // todos começando com esse prefixo. Mesmo endpoint que buscarOnu({serial})
  // já chama, então dá pra usar direto aqui, sem precisar de outro
  // endpoint (diferente do combobox de usuário PPPoE, ver comentário
  // abaixo).
  const [serialBusca, setSerialBusca] = useState('')
  const [resultadosSerial, setResultadosSerial] = useState<OnuDto[]>([])
  const [buscandoSerial, setBuscandoSerial] = useState(false)
  const [listaSerialAberta, setListaSerialAberta] = useState(false)
  // Busca por usuário PPPoE — mesmo combobox com filtro parcial da tela
  // de Conexão: a busca em si é feita em /cpe/busca (que suporta ILIKE
  // parcial), não em /onu/busca (que só acha por usuário exato); ao
  // clicar num resultado, aí sim busca a ONU pelo usuário exato dele.
  const [usuarioBusca, setUsuarioBusca] = useState('')
  const [resultadosUsuario, setResultadosUsuario] = useState<CpeDto[]>([])
  const [buscandoUsuario, setBuscandoUsuario] = useState(false)
  const [listaUsuarioAberta, setListaUsuarioAberta] = useState(false)

  useEffect(() => {
    if (!temParametroInicial) {
      setCarregando(false)
      return
    }
    carregar(buscarInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpePkParam, usernameParam, serialParam])

  useEffect(() => {
    if (temParametroInicial || serialBusca.trim().length < 2) {
      setResultadosSerial([])
      return
    }
    let cancelado = false
    setBuscandoSerial(true)
    const temporizador = setTimeout(() => {
      buscarOnu({ serial: serialBusca.trim() })
        .then((resposta) => {
          if (!cancelado) setResultadosSerial(resposta.results)
        })
        .catch(() => {
          if (!cancelado) setResultadosSerial([])
        })
        .finally(() => {
          if (!cancelado) setBuscandoSerial(false)
        })
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [serialBusca, temParametroInicial])

  useEffect(() => {
    if (temParametroInicial || usuarioBusca.trim().length < 2) {
      setResultadosUsuario([])
      return
    }
    let cancelado = false
    setBuscandoUsuario(true)
    const temporizador = setTimeout(() => {
      buscarCpe({ username: usuarioBusca.trim() })
        .then((resposta) => {
          if (!cancelado) setResultadosUsuario(resposta.results)
        })
        .catch(() => {
          if (!cancelado) setResultadosUsuario([])
        })
        .finally(() => {
          if (!cancelado) setBuscandoUsuario(false)
        })
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [usuarioBusca, temParametroInicial])

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
    if (temParametroInicial) carregar(buscarInicial)
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

      {semSelecao && (
        <>
          <form className="onu-card onu-busca onu-combobox" onSubmit={aoBuscarSerial}>
            <label htmlFor="onu-serial-input">Serial da ONU</label>
            <div className="onu-busca-campo">
              <input
                id="onu-serial-input"
                type="text"
                placeholder="Ex: ZTEGCEC2A8EF"
                value={serialBusca}
                onChange={(e) => setSerialBusca(e.target.value)}
                onFocus={() => setListaSerialAberta(true)}
                onBlur={() => setTimeout(() => setListaSerialAberta(false), 150)}
                autoCapitalize="characters"
              />
              <button type="submit" aria-label="Buscar">
                <MdSearch size={20} />
              </button>
            </div>
            {listaSerialAberta && serialBusca.trim().length >= 2 && (
              <ul className="onu-combobox-lista">
                {buscandoSerial && <li className="onu-combobox-vazio">Buscando…</li>}
                {!buscandoSerial && resultadosSerial.length === 0 && (
                  <li className="onu-combobox-vazio">Nenhuma ONU encontrada.</li>
                )}
                {!buscandoSerial &&
                  resultadosSerial.map((resultado) => (
                    <li key={resultado.pk}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setListaSerialAberta(false)
                          if (resultado.sn) setParams({ serial: resultado.sn })
                        }}
                      >
                        <strong>{resultado.sn}</strong>
                        {resultado.client_name && ` — ${resultado.client_name}`}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </form>

          <div className="onu-card onu-busca onu-combobox onu-busca-usuario">
            <label htmlFor="onu-usuario-input">Usuário PPPoE</label>
            <div className="onu-busca-campo">
              <input
                id="onu-usuario-input"
                type="text"
                placeholder="Digite o usuário"
                value={usuarioBusca}
                onChange={(e) => setUsuarioBusca(e.target.value)}
                onFocus={() => setListaUsuarioAberta(true)}
                onBlur={() => setTimeout(() => setListaUsuarioAberta(false), 150)}
              />
            </div>
            {listaUsuarioAberta && usuarioBusca.trim().length >= 2 && (
              <ul className="onu-combobox-lista">
                {buscandoUsuario && <li className="onu-combobox-vazio">Buscando…</li>}
                {!buscandoUsuario && resultadosUsuario.length === 0 && (
                  <li className="onu-combobox-vazio">Nenhum usuário encontrado.</li>
                )}
                {!buscandoUsuario &&
                  resultadosUsuario.map((resultado) => (
                    <li key={resultado.pk}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setListaUsuarioAberta(false)
                          if (resultado.username) setParams({ username: resultado.username })
                        }}
                      >
                        <strong>{resultado.username}</strong>
                        {resultado.client_complete_name && ` — ${resultado.client_complete_name}`}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {!erro && (
            <EstadoVazio
              icone={MdRouter}
              titulo="Busque pelo serial da ONU ou pelo usuário PPPoE"
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
