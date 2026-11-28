// As 12 cores de fibra do código ABNT (12 fibras por tubo), na ordem da
// norma, com o hex que a paleta do painel do Controllr já usa. O servidor
// (routers/dp.py, CORES_ABNT) só aceita estes valores.

export interface CorFibra {
  numero: number
  nome: string
  hex: string
}

export const CORES_FIBRA: CorFibra[] = [
  { numero: 1, nome: 'Verde', hex: '#00FF00' },
  { numero: 2, nome: 'Amarelo', hex: '#FFFF00' },
  { numero: 3, nome: 'Branco', hex: '#FFFFFF' },
  { numero: 4, nome: 'Azul', hex: '#0000FF' },
  { numero: 5, nome: 'Vermelho', hex: '#FF0000' },
  { numero: 6, nome: 'Violeta', hex: '#AA00FF' },
  { numero: 7, nome: 'Marrom', hex: '#AA5500' },
  { numero: 8, nome: 'Rosa', hex: '#FF55FF' },
  { numero: 9, nome: 'Preto', hex: '#000000' },
  { numero: 10, nome: 'Cinza', hex: '#808080' },
  { numero: 11, nome: 'Laranja', hex: '#FF8000' },
  { numero: 12, nome: 'Aqua', hex: '#00FFFF' },
]

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Cor ABNT mais próxima de um hex qualquer. As CTOs antigas tiveram a cor
 * escolhida à mão no painel, com o tom um pouco diferente (ex.: #55FF00 é
 * o verde, #0055FF o azul). Compara pelo matiz, como o olho separa as cores
 * das fibras: sem cor (cinza) decide pelo brilho; laranja e marrom têm o
 * mesmo matiz e se separam pelo brilho.
 */
export function corMaisProxima(hex: string | null | undefined): CorFibra | null {
  const alvo = hex ? rgb(hex) : null
  if (!alvo) return null
  const [r, g, b] = alvo.map((c) => c / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const v = max
  const s = max === 0 ? 0 : (max - min) / max
  const pelaCor = (nome: string) => CORES_FIBRA.find((c) => c.nome === nome) as CorFibra
  if (s < 0.2 || v < 0.2) return pelaCor(v < 0.25 ? 'Preto' : v > 0.85 ? 'Branco' : 'Cinza')
  const d = max - min
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h = (h * 60 + 360) % 360
  const matizes: [string, number][] = [
    ['Vermelho', 0], ['Laranja', 30], ['Amarelo', 60], ['Verde', 120], ['Aqua', 180],
    ['Azul', 240], ['Violeta', 280], ['Rosa', 310], ['Vermelho', 360],
  ]
  let nome = 'Vermelho'
  let menor = Infinity
  for (const [n, m] of matizes) {
    const dist = Math.abs(h - m)
    if (dist < menor) {
      menor = dist
      nome = n
    }
  }
  if (nome === 'Laranja' && v < 0.75) nome = 'Marrom'
  return pelaCor(nome)
}

/** Ocupação da CTO para a cor do ponto no mapa e da lista. */
export type Ocupacao = 'livre' | 'pouca' | 'lotada' | 'desconhecida'

export function ocupacaoDaCto(dp: { limite: number | null; ativos: number | null }): Ocupacao {
  if (!dp.limite || dp.ativos == null) return 'desconhecida'
  const livres = dp.limite - dp.ativos
  if (livres <= 0) return 'lotada'
  return livres <= 2 ? 'pouca' : 'livre'
}

export const COR_OCUPACAO: Record<Ocupacao, string> = {
  livre: '#2fb344',
  pouca: '#f5b800',
  lotada: '#d93025',
  desconhecida: '#8a939e',
}
