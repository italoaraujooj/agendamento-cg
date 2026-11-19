import type { PostgrestError } from "@supabase/supabase-js"

const PAGE_SIZE = 1000

/**
 * Busca todas as linhas de uma consulta, página por página.
 *
 * O Supabase devolve no máximo 1.000 linhas por consulta; listas que crescem
 * com o período (respostas de disponibilidade, escalações) passam disso em
 * períodos de vários meses. `build` deve criar a consulta do zero a cada
 * chamada e ordenar por uma chave única, para as páginas não se repetirem.
 *
 * Em caso de erro, devolve `data: null`: nunca um resultado parcial.
 */
export async function fetchAll<T>(
  build: () => {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
  }
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null }
  }
}
