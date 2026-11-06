import type { ReactNode } from 'react'
import { LuCircleAlert, LuCircleCheck, LuCircleX, LuLoaderCircle } from 'react-icons/lu'
import type { ItemFechamento, SituacaoFechamento } from '../utils/fechamentoOs'
import './ProntoParaFechar.css'

const ICONE: Record<SituacaoFechamento, ReactNode> = {
  ok: <LuCircleCheck size={22} aria-label="Certo" />,
  atencao: <LuCircleAlert size={22} aria-label="Atenção" />,
  pendente: <LuCircleX size={22} aria-label="Pendente" />,
  verificando: <LuLoaderCircle size={22} aria-label="Consultando" />,
}

/**
 * Quadro "Pronto para fechar" da OS: cada item certo fica verde; o que
 * falta vem com o atalho para corrigir (`acao`, montado por quem chama).
 */
export default function ProntoParaFechar({
  itens,
  acao,
}: {
  itens: ItemFechamento[]
  acao: (item: ItemFechamento) => ReactNode
}) {
  const certos = itens.filter((item) => item.situacao === 'ok').length
  return (
    <div className="pronto-fechar">
      <div className="pronto-fechar-topo">
        <h2>Pronto para fechar</h2>
        <span className={certos === itens.length ? 'completo' : undefined}>
          {certos} de {itens.length}
        </span>
      </div>
      <ul>
        {itens.map((item) => (
          <li key={item.chave} className={`pronto-fechar-item ${item.situacao}`}>
            <span className="pronto-fechar-icone">{ICONE[item.situacao]}</span>
            <span className="item-duas-linhas">
              <strong>{item.rotulo}</strong>
              <small>{item.detalhe}</small>
            </span>
            {item.situacao !== 'ok' && item.situacao !== 'verificando' && acao(item)}
          </li>
        ))}
      </ul>
    </div>
  )
}
