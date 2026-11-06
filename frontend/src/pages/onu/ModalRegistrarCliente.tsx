import { useEffect, useState, type CSSProperties } from 'react'
import { LuCable, LuUser, LuWifi } from 'react-icons/lu'
import {
  ApiError,
  associarClienteOnu,
  buscarClientes,
  buscarCpe,
  type BuscaClienteResultado,
  type CpeComboDto,
  type CpeDto,
  type OnuDto,
} from '../../api/client'
import { useToast } from '../../components/Toast/useToast'
import { CORES } from '../../utils/cores'
import { detectarTipoBusca, formatarDocumento } from '../../utils/formatacao'
import { useFecharComVoltar } from '../../hooks/useFecharComVoltar'

/** Conexão achada pelo login PPPoE no formato da lista de conexões do cliente. */
function conexaoParaCombo(cpe: CpeDto): CpeComboDto {
  return {
    cpe_pk: cpe.pk,
    client_pk: cpe.client_pk,
    contract_pk: cpe.contract_pk,
    contract_number: cpe.contract_number,
    cpe_username: cpe.username,
    client_complete_name: cpe.client_complete_name,
    dp_name: cpe.dp_name,
    dp_pk: cpe.dp_pk,
  }
}

/**
 * Associa uma ONU sem cliente a um cliente: busca por nome, CPF/CNPJ,
 * contrato ou login PPPoE, escolhe qual conexão (PPPoE) dele vincular e
 * confirma. Achado pelo PPPoE, ou cliente com uma só conexão, vai direto
 * para a confirmação.
 */
