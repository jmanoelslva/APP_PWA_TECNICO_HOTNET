import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  MdAdd,
  MdBuild,
  MdDescription,
  MdEdit,
  MdExpandLess,
  MdExpandMore,
  MdLocationOn,
  MdPeopleAlt,
  MdRouter,
  MdWifi,
} from 'react-icons/md'
import {
  ApiError,
  atualizarEndereco,
  atualizarTelefone,
  buscarCpe,
  buscarDetalheCliente,
  buscarOnu,
  criarTelefone,
  listarTickets,
  type ContratoDto,
  type CpeComboDto,
  type CpeDto,
  type EnderecoDto,
  type OnuDto,
  type TelefoneDto,
  type TicketDto,
} from '../api/client'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import { formatarData, formatarStatusContrato, nivelSinalOnu, TEXTO_SINAL_ONU } from '../utils/formatacao'
import './DetalheCliente.css'

// Resumo de conexão + ONU de um CPE, carregado à parte (endpoints
// diferentes de /clientes/{pk}) pra já mostrar aqui na tela do cliente
// o que o técnico normalmente só via depois de entrar em Conexão/ONU —
// os links pra essas telas continuam existindo, pra ações (revelar
// senha, forçar atualização da ONU etc).
interface ResumoConexao {
  carregando: boolean
  cpe: CpeDto | null
  onu: OnuDto | null
}

