import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { LuMap, LuX } from 'react-icons/lu'
import { MdSearch } from 'react-icons/md'
import {
  ApiError,
  buscarClientes,
  buscarCpe,
  buscarDetalheCliente,
  listarDps,
  type BuscaClienteResultado,
  type DpDto,
  type EnderecoDto,
} from '../api/client'
import CabecalhoTela from '../components/CabecalhoTela'
import Spinner from '../components/Spinner'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import { detectarTipoBusca, formatarDocumento } from '../utils/formatacao'
import { distanciaMetros, formatarDistancia, useLocalizacaoAoVivo } from './conexao/localizacao'
import './Conexao.css'
import './Home.css'
import './MapaCtos.css'

// Leaflet só é baixado quando a tela abre.
const MapaCto = lazy(() => import('./conexao/MapaCto'))

const QTD_MAIS_PROXIMAS = 5

interface EnderecoNoMapa {
  lat: number
  lng: number
  nomeCliente: string
  descricao: string
}

// CTO já gravada numa conexão do cliente (Conexão → bloco CTO).
interface CtoDoCliente {
  dpPk: number
  dpNome: string
  porta: number | null
  pppoe: string | null
}

function coordenadaDoEndereco(endereco: EnderecoDto): { lat: number; lng: number } | null {
  const lat = Number(endereco.address_latitude)
  const lng = Number(endereco.address_longitude)
  return endereco.address_latitude && endereco.address_longitude && Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)
    ? { lat, lng }
    : null
}

function descreverEndereco(endereco: EnderecoDto): string {
  const rua = [endereco.address, endereco.address_number].filter(Boolean).join(', ')
  return [rua, endereco.address_neighborhood].filter(Boolean).join(' — ') || 'Endereço sem descrição'
}

/**
 * Mapa com as CTOs do Controllr e a posição do técnico ao vivo, sem
 * precisar abrir uma conexão — para ver a CTO mais próxima do cliente
 * antes do atendimento. Com um cliente buscado, as distâncias passam a ser
 * a partir do endereço dele (coordenada cadastrada no Controllr). Só
 * consulta: escolher a CTO de um cliente continua no bloco CTO da Conexão.
 */
