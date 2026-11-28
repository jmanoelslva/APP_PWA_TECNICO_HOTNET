import { useEffect, useState } from 'react'
import { LuCheck, LuLocateFixed, LuX } from 'react-icons/lu'
import { ApiError, criarDp, editarDp, listarSetoresDp, type DpDto, type SetorDpDto } from '../../api/client'
import FiltroSegmentado from '../../components/FiltroSegmentado'
import { useToast } from '../../components/Toast/useToast'
import { useFecharComVoltar } from '../../hooks/useFecharComVoltar'
import { CORES } from '../../utils/cores'
import { CORES_FIBRA, corMaisProxima } from '../../utils/coresFibra'
import { PRECISAO_MAXIMA_ACEITAVEL_M, PRECISAO_SUFICIENTE_M, obterMelhorLocalizacao } from '../conexao/localizacao'
import './ModalCto.css'

const CAPACIDADES = ['8', '16'] as const
// Cores em que o check precisa ser branco.
const ESCURAS = new Set(['Azul', 'Preto', 'Violeta', 'Marrom'])
type Capacidade = (typeof CAPACIDADES)[number]

interface Posicao {
  lat: number
  lng: number
  precisao: number
}

/**
 * Cadastrar CTO nova ou editar posição, cor e capacidade de uma CTO. A
 * posição é sempre o GPS do técnico parado ao lado da caixa. Gravar
 * depende da ACL do técnico no Controllr (liberada sob demanda): sem ela,
 * o servidor devolve a mensagem e nada muda.
 */