// contract_sign_code/info/draw/ip/hash — vistos numa captura real da API,
// mas sem descrição na doc oficial (só sign_date/sign_doc_link têm
// significado confirmado, tratados à parte). Mostra os demais de forma
// genérica em vez de inventar um rótulo/tradução que não dá pra confirmar.
function rotuloCampoAssinatura(chave: string): string {
  return chave
    .replace(/^contract_sign_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function camposAssinaturaExtra(contrato: ContratoDto): Array<[string, string]> {
  return Object.entries(contrato)
    .filter(
      ([chave, valor]) =>
        chave.startsWith('contract_sign_') &&
        chave !== 'contract_sign_date' &&
        chave !== 'contract_sign_doc_link' &&
        valor != null &&
        valor !== '',
    )
    .map(([chave, valor]) => [rotuloCampoAssinatura(chave), String(valor)])
}

export default function DetalheCliente() {
  const { clientPk } = useParams<{ clientPk: string }>()
  const pk = Number(clientPk)
  const { toast } = useToast()

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [nome, setNome] = useState<string | null>(null)
  const [doc, setDoc] = useState<string | null>(null)
  const [telefones, setTelefones] = useState<TelefoneDto[]>([])
  const [contratos, setContratos] = useState<ContratoDto[]>([])
  const [enderecos, setEnderecos] = useState<EnderecoDto[]>([])
  const [cpes, setCpes] = useState<CpeComboDto[]>([])
  const [resumosConexao, setResumosConexao] = useState<Record<number, ResumoConexao>>({})
  const [chamados, setChamados] = useState<TicketDto[]>([])
  const [enderecoEditando, setEnderecoEditando] = useState<EnderecoDto | null>(null)
  const [telefoneEditando, setTelefoneEditando] = useState<TelefoneDto | null>(null)
  const [adicionandoTelefone, setAdicionandoTelefone] = useState(false)
  // Contrato traz bastante informação (assinatura, itens...) que só
  // interessa quando o técnico realmente precisa dela — fica recolhido
  // por padrão pra não ocupar a tela à toa, expande sob demanda.
  const [contratosExpandidos, setContratosExpandidos] = useState<Set<number>>(new Set())

  function alternarContrato(chave: number) {
    setContratosExpandidos((atual) => {
      const novo = new Set(atual)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }

  useEffect(() => {
    if (!Number.isFinite(pk)) return
    carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pk])

  async function carregar() {
    setCarregando(true)
    setErro(null)
    try {
      const resposta = await buscarDetalheCliente(pk)
      setNome(resposta.cliente.client_complete_name ?? resposta.cliente.client_name ?? null)
      setDoc(resposta.cliente.client_doc1 ?? null)
      setTelefones(resposta.telefones ?? [])
      setContratos(resposta.contratos)
      setEnderecos(resposta.enderecos)
      setCpes(resposta.cpes)
      // Histórico de chamados/OS do cliente — carregado à parte (endpoint
      // diferente) e sem travar o resto da tela se falhar, já que é
      // informação complementar, não o cadastro em si.
      listarTickets({ minhas: false, clientPk: pk, limit: 10 })
        .then((r) => setChamados(r.results))
        .catch(() => setChamados([]))
      carregarResumosConexao(resposta.cpes)
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar os dados do cliente.')
    } finally {
      setCarregando(false)
    }
  }

  // Um CPE por vez, em paralelo entre si — cada um busca sua conexão e
  // sua ONU juntas, sem travar os outros CPEs nem o resto da tela se um
  // deles falhar (ex: cliente sem ONU cadastrada, só CPE).
  function carregarResumosConexao(listaCpes: CpeComboDto[]) {
    for (const cpe of listaCpes) {
      if (cpe.cpe_pk == null) continue
      const cpePk = cpe.cpe_pk
      setResumosConexao((atual) => ({ ...atual, [cpePk]: { carregando: true, cpe: null, onu: null } }))
      Promise.allSettled([
        buscarCpe({ cpe_pk: cpePk }),
        cpe.cpe_username ? buscarOnu({ username: cpe.cpe_username }) : buscarOnu({ cpe_pk: cpePk }),
      ]).then(([resultadoCpe, resultadoOnu]) => {
        setResumosConexao((atual) => ({
          ...atual,
          [cpePk]: {
            carregando: false,
            cpe: resultadoCpe.status === 'fulfilled' ? (resultadoCpe.value.results[0] ?? null) : null,
            onu: resultadoOnu.status === 'fulfilled' ? (resultadoOnu.value.results[0] ?? null) : null,
          },
        }))
      })
    }
  }

  if (!Number.isFinite(pk)) {
    return <p className="detalhe-cliente-status">Cliente não encontrado.</p>
  }

  return (
    <div className="detalhe-cliente-tela tela-entrada">
      {carregando && (
        <div className="detalhe-cliente-card">
          <Skeleton width="50%" height={18} />
          <Skeleton width="30%" height={13} />
        </div>
      )}

      {!carregando && erro && (
        <div className="detalhe-cliente-status">
          <p>{erro}</p>
          <button onClick={carregar}>Tentar novamente</button>
        </div>
      )}

      {!carregando && !erro && (
        <>
          <div className="detalhe-cliente-card">
            <span className="detalhe-cliente-icone" style={{ background: CORES.cliente }}>
              <MdPeopleAlt size={22} color={CORES.branco} />
            </span>
            <div>
              <strong>{nome ?? `Cliente #${pk}`}</strong>
              {doc && <p>Documento: {doc}</p>}
            </div>
          </div>

          <section className="detalhe-cliente-secao">
            <h2>Telefones</h2>
            {telefones.length === 0 && <p className="detalhe-cliente-vazio">Nenhum telefone cadastrado.</p>}
            {telefones.map((tel) => (
              <div key={tel.phone_pk} className="detalhe-cliente-item">
                <div className="detalhe-cliente-item-topo">
                  <strong>{tel.phone_identification ?? 'Telefone'}</strong>
                  <button className="detalhe-cliente-btn-icone" onClick={() => setTelefoneEditando(tel)} aria-label="Editar telefone">
                    <MdEdit size={18} />
                  </button>
                </div>
                <p>{tel.phone_number || 'Número não informado'}</p>
              </div>
            ))}
            <button type="button" className="detalhe-cliente-chip detalhe-cliente-chip-botao" onClick={() => setAdicionandoTelefone(true)}>
              <MdAdd size={14} /> Adicionar telefone
            </button>
          </section>

          <section className="detalhe-cliente-secao">
            <h2>Endereços</h2>
            {enderecos.length === 0 && <p className="detalhe-cliente-vazio">Nenhum endereço cadastrado.</p>}
            {enderecos.map((endereco) => (
              <div key={endereco.address_pk} className="detalhe-cliente-item">
                <div className="detalhe-cliente-item-topo">
                  <strong>{endereco.address_identification ?? 'Endereço'}</strong>
                  <button className="detalhe-cliente-btn-icone" onClick={() => setEnderecoEditando(endereco)} aria-label="Editar endereço">
                    <MdEdit size={18} />
                  </button>
                </div>
                <p>
                  {[endereco.address, endereco.address_number, endereco.address_neighborhood]
                    .filter(Boolean)
                    .join(', ') || 'Endereço não informado'}
                </p>
                {(endereco.address_province || endereco.address_state) && (
                  <p>{[endereco.address_province, endereco.address_state].filter(Boolean).join(' - ')}</p>
                )}
                {endereco.address_zipcode && <p>CEP: {endereco.address_zipcode}</p>}
                {endereco.address_latitude && endereco.address_longitude && (
                  <div className="detalhe-cliente-item-acoes">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${endereco.address_latitude},${endereco.address_longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="detalhe-cliente-chip"
                    >
                      <MdLocationOn size={14} /> Ver no Google Maps
                    </a>
                  </div>
                )}
              </div>
            ))}
          </section>

          <section className="detalhe-cliente-secao">
            <h2>Conexões (CPE)</h2>
            {cpes.length === 0 && <p className="detalhe-cliente-vazio">Nenhuma conexão encontrada.</p>}
            {cpes.map((cpe) => {
              const resumo = cpe.cpe_pk != null ? resumosConexao[cpe.cpe_pk] : undefined
              const sinal = nivelSinalOnu(resumo?.onu?.omddm_rx_power)
              return (
                <div key={cpe.cpe_pk} className="detalhe-cliente-item">
                  <strong>{cpe.cpe_username ?? `CPE #${cpe.cpe_pk}`}</strong>
                  {(cpe.contract_number ?? cpe.contract_pk) != null && <p>Contrato: {cpe.contract_number ?? cpe.contract_pk}</p>}

                  {resumo?.carregando && <p className="detalhe-cliente-resumo-carregando">Consultando conexão e ONU…</p>}

                  {resumo && !resumo.carregando && (resumo.cpe || resumo.onu) && (
                    <div className="detalhe-cliente-resumo-grid">
                      {resumo.cpe?.plan_name && (
                        <div>
                          <span>Plano</span>
                          <strong>{resumo.cpe.plan_name}</strong>
                        </div>
                      )}
                      {(resumo.cpe?.v4_ip ?? resumo.cpe?.v4_ip_last) && (
                        <div>
                          <span>IP</span>
                          <strong>{resumo.cpe?.v4_ip ?? resumo.cpe?.v4_ip_last}</strong>
                        </div>
                      )}
                      {resumo.onu && (
                        <div>
                          <span>Sinal ONU</span>
                          <span className={`detalhe-cliente-sinal-badge ${sinal}`}>
                            {resumo.onu.omddm_rx_power != null ? `${resumo.onu.omddm_rx_power} dBm` : TEXTO_SINAL_ONU[sinal]}
                          </span>
                        </div>
                      )}
                      {resumo.onu?.distance != null && (
                        <div>
                          <span>Distância</span>
                          <strong>{resumo.onu.distance} km</strong>
                        </div>
                      )}
                      {resumo.onu?.state && (
                        <div>
                          <span>Estado ONU</span>
                          <strong>{resumo.onu.state}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="detalhe-cliente-item-acoes">
                    <Link to={`/conexao?cpe_pk=${cpe.cpe_pk}`} className="detalhe-cliente-chip" viewTransition>
                      <MdWifi size={14} /> Conexão
                    </Link>
                    <Link
                      to={
                        cpe.cpe_username
                          ? `/onu?username=${encodeURIComponent(cpe.cpe_username)}`
                          : `/onu?cpe_pk=${cpe.cpe_pk}`
                      }
                      className="detalhe-cliente-chip"
                      viewTransition
                    >
                      <MdRouter size={14} /> ONU
                    </Link>
                  </div>
                </div>
              )
            })}
          </section>

          <section className="detalhe-cliente-secao">
            <h2>Chamados / OS</h2>
            {chamados.length === 0 && <p className="detalhe-cliente-vazio">Nenhum chamado encontrado.</p>}
            {chamados.map((chamado) => (
              <Link
                key={chamado.ticket_pk}
                to={`/suporte/${chamado.ticket_pk}`}
                state={{ chamado }}
                viewTransition
                className="detalhe-cliente-item detalhe-cliente-item-link"
              >
                <div className="detalhe-cliente-item-topo">
                  <strong>{chamado.ticket_title ?? `OS #${chamado.ticket_pk}`}</strong>
                  <span className={`detalhe-cliente-chamado-badge ${chamado.ticket_date_close ? 'fechado' : 'aberto'}`}>
                    {chamado.ticket_date_close ? 'Fechada' : 'Aberta'}
                  </span>
                </div>
                {chamado.category_name && <p>{chamado.category_name}</p>}
                <p>Aberta em {formatarData(chamado.ticket_date_create) ?? 'data não informada'}</p>
              </Link>
            ))}
            {chamados.length > 0 && (
              <Link to="/suporte" className="detalhe-cliente-chip" viewTransition>
                <MdBuild size={14} /> Ver todas as OS
              </Link>
            )}
          </section>

          <section className="detalhe-cliente-secao">
            <h2>Contratos</h2>
            {contratos.length === 0 && <p className="detalhe-cliente-vazio">Nenhum contrato encontrado.</p>}
            {contratos.map((contrato, indice) => {
              const chave = contrato.contract_pk ?? indice
              const expandido = contratosExpandidos.has(chave)
              return (
                <div key={chave} className="detalhe-cliente-item">
                  <button
                    type="button"
                    className="detalhe-cliente-item-topo detalhe-cliente-contrato-toggle"
                    onClick={() => alternarContrato(chave)}
                    aria-expanded={expandido}
                  >
                    <strong>Contrato {contrato.contract_number ?? contrato.contract_pk}</strong>
                    {expandido ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
                  </button>
                  {expandido && (
                    <>
                      {contrato.contract_status != null && <p>Status: {formatarStatusContrato(contrato.contract_status)}</p>}
                      {contrato.contract_date_activation && <p>Ativado em {contrato.contract_date_activation}</p>}
                      {/* contract_sign_date vazio/null = ainda não assinado
                          (confirmado na doc oficial, apidoc.brbyte.com/#post-
                          /controllrctl/contract/list) — é o indicador de status
                          da assinatura, não um campo à parte. */}
                      <p>Assinatura: {contrato.contract_sign_date ? `Assinado em ${formatarData(contrato.contract_sign_date)}` : 'Não assinado'}</p>
                      {camposAssinaturaExtra(contrato).map(([rotulo, valor]) => (
                        <p key={rotulo} className="detalhe-cliente-campo-extra">
                          {rotulo}: {valor}
                        </p>
                      ))}
                      {contrato.itens && contrato.itens.length > 0 && (
                        <div className="detalhe-cliente-itens">
                          <span className="detalhe-cliente-itens-titulo">Itens do contrato</span>
                          {contrato.itens.map((item, indiceItem) => (
                            <div key={item.item_pk ?? indiceItem} className="detalhe-cliente-itens-linha">
                              <span>{item.item_name ?? item.plan_name ?? 'Item'}</span>
                              {item.item_amount && <strong>R$ {item.item_amount}</strong>}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Contrato ainda não assinado: destaca a assinatura como
                          ação principal — é o que o técnico faz na visita,
                          entregando o aparelho pro cliente assinar ali mesmo
                          nesse link. Já assinado, "Ver contrato" some pra um
                          chip discreto (só consulta). */}
                      {!contrato.contract_sign_date && contrato.contract_sign_doc_link && (
                        <a
                          href={contrato.contract_sign_doc_link}
                          target="_blank"
                          rel="noreferrer"
                          className="detalhe-cliente-btn-assinar"
                        >
                          <MdDescription size={18} /> Assinar contrato agora
                        </a>
                      )}
                      {!contrato.contract_sign_date && !contrato.contract_sign_doc_link && (
                        <p className="detalhe-cliente-campo-extra">Link de assinatura ainda não disponível pra este contrato.</p>
                      )}
                      {(contrato.contract_pk || (contrato.contract_sign_date && contrato.contract_sign_doc_link)) && (
                        <div className="detalhe-cliente-item-acoes">
                          {contrato.contract_pk && (
                            <Link to={`/conexao?contract_pk=${contrato.contract_pk}`} className="detalhe-cliente-chip" viewTransition>
                              <MdWifi size={14} /> Conexão
                            </Link>
                          )}
                          {contrato.contract_sign_date && contrato.contract_sign_doc_link && (
                            <a href={contrato.contract_sign_doc_link} target="_blank" rel="noreferrer" className="detalhe-cliente-chip">
                              <MdDescription size={14} /> Ver contrato assinado
                            </a>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </section>
        </>
      )}

      {enderecoEditando && (
        <ModalEditarEndereco
          endereco={enderecoEditando}
          onFechar={() => setEnderecoEditando(null)}
          onSalvo={(atualizado) => {
            setEnderecos((atual) => atual.map((e) => (e.address_pk === atualizado.address_pk ? atualizado : e)))
            setEnderecoEditando(null)
            toast('Endereço atualizado com sucesso.', 'sucesso')
          }}
        />
      )}

      {telefoneEditando && (
        <ModalEditarTelefone
          telefone={telefoneEditando}
          onFechar={() => setTelefoneEditando(null)}
          onSalvo={(atualizado) => {
            setTelefones((atual) => atual.map((t) => (t.phone_pk === atualizado.phone_pk ? atualizado : t)))
            setTelefoneEditando(null)
            toast('Telefone atualizado com sucesso.', 'sucesso')
          }}
        />
      )}

      {adicionandoTelefone && (
        <ModalAdicionarTelefone
          clientPk={pk}
          onFechar={() => setAdicionandoTelefone(false)}
          onSalvo={() => {
            setAdicionandoTelefone(false)
            toast('Telefone adicionado com sucesso.', 'sucesso')
            // Recarrega em vez de montar o registro na mão — o phone_pk
            // de verdade só vem do Controllr, e é mais simples pegar a
            // lista atualizada inteira do que tentar adivinhar/extrair
            // isso da resposta crua do /telefones (results não tem tipo
            // garantido, ver criarTelefone em api/client.ts).
            carregar()
          }}
        />
      )}
    </div>
  )
}

function ModalEditarEndereco({
  endereco,
  onFechar,
  onSalvo,
}: {
  endereco: EnderecoDto
  onFechar: () => void
  onSalvo: (endereco: EnderecoDto) => void
}) {
  const [form, setForm] = useState<EnderecoDto>(endereco)
  const [salvando, setSalvando] = useState(false)
  const [capturandoLocalizacao, setCapturandoLocalizacao] = useState(false)
  const { toast } = useToast()

  function capturarLocalizacaoAtual() {
    if (!navigator.geolocation) {
      toast('Este navegador não suporta captura de localização.')
      return
    }
    setCapturandoLocalizacao(true)
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setForm((atual) => ({
          ...atual,
          address_latitude: String(posicao.coords.latitude),
          address_longitude: String(posicao.coords.longitude),
        }))
        setCapturandoLocalizacao(false)
      },
      () => {
        setCapturandoLocalizacao(false)
        toast('Não foi possível obter a localização. Verifique a permissão do navegador.')
      },
    )
  }

  async function salvar() {
    if (!endereco.address_pk) return
    setSalvando(true)
    try {
      await atualizarEndereco(endereco.address_pk, {
        // client_pk, address_zipcode, address_siafi e address_default são
        // obrigatórios pro Controllr aceitar a atualização (confirmado na
        // doc oficial) — não são editáveis nesta tela, então sempre
        // reenvia o valor já carregado (form == endereco nesses campos).
        client_pk: form.client_pk,
        address_siafi: form.address_siafi,
        address_default: form.address_default,
        address: form.address,
        address_number: form.address_number,
        address_neighborhood: form.address_neighborhood,
        address_zipcode: form.address_zipcode,
        address_province: form.address_province,
        address_state: form.address_state,
        address_completation: form.address_completation,
        address_identification: form.address_identification,
        address_latitude: form.address_latitude,
        address_longitude: form.address_longitude,
      })
      onSalvo(form)
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível salvar o endereço.')
    } finally {
      setSalvando(false)
    }
  }

  function campo<K extends keyof EnderecoDto>(chave: K) {
    return {
      value: (form[chave] as string) ?? '',
      onChange: (e: ChangeEvent<HTMLInputElement>) => setForm((atual) => ({ ...atual, [chave]: e.target.value })),
    }
  }

  return (
    <div className="detalhe-cliente-modal-fundo" onClick={onFechar}>
      <div className="detalhe-cliente-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Editar endereço</h2>

        <label>Identificação</label>
        <input {...campo('address_identification')} placeholder="Ex: Endereço padrão" />

        <label>Logradouro</label>
        <input {...campo('address')} placeholder="Rua, avenida…" />

        <div className="detalhe-cliente-modal-linha">
          <div>
            <label>Número</label>
            <input {...campo('address_number')} />
          </div>
          <div>
            <label>CEP</label>
            <input {...campo('address_zipcode')} />
          </div>
        </div>

        <label>Bairro</label>
        <input {...campo('address_neighborhood')} />

        <div className="detalhe-cliente-modal-linha">
          <div>
            <label>Cidade</label>
            <input {...campo('address_province')} />
          </div>
          <div>
            <label>UF</label>
            <input {...campo('address_state')} maxLength={2} />
          </div>
        </div>

        <label>Complemento</label>
        <input {...campo('address_completation')} />

        <label>Localização</label>
        <div className="detalhe-cliente-modal-localizacao">
          <span>
            {form.address_latitude && form.address_longitude
              ? `${form.address_latitude}, ${form.address_longitude}`
              : 'Ainda não capturada'}
          </span>
          <button
            type="button"
            className="detalhe-cliente-chip detalhe-cliente-chip-botao"
            disabled={capturandoLocalizacao}
            onClick={capturarLocalizacaoAtual}
          >
            <MdLocationOn size={14} /> {capturandoLocalizacao ? 'Capturando…' : 'Capturar localização atual'}
          </button>
        </div>

        <div className="detalhe-cliente-modal-acoes">
          <button onClick={onFechar}>Cancelar</button>
          <button className="detalhe-cliente-modal-btn-primario" disabled={salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalEditarTelefone({
  telefone,
  onFechar,
  onSalvo,
}: {
  telefone: TelefoneDto
  onFechar: () => void
  onSalvo: (telefone: TelefoneDto) => void
}) {
  const [numero, setNumero] = useState(telefone.phone_number ?? '')
  const [salvando, setSalvando] = useState(false)
  const { toast } = useToast()

  async function salvar() {
    if (!telefone.phone_pk) return
    setSalvando(true)
    try {
      // Reenvia o registro inteiro (identificação, operadora, tipo etc.)
      // como já veio carregado — só phone_number muda aqui (confirmado ao
      // vivo que o Controllr espera o telefone completo no update, ver
      // backend/app/routers/telefones.py).
      await atualizarTelefone(telefone.phone_pk, { ...telefone, phone_number: numero })
      onSalvo({ ...telefone, phone_number: numero })
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível salvar o telefone.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="detalhe-cliente-modal-fundo" onClick={onFechar}>
      <div className="detalhe-cliente-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Editar telefone{telefone.phone_identification ? ` — ${telefone.phone_identification}` : ''}</h2>

        <label>Número</label>
        <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 11912345678" />

        <div className="detalhe-cliente-modal-acoes">
          <button onClick={onFechar}>Cancelar</button>
          <button className="detalhe-cliente-modal-btn-primario" disabled={salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalAdicionarTelefone({
  clientPk,
  onFechar,
  onSalvo,
}: {
  clientPk: number
  onFechar: () => void
  onSalvo: () => void
}) {
  const [identificacao, setIdentificacao] = useState('')
  const [numero, setNumero] = useState('')
  const [salvando, setSalvando] = useState(false)
  const { toast } = useToast()

  async function salvar() {
    if (!identificacao.trim() || !numero.trim()) {
      toast('Preencha identificação e número.')
      return
    }
    setSalvando(true)
    try {
      await criarTelefone({ client_pk: clientPk, phone_identification: identificacao.trim(), phone_number: numero.trim() })
      onSalvo()
    } catch (excecao) {
      toast(excecao instanceof ApiError ? excecao.message : 'Não foi possível adicionar o telefone.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="detalhe-cliente-modal-fundo" onClick={onFechar}>
      <div className="detalhe-cliente-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Adicionar telefone</h2>

        <label>Identificação</label>
        <input value={identificacao} onChange={(e) => setIdentificacao(e.target.value)} placeholder="Ex: Celular, WhatsApp" />

        <label>Número</label>
        <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 11912345678" />

        <div className="detalhe-cliente-modal-acoes">
          <button onClick={onFechar}>Cancelar</button>
          <button className="detalhe-cliente-modal-btn-primario" disabled={salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
