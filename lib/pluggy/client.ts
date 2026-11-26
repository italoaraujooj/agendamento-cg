/**
 * Cliente mínimo da API Pluggy (Open Finance via MeuPluggy).
 *
 * Usado só para ler as entradas de PIX da conta que recebe as inscrições
 * da confraternização. Env: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e
 * PLUGGY_ACCOUNT_ID (a conta corrente da conexão MeuPluggy).
 */

const BASE = "https://api.pluggy.ai"

interface PluggyParty {
  name?: string | null
  documentNumber?: { type?: string; value?: string } | null
}

export interface PluggyTransaction {
  id: string
  accountId: string
  date: string
  description: string
  amount: number
  type: "DEBIT" | "CREDIT"
  status: "POSTED" | "PENDING"
  paymentData?: {
    payer?: PluggyParty | null
    receiver?: PluggyParty | null
    paymentMethod?: string | null
  } | null
}

export const isPluggyConfigured = () =>
  !!process.env.PLUGGY_CLIENT_ID && !!process.env.PLUGGY_CLIENT_SECRET && !!process.env.PLUGGY_ACCOUNT_ID

let cached: { key: string; expires: number } | null = null

async function apiKey(): Promise<string> {
  if (cached && cached.expires > Date.now()) return cached.key
  const res = await fetch(`${BASE}/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.PLUGGY_CLIENT_ID,
      clientSecret: process.env.PLUGGY_CLIENT_SECRET,
    }),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`Pluggy auth falhou (${res.status})`)
  const { apiKey } = (await res.json()) as { apiKey: string }
  // A chave vale 2h; renovamos com folga
  cached = { key: apiKey, expires: Date.now() + 90 * 60 * 1000 }
  return apiKey
}

async function call<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-API-KEY": await apiKey(), "content-type": "application/json" },
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Pluggy GET ${path.split("?")[0]} → ${res.status}: ${body.slice(0, 200)}`)
  }
  return (await res.json()) as T
}

/** GET /v2/transactions com paginação por cursor (`next` é a query string pronta). */
export async function listTransactions(accountId: string, dateFrom: string): Promise<PluggyTransaction[]> {
  const out: PluggyTransaction[] = []
  let query: string | null = `?accountId=${encodeURIComponent(accountId)}&dateFrom=${dateFrom}`
  for (let guard = 0; query && guard < 100; guard++) {
    const page: { results: PluggyTransaction[]; next: string | null } = await call(`/v2/transactions${query}`)
    out.push(...page.results)
    query = page.next
  }
  return out
}
