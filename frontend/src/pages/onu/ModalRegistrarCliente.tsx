import { useEffect, useState, type CSSProperties } from 'react'
import {
  ApiError,
  associarClienteOnu,
  buscarClientes,
  type BuscaClienteResultado,
  type CpeComboDto,
  type OnuDto,
} from '../../api/client'
import { useToast } from '../../components/Toast/useToast'
import { CORES } from '../../utils/cores'

/**
 * Associa uma ONU sem cliente a um cliente: busca pelo nome, escolhe qual
 * conexão (PPPoE) dele vincular e confirma.
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
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<BuscaClienteResultado[]>([])
  const [buscando, setBuscando] = useState(false)
  const [selecionado, setSelecionado] = useState<BuscaClienteResultado | null>(null)
  // Depois de escolher o cliente, o técnico ainda escolhe qual PPPoE
  // vincular — o cliente pode ter mais de uma conexão cadastrada, e não
  // deve ser presumido automaticamente qual delas.
  const [cpeEscolhida, setCpeEscolhida] = useState<CpeComboDto | null>(null)
  const [associando, setAssociando] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const nome = busca.trim()
    if (nome.length < 2) {
      setResultados([])
      return
    }
    let cancelado = false
    setBuscando(true)
    const temporizador = setTimeout(() => {
      buscarClientes({ nome })
        .then((resposta) => {
          if (!cancelado) setResultados(resposta.results)
        })
        .catch(() => {
          if (!cancelado) setResultados([])
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

  return (
    <div className="onu-modal-fundo" onClick={onFechar}>
      <div className="onu-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Registrar cliente nesta ONU</h2>
        {!selecionado && (
          <>
            <p className="onu-modal-texto">
              Busque o cliente pelo nome. Depois de escolher, será possível selecionar qual conexão (PPPoE) dele
              vincular a esta ONU.
            </p>
            <input
              type="text"
              className="onu-modal-input"
              placeholder="Nome do cliente"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
            />
            <ul className="onu-modal-lista">
              {buscando && <li className="onu-combobox-vazio">Buscando…</li>}
              {!buscando && busca.trim().length >= 2 && resultados.length === 0 && (
                <li className="onu-combobox-vazio">Nenhum cliente encontrado.</li>
              )}
              {!buscando &&
                resultados.map((resultado) => (
                  <li key={resultado.client_pk}>
                    <button type="button" onClick={() => setSelecionado(resultado)}>
                      {resultado.cliente.client_complete_name ?? `Cliente #${resultado.client_pk}`}
                    </button>
                  </li>
                ))}
            </ul>
            <div className="onu-modal-acoes">
              <button className="botao botao-secundario" onClick={onFechar}>Cancelar</button>
            </div>
          </>
        )}

        {selecionado && !cpeEscolhida && (
          <>
            <p className="onu-modal-texto">
              Qual conexão (usuário PPPoE) de <strong>{selecionado.cliente.client_complete_name}</strong> deseja
              vincular a esta ONU?
            </p>
            {selecionado.cpes.length === 0 ? (
              <p className="onu-modal-texto">Este cliente não tem nenhuma conexão (CPE) cadastrada.</p>
            ) : (
              <ul className="onu-modal-lista">
                {selecionado.cpes.map((cpe) => (
                  <li key={cpe.cpe_pk}>
                    <button type="button" onClick={() => setCpeEscolhida(cpe)}>
                      <strong>{cpe.cpe_username ?? `CPE #${cpe.cpe_pk}`}</strong>
                      {cpe.contract_number != null && ` — Contrato ${cpe.contract_number}`}
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

        {selecionado && cpeEscolhida && (
          <>
            <p className="onu-modal-texto">
              Associar esta ONU a <strong>{selecionado.cliente.client_complete_name}</strong>, usando o PPPoE{' '}
              <strong>{cpeEscolhida.cpe_username}</strong>?
            </p>
            <div className="onu-modal-acoes">
              <button className="botao botao-secundario" onClick={() => setCpeEscolhida(null)} disabled={associando}>
                Voltar
              </button>
              <button
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
