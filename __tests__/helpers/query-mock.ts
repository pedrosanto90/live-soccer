import { vi } from 'vitest'

// Resultado de uma chamada à query (terminal awaited, .single()/.maybeSingle()
// ou leitura de `count` em queries com head:true).
export type QueryResult = { data?: unknown; count?: number; error?: unknown }

// Métodos de encadeamento do builder do Supabase usados pelas queries.
const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'delete',
  'upsert',
  'eq',
  'neq',
  'in',
  'is',
  'not',
  'or',
  'ilike',
  'gte',
  'lte',
  'order',
  'limit',
]

// Constrói um cliente Supabase "thenable": o builder real é encadeável e, ao
// mesmo tempo, aguardável (PromiseLike). Cada chamada a `from()` consome o
// próximo resultado da fila, por ordem determinística — incluindo as chamadas
// feitas por funções aninhadas que voltam a chamar `createClient()` (a fila é
// partilhada porque `createClient` devolve sempre o mesmo cliente).
export function queryClient(results: QueryResult[]) {
  let i = 0
  const make = () => {
    const result = results[i++] ?? { data: null, count: 0, error: null }
    const b: Record<string, unknown> = {}
    for (const m of CHAIN_METHODS) b[m] = vi.fn(() => b)
    b.maybeSingle = vi.fn().mockResolvedValue(result)
    b.single = vi.fn().mockResolvedValue(result)
    b.then = (
      resolve: (v: QueryResult) => unknown,
      reject?: (e: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject)
    return b
  }
  return { from: vi.fn(make) }
}
