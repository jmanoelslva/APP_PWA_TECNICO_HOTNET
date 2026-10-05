import { useEffect, useState, type CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MdCable, MdDeleteForever, MdPowerSettingsNew, MdRefresh } from 'react-icons/md'
import { ApiError, atualizarInfoOnu, buscarOnu, reiniciarOnu, removerOnu, renomearOnu, type OnuDto } from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import EstadoVazio from '../components/EstadoVazio'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import BuscaOnu from './onu/BuscaOnu'
import CardDetalhesOnu from './onu/CardDetalhesOnu'
import CardsCredenciais from './onu/CardsCredenciais'
import CardsSinal from './onu/CardsSinal'
import { formatarTempoDesdeColeta } from './onu/formato'
import { ModalConfirmarAcao, ModalRenomear } from './onu/ModaisAcaoOnu'
import ModalRegistrarCliente from './onu/ModalRegistrarCliente'
import './OnuStatus.css'

/**
 * Sinal óptico e status da ONU, e as ações nela (atualizar, reiniciar,
 * remover, renomear, registrar cliente). Esta página carrega a ONU e faz as
 * ações; os cartões e modais ficam em pages/onu/.
 */
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
  // Reiniciar/Remover — endpoints não documentados na doc oficial.
  // Confirmação em 2 passos sempre, já que os dois afetam a conexão do
  // cliente na hora.
  const [confirmandoAcao, setConfirmandoAcao] = useState<'reiniciar' | 'remover' | null>(null)
  const [executandoAcao, setExecutandoAcao] = useState(false)
  const [registrandoCliente, setRegistrandoCliente] = useState(false)
  // Nome atual ao abrir o "Renomear"; null = modal fechado.
  const [renomeando, setRenomeando] = useState<string | null>(null)
  const [salvandoNome, setSalvandoNome] = useState(false)
  // Antes de reiniciar/remover/associar/renomear, releem a ONU do zero —
  // mesmo efeito que o técnico buscar de novo manualmente (contornava um
  // bug observado em produção: os identificadores olt_pk/slot/port/onu_id
  // às vezes vêm incompletos na primeira leitura da ONU, e uma segunda
  // busca sempre trazia os dados corretos).
  const [atualizandoAntesDaAcao, setAtualizandoAntesDaAcao] = useState(false)

  useEffect(() => {
    if (!temParametroInicial) {
      setCarregando(false)
      return
    }
    carregar(buscarInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpePkParam, usernameParam, serialParam])

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

  async function atualizarAgora() {
    // onu.pk (onu_pk) vem 0 pra ONU registrada na OLT mas ainda sem
    // cliente vinculado — 0 é um pk válido aqui, não "faltando". Usar
    // "!onu.pk" (falsy) tratava esse caso real como dado insuficiente.
    if (!onu || onu.pk == null || onu.olt_pk == null || !onu.sn || onu.slot == null || onu.pon == null || onu.id == null) {
      toast('Dados insuficientes para atualizar esta ONU.')
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

  function dadosOspo() {
    if (!onu || onu.olt_pk == null || onu.slot == null || onu.pon == null || onu.id == null) return null
    return {
      olt_pk: onu.olt_pk,
      slot_id: onu.slot,
      port_id: onu.pon,
      onu_id: onu.id,
      frame_id: onu.frame ?? 1,
      olt_nome: onu.olt_name,
      onu_serial: onu.sn,
    }
  }

  async function recarregarOnuAtual(): Promise<OnuDto | null> {
    if (temParametroInicial) {
      const resposta = await buscarInicial()
      const atualizada = resposta.results[0] ?? null
      setOnu(atualizada)
      return atualizada
    }
    if (onu?.sn) {
      const resposta = await buscarOnu({ serial: onu.sn })
      const atualizada = resposta.results[0] ?? null
      setOnu(atualizada)
      return atualizada
    }
    return onu
  }

  /** Relê a ONU e, se veio, abre a ação; senão avisa. */
  async function abrirDepoisDeReler(abrir: (atualizada: OnuDto) => void) {
    setAtualizandoAntesDaAcao(true)
    try {
      const atualizada = await recarregarOnuAtual()
      if (!atualizada) {
        toast('Não foi possível atualizar os dados da ONU.')
        return
      }
      abrir(atualizada)
    } catch {
      toast('Não foi possível atualizar os dados da ONU.')
    } finally {
      setAtualizandoAntesDaAcao(false)
    }
  }

  async function confirmarRenomear(nome: string) {
    const ospo = dadosOspo()
    if (!onu || onu.pk == null || !ospo || !nome) {
      toast('Informe um nome válido para a ONU.')
      return
    }
    setSalvandoNome(true)
    try {
      await renomearOnu(onu.pk, { ...ospo, onu_name: nome, nome_anterior: onu.name })
      setOnu((atual) => (atual ? { ...atual, name: nome } : atual))
      setRenomeando(null)
      toast('ONU renomeada.', 'sucesso')
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível renomear a ONU.')
    } finally {
      setSalvandoNome(false)
    }
  }

  async function executarAcao() {
    const acao = confirmandoAcao
    const ospo = dadosOspo()
    // onu.pk (onu_pk) vem 0 pra ONU sem cliente vinculado — válido aqui,
    // não "faltando" (ver comentário em atualizarAgora).
    if (!acao || !onu || onu.pk == null || !ospo) {
      toast('Dados insuficientes para executar esta ação.')
      setConfirmandoAcao(null)
      return
    }
    setExecutandoAcao(true)
    try {
      if (acao === 'reiniciar') {
        await reiniciarOnu(onu.pk, ospo)
        toast('ONU reiniciada.', 'sucesso')
      } else {
        await removerOnu(onu.pk, ospo)
        toast('ONU removida do registro.', 'sucesso')
        setOnu(null)
        setParams({})
      }
      setConfirmandoAcao(null)
    } catch (excecao) {
      toast(
        excecao instanceof ApiError
          ? excecao.message
          : `Não foi possível ${acao === 'reiniciar' ? 'reiniciar' : 'remover'} a ONU.`,
      )
    } finally {
      setExecutandoAcao(false)
    }
  }

  const semSelecao = !temParametroInicial && !onu && !carregando
  const tempoDesdeColeta = onu ? formatarTempoDesdeColeta(onu.info_timer) : null

  return (
    <div className="onu-tela tela-entrada">
      <CabecalhoTela icone={MdCable} cor={CORES.onu} titulo="ONU" subtitulo="Sinal óptico e status do equipamento." />

      <BuscaOnu onEscolher={(parametros) => setParams(parametros)} />

      {semSelecao && !erro && (
        <EstadoVazio
          icone={MdCable}
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
          <button className="botao botao-secundario" style={{ '--botao-cor': CORES.onu } as CSSProperties} onClick={() => carregar(buscarInicial)}>
            Tentar novamente
          </button>
        </div>
      )}

      {temParametroInicial && !carregando && !erro && !onu && (
        <EstadoVazio icone={MdCable} titulo="Nenhuma ONU encontrada para esta conexão." />
      )}

      {!carregando && !erro && onu && (
        <>
          <CardsSinal onu={onu} />
          <CardsCredenciais onu={onu} />
          <CardDetalhesOnu
            onu={onu}
            ocupado={atualizandoAntesDaAcao}
            onRegistrarCliente={() => abrirDepoisDeReler(() => setRegistrandoCliente(true))}
            onRenomear={() => abrirDepoisDeReler((atualizada) => setRenomeando(atualizada.name ?? ''))}
          />

          {!atualizando && tempoDesdeColeta && <p className="onu-ultima-coleta">Dados coletados {tempoDesdeColeta}</p>}
          <button
            className="botao botao-secundario botao-bloco"
            // Verde (sucesso) — diferencia do leitor de QR e do "Reiniciar"
            // logo abaixo, que usam CORES.onu (ver onu-acoes-onu).
            style={{ '--botao-cor': CORES.sucesso } as CSSProperties}
            onClick={atualizarAgora}
            disabled={atualizando}
          >
            <MdRefresh size={18} className={atualizando ? 'onu-girando' : ''} /> {atualizando ? 'Reconectando OLT… (~1 min)' : 'Atualizar agora'}
          </button>

          <div className="onu-acoes-onu">
            <button
              type="button"
              className="botao botao-secundario"
              style={{ '--botao-cor': CORES.onu } as CSSProperties}
              onClick={() => abrirDepoisDeReler(() => setConfirmandoAcao('reiniciar'))}
              disabled={executandoAcao || atualizandoAntesDaAcao}
            >
              <MdPowerSettingsNew size={16} /> Reiniciar ONU
            </button>
            <button
              type="button"
              className="botao botao-perigo"
              onClick={() => abrirDepoisDeReler(() => setConfirmandoAcao('remover'))}
              disabled={executandoAcao || atualizandoAntesDaAcao}
            >
              <MdDeleteForever size={16} /> Remover ONU
            </button>
          </div>
        </>
      )}

      {confirmandoAcao && (
        <ModalConfirmarAcao
          acao={confirmandoAcao}
          executando={executandoAcao}
          onConfirmar={executarAcao}
          onCancelar={() => setConfirmandoAcao(null)}
        />
      )}

      {renomeando !== null && (
        <ModalRenomear
          nomeAtual={renomeando}
          salvando={salvandoNome}
          onSalvar={confirmarRenomear}
          onCancelar={() => setRenomeando(null)}
        />
      )}

      {registrandoCliente && onu && (
        <ModalRegistrarCliente
          onu={onu}
          onFechar={() => setRegistrandoCliente(false)}
          onAssociado={(clientPk, clientNome) => {
            setRegistrandoCliente(false)
            setOnu((atual) => (atual ? { ...atual, client_pk: clientPk, client_name: clientNome } : atual))
            toast('ONU associada ao cliente com sucesso.', 'sucesso')
          }}
        />
      )}
    </div>
  )
}