export default function ModalCto({
  dp,
  lerPosicaoAoAbrir = false,
  existentes,
  onFechar,
  onSalvo,
}: {
  // null = CTO nova.
  dp: DpDto | null
  // CTO sem localização: já começa lendo o GPS.
  lerPosicaoAoAbrir?: boolean
  // Nomes já cadastrados, para avisar antes de enviar.
  existentes: string[]
  onFechar: () => void
  onSalvo: () => void
}) {
  const { toast } = useToast()
  useFecharComVoltar(true, onFechar)
  const nova = dp === null
  const corAtual = corMaisProxima(dp?.cor)
  const [cor, setCor] = useState<string | null>(corAtual?.hex ?? null)
  const [capacidade, setCapacidade] = useState<Capacidade>(dp?.limite === 8 ? '8' : '16')
  const [posicao, setPosicao] = useState<Posicao | null>(null)
  const [lendo, setLendo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [setores, setSetores] = useState<SetorDpDto[] | null>(null)
  const [formatoNome, setFormatoNome] = useState('{sigla}-CTO-{hub}.{numero}')
  const [setorPk, setSetorPk] = useState('')
  const [hub, setHub] = useState('')
  const [numero, setNumero] = useState('')

  useEffect(() => {
    if (!nova) return
    listarSetoresDp()
      .then((r) => {
        setSetores(r.results.filter((s) => s.sigla))
        if (r.formato_nome) setFormatoNome(r.formato_nome)
      })
      .catch(() => setSetores([]))
  }, [nova])

  useEffect(() => {
    if (lerPosicaoAoAbrir) void lerPosicao()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function lerPosicao() {
    setLendo(true)
    try {
      const melhor = await obterMelhorLocalizacao({
        pararComPrecisaoM: PRECISAO_SUFICIENTE_M,
        aoMelhorar: (p) => setPosicao({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }),
      })
      setPosicao({ lat: melhor.coords.latitude, lng: melhor.coords.longitude, precisao: melhor.coords.accuracy })
    } catch {
      toast('Não foi possível ler o GPS. Verifique se a localização está liberada.')
    } finally {
      setLendo(false)
    }
  }

  const setor = setores?.find((s) => String(s.pk) === setorPk) ?? null
  const hubN = Number(hub)
  const numeroN = Number(numero)
  const nomeNovo =
    setor?.sigla && Number.isInteger(hubN) && hubN >= 1 && Number.isInteger(numeroN) && numeroN >= 1
      ? formatoNome.replace('{sigla}', setor.sigla).replace('{hub}', String(hubN)).replace('{numero}', String(numeroN))
      : null
  const nomeRepetido = !!nomeNovo && existentes.some((n) => n.toUpperCase() === nomeNovo)

  // Cor antiga fora do padrão: ao salvar, vai o tom ABNT mais próximo.
  const corForaDoPadrao = !!dp?.cor && !!corAtual && dp.cor.toUpperCase() !== corAtual.hex
  const mudouCor = !!cor && cor !== (dp?.cor ?? '').toUpperCase()
  const mudouCapacidade = !nova && Number(capacidade) !== dp?.limite
  const podeSalvar = nova
    ? !!nomeNovo && !nomeRepetido && !!cor && !!posicao && !lendo
    : !lendo && (mudouCor || mudouCapacidade || !!posicao)

  async function salvar() {
    if (!podeSalvar) return
    setSalvando(true)
    try {
      if (nova) {
        const r = await criarDp({
          setor_pk: Number(setorPk),
          hub: hubN,
          numero: numeroN,
          limite: Number(capacidade),
          cor: cor as string,
          lat: (posicao as Posicao).lat,
          lng: (posicao as Posicao).lng,
          precisao_m: (posicao as Posicao).precisao,
        })
        toast(`${r.nome} cadastrada.`, 'sucesso')
      } else {
        await editarDp((dp as DpDto).pk, {
          ...(mudouCor ? { cor: cor as string } : {}),
          ...(mudouCapacidade ? { limite: Number(capacidade) } : {}),
          ...(posicao ? { lat: posicao.lat, lng: posicao.lng, precisao_m: posicao.precisao } : {}),
        })
        toast(`${(dp as DpDto).name} atualizada.`, 'sucesso')
      }
      onSalvo()
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível salvar a CTO.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="modal-cto-fundo" onClick={onFechar}>
      <div className="modal-cto" role="dialog" aria-label={nova ? 'Nova CTO' : `Editar ${dp?.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-cto-topo">
          <h2>{nova ? 'Nova CTO' : dp?.name}</h2>
          <button type="button" className="botao-icone botao-icone-fantasma" onClick={onFechar} aria-label="Fechar">
            <LuX size={20} />
          </button>
        </div>

        {nova && (
          <>
            <label className="modal-cto-campo">
              <span>Setor</span>
              <select className="campo" value={setorPk} onChange={(e) => setSetorPk(e.target.value)}>
                <option value="">{setores ? 'Escolha o setor' : 'Carregando…'}</option>
                {setores?.map((s) => (
                  <option key={s.pk} value={s.pk}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-cto-par">
              <label className="modal-cto-campo">
                <span>Hub</span>
                <input className="campo" inputMode="numeric" value={hub} onChange={(e) => setHub(e.target.value.replace(/\D/g, '').slice(0, 2))} />
              </label>
              <label className="modal-cto-campo">
                <span>Nº da CTO</span>
                <input className="campo" inputMode="numeric" value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, '').slice(0, 2))} />
              </label>
            </div>
            <p className={`modal-cto-nome${nomeRepetido ? ' modal-cto-alerta' : ''}`}>
              {nomeNovo ? (nomeRepetido ? `${nomeNovo} já existe.` : `Nome: ${nomeNovo}`) : 'Escolha o setor e informe o hub e o número.'}
            </p>
          </>
        )}

        <span className="modal-cto-rotulo">Capacidade</span>
        <FiltroSegmentado
          opcoes={CAPACIDADES.map((c) => ({ chave: c, rotulo: `${c} portas` }))}
          ativa={capacidade}
          onEscolher={setCapacidade}
          rotulo="Capacidade"
          cor={CORES.conexao}
        />

        <span className="modal-cto-rotulo">Cor (código ABNT)</span>
        <div className="modal-cto-cores" role="radiogroup" aria-label="Cor da CTO">
          {CORES_FIBRA.map((c) => (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={cor === c.hex}
              className="modal-cto-cor"
              onClick={() => setCor(c.hex)}
            >
              <i style={{ background: c.hex }} data-escura={ESCURAS.has(c.nome)}>{cor === c.hex && <LuCheck size={16} aria-hidden />}</i>
              <span>
                {c.numero} {c.nome}
              </span>
            </button>
          ))}
        </div>
        {corForaDoPadrao && (
          <p className="modal-cto-nota">
            Cor atual fora do padrão ({dp?.cor}): ao salvar, fica {corMaisProxima(cor)?.nome ?? corAtual?.nome}.
          </p>
        )}

        <span className="modal-cto-rotulo">Posição</span>
        <p className="modal-cto-nota">
          {posicao
            ? `GPS: ±${Math.round(posicao.precisao)} m${lendo ? ' · melhorando…' : ''}`
            : nova
              ? 'Pare ao lado da CTO e leia o GPS.'
              : dp?.lat != null
                ? 'Mantém a posição atual. Para corrigir, pare ao lado da CTO e leia o GPS.'
                : 'Esta CTO não tem posição. Pare ao lado dela e leia o GPS.'}
        </p>
        {posicao && posicao.precisao > PRECISAO_MAXIMA_ACEITAVEL_M && !lendo && (
          <p className="modal-cto-nota modal-cto-alerta">Precisão baixa. Espere o GPS melhorar ou leia de novo em área aberta.</p>
        )}
        <button
          type="button"
          className="botao botao-secundario botao-largo acao-rede"
          onClick={() => void lerPosicao()}
          disabled={lendo}
          aria-busy={lendo}
        >
          <LuLocateFixed size={18} /> {lendo ? 'Lendo o GPS…' : posicao ? 'Ler o GPS de novo' : 'Usar minha posição'}
        </button>

        <button
          type="button"
          className="botao botao-primario botao-largo modal-cto-salvar"
          onClick={() => void salvar()}
          disabled={!podeSalvar || salvando}
          aria-busy={salvando}
        >
          {salvando ? 'Salvando…' : nova ? 'Cadastrar CTO' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}
