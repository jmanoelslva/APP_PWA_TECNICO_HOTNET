import { useState, type ChangeEvent, type CSSProperties } from 'react'
import { MdLocationOn } from 'react-icons/md'
import { ApiError, atualizarEndereco, type EnderecoDto } from '../api/client'
import { useToast } from './Toast/useToast'
import './ModalEditarEndereco.css'

interface Props {
  endereco: EnderecoDto
  // Cor de destaque do botão "Salvar" (token de CORES, ex: CORES.cliente) —
  // cada tela que usa este modal (Detalhe do Cliente, Detalhe da OS) tem
  // sua própria cor de identidade; sem isso o botão ficaria sempre com a
  // cor do cliente, mesmo aberto a partir da tela da OS.
  corDestaque?: string
  onFechar: () => void
  onSalvo: (endereco: EnderecoDto) => void
}

export default function ModalEditarEndereco({ endereco, corDestaque, onFechar, onSalvo }: Props) {
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

  const estilo = corDestaque ? ({ '--modal-endereco-cor-destaque': corDestaque } as CSSProperties) : undefined

  return (
    <div className="modal-editar-endereco-fundo" onClick={onFechar}>
      <div className="modal-editar-endereco" style={estilo} onClick={(e) => e.stopPropagation()}>
        <h2>Editar endereço</h2>

        <label>Identificação</label>
        <input {...campo('address_identification')} placeholder="Ex: Endereço padrão" />

        <label>Logradouro</label>
        <input {...campo('address')} placeholder="Rua, avenida…" />

        <div className="modal-editar-endereco-linha">
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

        <div className="modal-editar-endereco-linha">
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
        <div className="modal-editar-endereco-localizacao">
          <span>
            {form.address_latitude && form.address_longitude
              ? `${form.address_latitude}, ${form.address_longitude}`
              : 'Ainda não capturada'}
          </span>
          <button
            type="button"
            className="modal-editar-endereco-chip"
            disabled={capturandoLocalizacao}
            onClick={capturarLocalizacaoAtual}
          >
            <MdLocationOn size={14} /> {capturandoLocalizacao ? 'Capturando…' : 'Capturar localização atual'}
          </button>
        </div>

        <div className="modal-editar-endereco-acoes">
          <button onClick={onFechar}>Cancelar</button>
          <button className="modal-editar-endereco-btn-primario" disabled={salvando} onClick={salvar}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
