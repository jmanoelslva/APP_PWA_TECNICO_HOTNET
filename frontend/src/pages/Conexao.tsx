import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MdWifi } from 'react-icons/md'
import {
  ApiError,
  buscarCpe,
  buscarOnu,
  buscarSessaoOnlineCpe,
  listarDps,
  type CpeDto,
  type DpDto,
  type OnuDto,
} from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Skeleton from '../components/Skeleton'
import PullToRefresh from '../components/PullToRefresh'
import EstadoVazio from '../components/EstadoVazio'
import EstadoErro from '../components/EstadoErro'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import BuscaUsuarioPppoe from './conexao/BuscaUsuarioPppoe'
import CardAcessoRoteador from './conexao/CardAcessoRoteador'
import CardCliente from './conexao/CardCliente'
import CardCto from './conexao/CardCto'
import CardObservacao from './conexao/CardObservacao'
import CardOnuResumo from './conexao/CardOnuResumo'
import CardPppoe from './conexao/CardPppoe'
import CardRede from './conexao/CardRede'
import CardSessaoOnline from './conexao/CardSessaoOnline'
import CardWifi from './conexao/CardWifi'
import './Conexao.css'

/**
 * Dados de acesso e sessão de uma conexão (CPE). Esta página só carrega os
 * dados e monta os cartões; cada cartão editável (pages/conexao/) guarda os
 * próprios campos e avisa por onAtualizado quando salva. Os cartões só
 * aparecem com a conexão já carregada, então cada nova carga recomeça os
 * campos com os valores que vieram do Controllr.
 */

type Bloco = 'roteador' | 'obs' | 'wifi'