export default function ModalRegistrarCliente({
  onu,
  onFechar,
  onAssociado,
}: {
  onu: OnuDto
  onFechar: () => void
  onAssociado: (clientPk: number, clientNome: string | undefined) => void
}) {
  // "Voltar" do celular fecha a janela.
  useFecharComVoltar(true, onFechar)
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<BuscaClienteResultado[]>([])
  const [conexoes, setConexoes] = useState<CpeDto[]>([])
  const [buscando, setBuscando] = useState(false)
  const [jaBuscou, setJaBuscou] = useState(false)
  const [selecionado, setSelecionado] = useState<BuscaClienteResultado | null>(null)
  // Depois de escolher o cliente, o técnico ainda escolhe qual PPPoE
  // vincular — o cliente pode ter mais de uma conexão cadastrada, e não
  // deve ser presumido qual delas. Só com uma conexão a escolha é óbvia.
  const [cpeEscolhida, setCpeEscolhida] = useState<CpeComboDto | null>(null)
  // Chegou à confirmação sem passar pela lista de conexões: "Voltar" volta
  // para a busca.
  const [direto, setDireto] = useState(false)
  const [associando, setAssociando] = useState(false)
  const { toast } = useToast()

  const pppoeDaOnu = onu.wancfg_pppoe_username?.trim()

  useEffect(() => {
    const termo = busca.trim()
    if (termo.length < 2) {
      setClientes([])
      setConexoes([])
      setJaBuscou(false)
      setBuscando(false)
      return
    }
    let cancelado = false
    setBuscando(true)
    const temporizador = setTimeout(() => {
      const semEspaco = !/\s/.test(termo)
      Promise.allSettled([
        buscarClientes(detectarTipoBusca(termo)),
        semEspaco ? buscarCpe({ username: termo }) : Promise.resolve({ results: [] as CpeDto[] }),
      ])
        .then(([achadosClientes, achadasConexoes]) => {
          if (cancelado) return
          setClientes(achadosClientes.status === 'fulfilled' ? achadosClientes.value.results : [])
          setConexoes(
            achadasConexoes.status === 'fulfilled'
              ? achadasConexoes.value.results.filter((cpe) => cpe.pk && cpe.client_pk)
              : [],
          )
          setJaBuscou(true)
        })
        .finally(() => {
          if (!cancelado) setBuscando(false)
        })
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
  }, [busca])

  function escolherCliente(resultado: BuscaClienteResultado) {
    setSelecionado(resultado)
    if (resultado.cpes.length === 1) {
      setCpeEscolhida(resultado.cpes[0])
      setDireto(true)
    } else {
      setCpeEscolhida(null)
      setDireto(false)
    }
  }

  function escolherConexao(cpe: CpeDto) {
    setSelecionado({
      client_pk: cpe.client_pk as number,
      cliente: { client_complete_name: cpe.client_complete_name },
      cpes: [conexaoParaCombo(cpe)],
    })
    setCpeEscolhida(conexaoParaCombo(cpe))
    setDireto(true)
  }

  function voltarDaConfirmacao() {
    setCpeEscolhida(null)
    if (direto) setSelecionado(null)
  }

  async function confirmar() {
    // onu.pk (onu_pk) vem 0 para ONU sem cliente vinculado — o caso mais
    // comum de usar este modal — válido aqui, não "faltando": uma ONU
    // recém-instalada tem pk=0 até ser associada a um cliente pela
    // primeira vez.
    if (
      !selecionado ||
      !cpeEscolhida?.cpe_pk ||
      onu.pk == null ||
      !onu.sn ||
      onu.olt_pk == null ||
      onu.slot == null ||
      onu.pon == null ||
      onu.id == null
    ) {
      toast('Dados insuficientes para associar esta ONU.')
      return
    }
    setAssociando(true)
    try {
      await associarClienteOnu(onu.pk, {
        client_pk: selecionado.client_pk,
        cpe_pk: cpeEscolhida.cpe_pk,
        olt_pk: onu.olt_pk,
        slot_id: onu.slot,
        port_id: onu.pon,
        onu_id: onu.id,
        onu_serial: onu.sn,
        frame_id: onu.frame ?? 1,
        wancfg_conntype: onu.wancfg_conntype,
        wan_tpl_pk: onu.wan_tpl_pk,
        wancfg_vlanid: onu.wancfg_vlanid,
        wancfg_user_vlanid: onu.wancfg_user_vlanid,
        wancfg_cos: onu.wancfg_cos,
        wancfg_tcont: onu.wancfg_tcont,
        wancfg_gemport: onu.wancfg_gemport,
        wancfg_svlan: onu.wancfg_svlan,
        wancfg_stpid: onu.wancfg_stpid,
        wancfg_scos: onu.wancfg_scos,
        wancfg_pon_profile: onu.wancfg_pon_profile,
        wancfg_pppoe_svcname: onu.wancfg_pppoe_svcname,
        wancfg_local_ip: onu.wancfg_local_ip,
        auditoria: {
          olt_nome: onu.olt_name,
          cliente_anterior: onu.client_name,
          pppoe_anterior: onu.wancfg_pppoe_username,
        },
      })
      onAssociado(selecionado.client_pk, selecionado.cliente.client_complete_name)
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível associar esta ONU ao cliente.')
    } finally {
      setAssociando(false)
    }
  }

  const passo = !selecionado ? 1 : !cpeEscolhida ? 2 : 3
  const nomeCliente = selecionado?.cliente.client_complete_name ?? `Cliente #${selecionado?.client_pk}`
  const posicao = [onu.slot, onu.pon, onu.id].every((v) => v != null) ? `${onu.slot}/${onu.pon}:${onu.id}` : null

  return (
    <div className="onu-modal-fundo" onClick={onFechar}>
      <div className="onu-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Registrar cliente nesta ONU</h2>
        <div className="registrar-onu-resumo">
          <LuCable size={16} aria-hidden />
          <span className="registrar-onu-serial">{onu.sn ?? '—'}</span>
          {(onu.olt_name || posicao) && (
            <span className="registrar-onu-local">{[onu.olt_name, posicao].filter(Boolean).join(' · ')}</span>
          )}
        </div>
        <ol className="registrar-passos" aria-label={`Passo ${passo} de 3`}>
          {['Cliente', 'Conexão', 'Confirmar'].map((nome, i) => (
            <li key={nome} className={i + 1 === passo ? 'atual' : i + 1 < passo ? 'feito' : undefined}>
              {nome}
            </li>
          ))}
        </ol>

        {passo === 1 && (
          <>
            <input
              enterKeyHint="search"
              type="search"
              className="campo"
              placeholder="Nome, CPF, contrato ou PPPoE"
              aria-label="Buscar cliente por nome, CPF/CNPJ, contrato ou login PPPoE"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
            />
            {pppoeDaOnu && busca.trim() !== pppoeDaOnu && (
              <button type="button" className="registrar-sugestao" onClick={() => setBusca(pppoeDaOnu)}>
                <LuWifi size={16} aria-hidden />
                <span>
                  PPPoE configurado nesta ONU: <strong>{pppoeDaOnu}</strong>
                </span>
              </button>
            )}
            <ul className="onu-modal-lista registrar-lista">
              {buscando && <li className="onu-combobox-vazio">Buscando…</li>}
              {!buscando && jaBuscou && clientes.length === 0 && conexoes.length === 0 && (
                <li className="onu-combobox-vazio">Nada encontrado. Confira o nome, CPF, contrato ou PPPoE.</li>
              )}
              {!buscando &&
                conexoes.map((cpe) => (
                  <li key={`cpe-${cpe.pk}`}>
                    <button type="button" onClick={() => escolherConexao(cpe)}>
                      <LuWifi size={20} aria-hidden />
                      <span className="item-duas-linhas">
                        <strong>{cpe.username}</strong>
                        <small>
                          {[cpe.client_complete_name, cpe.contract_number != null && `Contrato ${cpe.contract_number}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              {!buscando &&
                clientes.map((resultado) => (
                  <li key={resultado.client_pk}>
                    <button type="button" onClick={() => escolherCliente(resultado)}>
                      <LuUser size={20} aria-hidden />
                      <span className="item-duas-linhas">
                        <strong>{resultado.cliente.client_complete_name ?? `Cliente #${resultado.client_pk}`}</strong>
                        <small>
                          {[
                            resultado.cliente.client_doc1 && formatarDocumento(resultado.cliente.client_doc1),
                            resultado.cpes.length === 1 ? '1 conexão' : `${resultado.cpes.length} conexões`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
            <div className="onu-modal-acoes">
              <button className="botao botao-secundario" onClick={onFechar}>Cancelar</button>
            </div>
          </>
        )}

        {passo === 2 && selecionado && (
          <>
            <p className="onu-modal-texto">
              Qual conexão (PPPoE) de <strong>{nomeCliente}</strong> vai usar esta ONU?
            </p>
            {selecionado.cpes.length === 0 ? (
              <p className="onu-modal-texto">Este cliente não tem nenhuma conexão (PPPoE) cadastrada.</p>
            ) : (
              <ul className="onu-modal-lista registrar-lista">
                {selecionado.cpes.map((cpe) => (
                  <li key={cpe.cpe_pk}>
                    <button type="button" onClick={() => setCpeEscolhida(cpe)}>
                      <LuWifi size={20} aria-hidden />
                      <span className="item-duas-linhas">
                        <strong>{cpe.cpe_username ?? `Conexão #${cpe.cpe_pk}`}</strong>
                        <small>
                          {[
                            cpe.contract_number != null && `Contrato ${cpe.contract_number}`,
                            cpe.dp_name && `CTO ${cpe.dp_name}`,
                            pppoeDaOnu && cpe.cpe_username === pppoeDaOnu && 'configurado nesta ONU',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="onu-modal-acoes">
              <button className="botao botao-secundario" onClick={() => setSelecionado(null)}>Voltar</button>
            </div>
          </>
        )}

        {passo === 3 && selecionado && cpeEscolhida && (
          <>
            <dl className="registrar-confirmacao">
              <div>
                <dt>Cliente</dt>
                <dd>{nomeCliente}</dd>
              </div>
              <div>
                <dt>PPPoE</dt>
                <dd>{cpeEscolhida.cpe_username ?? `Conexão #${cpeEscolhida.cpe_pk}`}</dd>
              </div>
              {cpeEscolhida.contract_number != null && (
                <div>
                  <dt>Contrato</dt>
                  <dd>{cpeEscolhida.contract_number}</dd>
                </div>
              )}
              {cpeEscolhida.dp_name && (
                <div>
                  <dt>CTO</dt>
                  <dd>{cpeEscolhida.dp_name}</dd>
                </div>
              )}
            </dl>
            {pppoeDaOnu && cpeEscolhida.cpe_username && cpeEscolhida.cpe_username !== pppoeDaOnu && (
              <p className="registrar-aviso">
                A ONU está configurada com o PPPoE <strong>{pppoeDaOnu}</strong>, diferente do escolhido.
              </p>
            )}
            <div className="onu-modal-acoes">
              <button className="botao botao-secundario" onClick={voltarDaConfirmacao} disabled={associando}>
                Voltar
              </button>
              <button
                aria-busy={associando}
                className="botao botao-primario"
                style={{ '--botao-cor': CORES.onu } as CSSProperties}
                disabled={associando}
                onClick={confirmar}
              >
                {associando ? 'Associando…' : 'Associar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
