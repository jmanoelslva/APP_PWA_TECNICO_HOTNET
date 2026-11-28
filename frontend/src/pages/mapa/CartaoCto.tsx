import { useState } from 'react'
import { LuCheck, LuGrid3X3, LuNavigation, LuPencil, LuX } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import type { CpeDto, DpDto } from '../../api/client'
import { corMaisProxima } from '../../utils/coresFibra'
import { formatarDistancia } from '../conexao/localizacao'
import PortasCto from '../conexao/PortasCto'
import './CartaoCto.css'

export interface ConexaoDoCliente {
  cpePk: number
  pppoe: string | null
}

/**
 * CTO tocada no Mapa de CTOs: ocupação, distância, conexões, rota, grade de
 * portas e, com um cliente buscado, "Usar esta CTO" (abre a Conexão dele na
 * aba CTO já com a CTO e a porta escolhidas, faltando só salvar).
 */
export default function CartaoCto({
  dp,
  distanciaM,
  cpesDaCto,
  conexoesCliente,
  nomeCliente,
  flutuante = false,
  onFechar,
  onEditar,
}: {
  dp: DpDto
  distanciaM: number | null
  cpesDaCto: CpeDto[] | null
  conexoesCliente: ConexaoDoCliente[]
  nomeCliente: string | null
  // Por cima do mapa em tela cheia.
  flutuante?: boolean
  onFechar: () => void
  onEditar: () => void
}) {
  const navigate = useNavigate()
  const [portasAbertas, setPortasAbertas] = useState(false)
  const [porta, setPorta] = useState('')
  const livres = dp.limite != null && dp.ativos != null ? dp.limite - dp.ativos : null
  const fibra = corMaisProxima(dp.cor)
  const online = cpesDaCto?.filter((cpe) => (cpe.sessions ?? 0) > 0).length ?? null
  const rota =
    dp.lat != null && dp.lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${dp.lat}%2C${dp.lng}` : null

  function usar(conexao: ConexaoDoCliente) {
    const portaParam = porta ? `&porta=${encodeURIComponent(porta)}` : ''
    navigate(`/conexao?cpe_pk=${conexao.cpePk}&aba=cto&dp=${dp.pk}${portaParam}`, { viewTransition: true })
  }

  return (
    <div className={`cartao-cto${flutuante ? ' cartao-cto-flutuante' : ''}`}>
      <div className="cartao-cto-topo">
        <i style={{ background: fibra?.hex ?? '#555555' }} aria-hidden="true" />
        <span className="cartao-cto-nome">
          <strong>{dp.name}</strong>
          <span>
            {dp.limite != null && dp.ativos != null ? `${dp.ativos}/${dp.limite} portas · ` : ''}
            {livres != null && (
              <b className={livres <= 0 ? 'mapa-ctos-lotada' : livres <= 2 ? 'cartao-cto-pouca' : 'mapa-ctos-livres'}>
                {livres <= 0 ? 'Lotada' : livres === 1 ? '1 livre' : `${livres} livres`}
              </b>
            )}
            {fibra && ` · ${fibra.nome}`}
          </span>
          <span>
            {distanciaM != null && `${formatarDistancia(distanciaM)} em linha reta`}
            {online != null && cpesDaCto && ` · ${online} online, ${cpesDaCto.length - online} offline`}
          </span>
        </span>
        <button type="button" className="botao-icone botao-icone-fantasma" onClick={onFechar} aria-label="Fechar a CTO">
          <LuX size={20} />
        </button>
      </div>

      <div className="cartao-cto-acoes">
        {rota && (
          <a className="botao botao-secundario acao-ir" href={rota} target="_blank" rel="noopener noreferrer">
            <LuNavigation size={18} /> Rota
          </a>
        )}
        {!flutuante && (
          <button type="button" className="botao botao-secundario acao-rede" onClick={() => setPortasAbertas((v) => !v)}>
            <LuGrid3X3 size={18} /> {portasAbertas ? 'Ocultar portas' : 'Ver portas'}
          </button>
        )}
        <button type="button" className="botao botao-secundario" onClick={onEditar}>
          <LuPencil size={18} /> Editar
        </button>
      </div>

      {portasAbertas && !flutuante && (
        <PortasCto
          dpPk={dp.pk}
          limite={dp.limite}
          porta={porta}
          cpePk={conexoesCliente.length === 1 ? conexoesCliente[0].cpePk : undefined}
          onEscolherPorta={setPorta}
        />
      )}

      {!flutuante &&
        nomeCliente &&
        conexoesCliente.map((conexao) => (
          <button key={conexao.cpePk} type="button" className="botao botao-primario botao-largo" onClick={() => usar(conexao)}>
            <LuCheck size={18} />
            {`Usar ${porta ? `porta ${porta}` : 'esta CTO'}${conexoesCliente.length > 1 && conexao.pppoe ? ` em ${conexao.pppoe}` : ''}`}
          </button>
        ))}
      {!flutuante && !nomeCliente && <p className="cartao-cto-nota">Busque um cliente para usar esta CTO na conexão dele.</p>}
    </div>
  )
}