export default function MapaCtos() {
  const { toast } = useToast()
  const [dps, setDps] = useState<DpDto[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionadaPk, setSelecionadaPk] = useState<number | null>(null)
  const aoVivo = useLocalizacaoAoVivo()
  // Primeira leitura do GPS, fixa: centraliza uma vez só, sem puxar o mapa
  // de volta a cada atualização.
  const [primeiraPosicao, setPrimeiraPosicao] = useState<{ lat: number; lng: number } | null>(null)
  if (aoVivo && !primeiraPosicao) setPrimeiraPosicao({ lat: aoVivo.lat, lng: aoVivo.lng })

  // Busca de cliente: resultados → endereços com coordenada → um escolhido.
  const [busca, setBusca] = useState('')
  const [buscando, setBuscando] = useState(false)
  const [listaAberta, setListaAberta] = useState(false)
  const [resultados, setResultados] = useState<BuscaClienteResultado[] | null>(null)
  const [enderecos, setEnderecos] = useState<EnderecoNoMapa[] | null>(null)
  const [enderecoCliente, setEnderecoCliente] = useState<EnderecoNoMapa | null>(null)
  const [ctosCliente, setCtosCliente] = useState<CtoDoCliente[] | null>(null)

  // Ao vivo, como a busca do Início: 2 letras, 350 ms parado e consulta.
  useEffect(() => {
    const termo = busca.trim()
    if (termo.length < 2) {
      setResultados(null)
      setBuscando(false)
      return
    }
    let cancelado = false
    setBuscando(true)
    const temporizador = setTimeout(() => {
      buscarClientes(detectarTipoBusca(termo))
        .then((resposta) => {
          if (cancelado) return
          setEnderecos(null)
          setResultados(resposta.results)
        })
        .catch((excecao) => {
          if (!cancelado) toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível buscar o cliente.')
        })
        .finally(() => {
          if (!cancelado) setBuscando(false)
        })
    }, 350)
    return () => {
      cancelado = true
      clearTimeout(temporizador)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  function aoBuscar(evento: FormEvent) {
    evento.preventDefault()
    // A busca já roda sozinha; Enter só fecha o teclado (e, com um único
    // cliente encontrado, já o escolhe).
    ;(document.activeElement as HTMLElement | null)?.blur()
    if (resultados?.length === 1) {
      setListaAberta(false)
      void escolherCliente(resultados[0])
    }
  }

  async function escolherCliente(resultado: BuscaClienteResultado) {
    setBuscando(true)
    // null: ainda lendo (ou falhou) — não mostra "sem CTO" à toa.
    setCtosCliente(null)
    // CTO e porta já gravadas nas conexões do cliente — complemento: se
    // falhar, o mapa segue só com o endereço.
    buscarCpe({ client_pk: resultado.client_pk })
      .then((resposta) =>
        setCtosCliente(
          resposta.results
            .filter((cpe) => cpe.dp_pk != null)
            .map((cpe) => ({
              dpPk: cpe.dp_pk as number,
              dpNome: cpe.dp_name || `CTO #${cpe.dp_pk}`,
              porta: cpe.dp_port ?? null,
              pppoe: cpe.username ?? null,
            })),
        ),
      )
      .catch(() => {})
    try {
      const detalhe = await buscarDetalheCliente(resultado.client_pk)
      const nome = detalhe.cliente.client_complete_name ?? resultado.cliente.client_complete_name ?? 'Cliente'
      // Endereço principal primeiro.
      const comCoordenada = [...detalhe.enderecos]
        .sort((a, b) => (b.address_default ?? 0) - (a.address_default ?? 0))
        .flatMap((endereco) => {
          const ponto = coordenadaDoEndereco(endereco)
          return ponto ? [{ ...ponto, nomeCliente: nome, descricao: descreverEndereco(endereco) }] : []
        })
      if (comCoordenada.length === 0) toast(`${nome}: nenhum endereço com coordenada cadastrada.`)
      else if (comCoordenada.length === 1) escolherEndereco(comCoordenada[0])
      else setEnderecos(comCoordenada)
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar o cliente.')
    } finally {
      setBuscando(false)
    }
  }

  function escolherEndereco(endereco: EnderecoNoMapa) {
    setEnderecos(null)
    setEnderecoCliente(endereco)
    setSelecionadaPk(null)
  }

  function limparCliente() {
    setEnderecoCliente(null)
    setCtosCliente(null)
    setResultados(null)
    setEnderecos(null)
    setBusca('')
    setSelecionadaPk(null)
  }

  useEffect(() => {
    listarDps()
      .then((resposta) => setDps(resposta.results))
      .catch((excecao) => setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar as CTOs.'))
  }, [])

  const comCoordenada = (dps ?? []).filter(
    (dp): dp is DpDto & { lat: number; lng: number } => dp.lat != null && dp.lng != null,
  )
  const selecionada = comCoordenada.find((dp) => dp.pk === selecionadaPk) ?? null
  // Referência das distâncias: o endereço do cliente buscado; senão, o técnico.
  const referencia = enderecoCliente ?? aoVivo
  const maisProximas = referencia
    ? comCoordenada
        .map((dp) => ({ dp, distanciaM: distanciaMetros(referencia.lat, referencia.lng, dp.lat, dp.lng) }))
        .sort((a, b) => a.distanciaM - b.distanciaM)
        .slice(0, QTD_MAIS_PROXIMAS)
    : []
  // Centro: a CTO tocada; senão, o cliente buscado; senão, o técnico; sem
  // GPS, a primeira CTO.
  const centro = selecionada
    ? { lat: selecionada.lat, lng: selecionada.lng }
    : enderecoCliente
      ? { lat: enderecoCliente.lat, lng: enderecoCliente.lng }
      : (primeiraPosicao ?? (comCoordenada[0] ? { lat: comCoordenada[0].lat, lng: comCoordenada[0].lng } : null))

  return (
    <div className="mapa-ctos-tela tela-entrada">
      <CabecalhoTela icone={LuMap} cor={CORES.conexao} titulo="Mapa de CTOs" />

      {/* Mesmo campo e lista suspensa da busca do Início, só com clientes
          (o mapa precisa do endereço). */}
      <form className="home-busca home-combobox mapa-ctos-busca" onSubmit={aoBuscar} role="search">
        <div className="home-busca-campo">
          <MdSearch size={20} className="home-busca-icone" aria-hidden="true" />
          <input
            enterKeyHint="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onFocus={() => setListaAberta(true)}
            onBlur={() => setTimeout(() => setListaAberta(false), 150)}
            placeholder="Cliente, CPF ou contrato"
            aria-label="Buscar cliente"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        {listaAberta && busca.trim().length >= 2 && (
          <ul className="home-combobox-lista">
            {(buscando || !resultados) && <li className="home-combobox-vazio">Buscando…</li>}
            {!buscando && resultados?.length === 0 && <li className="home-combobox-vazio">Nada encontrado.</li>}
            {!buscando &&
              resultados?.map((resultado) => (
                <li key={resultado.client_pk}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setListaAberta(false)
                      void escolherCliente(resultado)
                    }}
                  >
                    <strong>
                      {resultado.cliente.client_complete_name ?? resultado.cliente.client_name ?? `Cliente #${resultado.client_pk}`}
                    </strong>
                    {resultado.cliente.client_doc1 && ` — ${formatarDocumento(resultado.cliente.client_doc1)}`}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </form>

      {enderecos && (
        <ul className="mapa-ctos-opcoes">
          <li className="mapa-ctos-aviso">Escolha o endereço:</li>
          {enderecos.map((endereco) => (
            <li key={`${endereco.lat},${endereco.lng},${endereco.descricao}`}>
              <button type="button" className="mapa-ctos-item" onClick={() => escolherEndereco(endereco)}>
                <span className="mapa-ctos-nome">
                  <strong>{endereco.descricao}</strong>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {enderecoCliente && (
        <div className="mapa-ctos-cliente">
          <i aria-hidden="true" />
          <span className="mapa-ctos-nome">
            <strong>{enderecoCliente.nomeCliente}</strong>
            <span>{enderecoCliente.descricao}</span>
            {ctosCliente?.map((cto) => (
              <button
                key={`${cto.pppoe}-${cto.dpPk}`}
                type="button"
                className="mapa-ctos-cto-atual"
                onClick={() => setSelecionadaPk(cto.dpPk)}
                aria-label={`Mostrar a CTO ${cto.dpNome} no mapa`}
              >
                CTO {cto.dpNome}
                {cto.porta != null && ` · porta ${cto.porta}`}
                {ctosCliente.length > 1 && cto.pppoe && ` (${cto.pppoe})`}
              </button>
            ))}
            {ctosCliente?.length === 0 && <span>Sem CTO gravada na conexão</span>}
          </span>
          <button type="button" onClick={limparCliente} aria-label="Voltar para a minha localização">
            <LuX size={20} />
          </button>
        </div>
      )}

      {erro && <p className="mapa-ctos-aviso">{erro}</p>}
      {!erro && !dps && <Spinner />}
      {dps && !centro && <p className="mapa-ctos-aviso">Nenhuma CTO cadastrada tem coordenada.</p>}

      {dps && centro && (
        <Suspense fallback={<Spinner />}>
          <MapaCto
            centro={centro}
            dps={comCoordenada}
            selecionadaPk={selecionadaPk}
            minhaLocalizacao={aoVivo}
            precisaoM={aoVivo?.precisaoM ?? null}
            cliente={enderecoCliente}
            onSelecionar={(dp) => setSelecionadaPk(dp.pk)}
            onSemLocalizacao={() => toast('Aguardando a localização do GPS. Verifique se a permissão está liberada.')}
          />
        </Suspense>
      )}

      {dps && (
        <section className="mapa-ctos-proximas">
          <h2>{enderecoCliente ? 'Mais próximas do cliente' : 'Mais próximas de você'}</h2>
          {!referencia && <p className="mapa-ctos-aviso">Aguardando sua localização…</p>}
          {!enderecoCliente && aoVivo && (
            <p className="mapa-ctos-aviso mapa-ctos-precisao">Precisão do GPS: ±{Math.round(aoVivo.precisaoM)} m</p>
          )}
          <ul>
            {maisProximas.map(({ dp, distanciaM }) => (
              <li key={dp.pk}>
                <button
                  type="button"
                  className={dp.pk === selecionadaPk ? 'mapa-ctos-item ativo' : 'mapa-ctos-item'}
                  onClick={() => setSelecionadaPk(dp.pk)}
                >
                  <i style={{ background: dp.cor || '#555555' }} aria-hidden="true" />
                  <span className="mapa-ctos-nome">
                    <strong>
                      {dp.name}
                      {ctosCliente?.some((cto) => cto.dpPk === dp.pk) && <em className="mapa-ctos-selo">Atual</em>}
                    </strong>
                    {dp.ativos != null && (
                      <span>
                        {dp.limite ? (
                          <>
                            {dp.ativos}/{dp.limite} portas ·{' '}
                            {dp.limite - dp.ativos > 0 ? (
                              <b className="mapa-ctos-livres">
                                {dp.limite - dp.ativos} {dp.limite - dp.ativos === 1 ? 'livre' : 'livres'}
                              </b>
                            ) : (
                              <b className="mapa-ctos-lotada">Lotada</b>
                            )}
                          </>
                        ) : (
                          `${dp.ativos} ativo(s)`
                        )}
                      </span>
                    )}
                  </span>
                  <span className="mapa-ctos-distancia">{formatarDistancia(distanciaM)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
