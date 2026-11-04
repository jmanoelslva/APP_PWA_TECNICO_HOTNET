import { useState, type CSSProperties } from 'react'
import './Abas.css'

export interface Aba<T extends string> {
  chave: T
  rotulo: string
}

/** Aba salva para esta tela (sessionStorage), ou a primeira se não houver/for inválida. */
export function lerAbaSalva<T extends string>(chaveArmazenamento: string, abas: Aba<T>[]): T {
  try {
    const salva = sessionStorage.getItem(chaveArmazenamento)
    const valida = abas.find((item) => item.chave === salva)
    return valida ? valida.chave : abas[0].chave
  } catch {
    return abas[0].chave
  }
}

/**
 * Aba escolhida numa tela, lembrada enquanto o app estiver aberto: troca de
 * cliente/OS/ONU e continua na mesma parte.
 */
export function useAbaLembrada<T extends string>(chaveArmazenamento: string, abas: Aba<T>[]): [T, (nova: T) => void] {
  const [aba, setAba] = useState<T>(() => lerAbaSalva(chaveArmazenamento, abas))
  function escolher(nova: T) {
    setAba(nova)
    try {
      sessionStorage.setItem(chaveArmazenamento, nova)
    } catch {
      // sem armazenamento: vale só nesta tela
    }
  }
  return [aba, escolher]
}

/**
 * Abas de uma tela (Conexão, OS, ONU, Cliente): trilho que gruda no topo ao
 * rolar, com a aba ativa em destaque na cor da área.
 */
export default function Abas<T extends string>({
  abas,
  ativa,
  onEscolher,
  cor,
  rotulo,
}: {
  abas: Aba<T>[]
  ativa: T
  onEscolher: (aba: T) => void
  /** Cor da área (CORES.*) para o contorno da aba ativa. */
  cor: string
  /** Nome do grupo para leitor de tela (ex.: "Partes da OS"). */
  rotulo: string
}) {
  return (
    <div className="abas" role="tablist" aria-label={rotulo} style={{ '--abas-cor': cor } as CSSProperties}>
      {abas.map((item) => (
        <button
          key={item.chave}
          type="button"
          role="tab"
          aria-selected={ativa === item.chave}
          className={`aba${ativa === item.chave ? ' ativa' : ''}`}
          onClick={() => onEscolher(item.chave)}
        >
          {item.rotulo}
        </button>
      ))}
    </div>
  )
}
