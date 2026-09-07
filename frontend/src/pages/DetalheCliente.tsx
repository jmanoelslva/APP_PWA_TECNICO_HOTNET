import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MdBuild, MdDescription, MdEdit, MdLocationOn, MdPeopleAlt, MdRouter, MdWifi } from 'react-icons/md'
import {
  ApiError,
  atualizarEndereco,
  buscarDetalheCliente,
  listarTickets,
  type ContratoDto,
  type CpeComboDto,
  type EnderecoDto,
  type TicketDto,
} from '../api/client'
import VoltarInicio from '../components/VoltarInicio'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast/useToast'
import { CORES } from '../utils/cores'
import { formatarData, formatarStatusContrato } from '../utils/formatacao'
import './DetalheCliente.css'

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
  const [contratos, setContratos] = useState<ContratoDto[]>([])
  const [enderecos, setEnderecos] = useState<EnderecoDto[]>([])
  const [cpes, setCpes] = useState<CpeComboDto[]>([])
  const [chamados, setChamados] = useState<TicketDto[]>([])
  const [enderecoEditando, setEnderecoEditando] = useState<EnderecoDto | null>(null)

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
      setContratos(resposta.contratos)
      setEnderecos(resposta.enderecos)
      setCpes(resposta.cpes)
      // Histórico de chamados/OS do cliente — carregado à parte (endpoint
      // diferente) e sem travar o resto da tela se falhar, já que é
      // informação complementar, não o cadastro em si.
      listarTickets({ minhas: false, clientPk: pk, limit: 10 })
        .then((r) => setChamados(r.results))
        .catch(() => setChamados([]))
    } catch (excecao) {
      setErro(excecao instanceof ApiError ? excecao.message : 'Não foi possível carregar os dados do cliente.')
    } finally {
      setCarregando(false)
    }
  }

  if (!Number.isFinite(pk)) {
    return <p className="detalhe-cliente-status">Cliente não encontrado.</p>
  }

  return (
    <div className="detalhe-cliente-tela tela-entrada">
      <VoltarInicio to="/clientes" label="Clientes" />

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
            <h2>Contratos</h2>
            {contratos.length === 0 && <p className="detalhe-cliente-vazio">Nenhum contrato encontrado.</p>}
            {contratos.map((contrato) => (
              <div key={contrato.contract_pk} className="detalhe-cliente-item">
                <div className="detalhe-cliente-item-topo">
                  <strong>Contrato {contrato.contract_number ?? contrato.contract_pk}</strong>
                </div>
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
                    {contrato.itens.map((item, indice) => (
                      <div key={item.item_pk ?? indice} className="detalhe-cliente-itens-linha">
                        <span>{item.item_name ?? item.plan_name ?? 'Item'}</span>
                        {item.item_amount && <strong>R$ {item.item_amount}</strong>}
                      </div>
                    ))}
                  </div>
                )}
                {(contrato.contract_pk || contrato.contract_sign_doc_link) && (
                  <div className="detalhe-cliente-item-acoes">
                    {contrato.contract_pk && (
                      <Link to={`/conexao?contract_pk=${contrato.contract_pk}`} className="detalhe-cliente-chip" viewTransition>
                        <MdWifi size={14} /> Conexão
                      </Link>
                    )}
                    {contrato.contract_sign_doc_link && (
                      <a href={contrato.contract_sign_doc_link} target="_blank" rel="noreferrer" className="detalhe-cliente-chip">
                        <MdDescription size={14} /> Ver contrato
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
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
                {endereco.address_zipcode && <p>CEP: {endereco.address_zipcode}</p>}
              </div>
            ))}
          </section>

          <section className="detalhe-cliente-secao">
            <h2>Conexões (CPE)</h2>
            {cpes.length === 0 && <p className="detalhe-cliente-vazio">Nenhuma conexão encontrada.</p>}
            {cpes.map((cpe) => (
              <div key={cpe.cpe_pk} className="detalhe-cliente-item">
                <strong>{cpe.cpe_username ?? `CPE #${cpe.cpe_pk}`}</strong>
                {(cpe.contract_number ?? cpe.contract_pk) != null && <p>Contrato: {cpe.contract_number ?? cpe.contract_pk}</p>}
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
            ))}
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