export default function Conexao() {
  const [params, setParams] = useSearchParams()
  const cpePkParam = params.get('cpe_pk')
  const contractPkParam = params.get('contract_pk')
  const usernameParam = params.get('username')
  // cpe_pk é o mais específico (sem ambiguidade de busca) — prioriza ele
  // quando vier mais de um parâmetro ao mesmo tempo.
  const temParametroInicial = !!cpePkParam || !!usernameParam || !!contractPkParam
  const { toast } = useToast()

  function buscarInicial() {
    if (cpePkParam) return buscarCpe({ cpe_pk: Number(cpePkParam) })
    if (usernameParam) return buscarCpe({ username: usernameParam })
    return buscarCpe({ contract_pk: Number(contractPkParam) })
  }

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [cpe, setCpe] = useState<CpeDto | null>(null)
  const [sessao, setSessao] = useState<Record<string, unknown> | null>(null)
  const [carregandoSessao, setCarregandoSessao] = useState(false)
  const [onuResumo, setOnuResumo] = useState<OnuDto | null>(null)
  const [carregandoOnuResumo, setCarregandoOnuResumo] = useState(false)
  const [dps, setDps] = useState<DpDto[]>([])
  // Quais cartões recolhíveis estão abertos — fica aqui (e não em cada
  // cartão) para continuar aberto depois de recarregar a conexão.
  const [blocosAbertos, setBlocosAbertos] = useState<Set<Bloco>>(new Set())

  function alternarBloco(chave: Bloco) {
    setBlocosAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }

  function atualizarCpe(parcial: Partial<CpeDto>) {
    setCpe((atual) => (atual ? { ...atual, ...parcial } : atual))
  }

  useEffect(() => {
    listarDps()
      .then((resposta) => setDps(resposta.results))
      .catch(() => {
        /* lista de CTOs é só conveniência para o seletor — se falhar, o técnico ainda pode digitar o pk em outro lugar */
      })
  }, [])

  useEffect(() => {
    if (!temParametroInicial) {
      setCarregando(false)
      return
    }
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpePkParam, usernameParam, contractPkParam])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    // Zera a sessão da busca anterior — sem isso, trocar de usuário/CPE
    // com o card "Sessão online" já carregado ficava mostrando a sessão
    // ANTIGA. Some agora mesmo antes da nova consulta responder.
    setSessao(null)
    setOnuResumo(null)
    try {
      const resposta = await buscarInicial()
      const cpeCarregado = resposta.results[0] ?? null
      setCpe(cpeCarregado)
      // Card "Sessão online" carrega junto com o resto dos dados, sem
      // exigir clique. Sem await de propósito: não trava o carregamento
      // do resto da tela por causa dessa consulta à parte.
      if (cpeCarregado?.pk != null) void carregarSessaoOnline(cpeCarregado.pk)
      if (cpeCarregado?.username) void carregarOnuResumo(cpeCarregado.username)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar os dados de conexão.')
    } finally {
      setCarregando(false)
    }
  }

  // Usado pelo pull-to-refresh. Sem conexão escolhida não há o que
  // recarregar (a busca por usuário refaz sozinha enquanto se digita).
  async function atualizarTela() {
    if (temParametroInicial) await carregar()
  }

  async function carregarSessaoOnline(cpePk: number) {
    setCarregandoSessao(true)
    try {
      const resposta = await buscarSessaoOnlineCpe(cpePk)
      setSessao(resposta.results[0] ?? {})
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível consultar a sessão online.')
    } finally {
      setCarregandoSessao(false)
    }
  }

  async function carregarOnuResumo(username: string) {
    setCarregandoOnuResumo(true)
    try {
      const resposta = await buscarOnu({ username })
      setOnuResumo(resposta.results[0] ?? null)
    } catch {
      // Resumo é só conveniência — sem cliente vinculado a nenhuma ONU o
      // card nem aparece, e um erro aqui não deveria travar o resto da tela.
      setOnuResumo(null)
    } finally {
      setCarregandoOnuResumo(false)
    }
  }

  return (
    <PullToRefresh aoAtualizar={atualizarTela}>
      <div className="conexao-tela tela-entrada">
        <CabecalhoTela icone={MdWifi} cor={CORES.conexao} titulo="Conexão" subtitulo="Dados de acesso e sessão do cliente." />

        {!temParametroInicial && (
          <>
            <BuscaUsuarioPppoe onEscolher={(parametros) => setParams(parametros)} />
            {!erro && (
              <EstadoVazio
                icone={MdWifi}
                titulo="Busque pelo usuário PPPoE"
                subtitulo="Ou acesse esta tela a partir dos detalhes de um cliente."
              />
            )}
          </>
        )}

        {carregando && (
          <div className="conexao-card">
            <Skeleton width="50%" height={16} />
            <Skeleton width="70%" height={13} />
            <Skeleton width="40%" height={13} />
          </div>
        )}

        {!carregando && erro && (
          <EstadoErro mensagem={erro} cor={CORES.conexao} onTentarDeNovo={carregar} />
        )}

        {temParametroInicial && !carregando && !erro && !cpe && (
          <EstadoVazio icone={MdWifi} titulo="Nenhuma conexão encontrada." />
        )}

        {!carregando && !erro && cpe && (
          <>
            <CardCliente cpe={cpe} />
            <CardPppoe cpe={cpe} />
            <CardAcessoRoteador
              cpe={cpe}
              aberto={blocosAbertos.has('roteador')}
              onAlternar={() => alternarBloco('roteador')}
              onAtualizado={atualizarCpe}
            />
            <CardObservacao
              cpe={cpe}
              aberto={blocosAbertos.has('obs')}
              onAlternar={() => alternarBloco('obs')}
              onAtualizado={atualizarCpe}
            />
            <CardWifi
              cpe={cpe}
              aberto={blocosAbertos.has('wifi')}
              onAlternar={() => alternarBloco('wifi')}
              onAtualizado={atualizarCpe}
            />
            <CardCto cpe={cpe} dps={dps} onAtualizado={atualizarCpe} />
            <CardRede cpe={cpe} />
            <CardSessaoOnline
              sessao={sessao}
              carregando={carregandoSessao}
              onAtualizar={() => cpe.pk != null && carregarSessaoOnline(cpe.pk)}
            />
            <CardOnuResumo onu={onuResumo} carregando={carregandoOnuResumo} username={cpe.username} />
          </>
        )}
      </div>
    </PullToRefresh>
  )
}
