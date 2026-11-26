/**
 * Casamento entre PIX recebidos e inscrições/doações pendentes.
 *
 * Regra: valor exato E nome do pagador batendo com algum nome da inscrição
 * (participantes ou "quem vai pagar"). Valor sem nome, ou um PIX que serve
 * para mais de uma inscrição, não confirma: vira sugestão para revisão.
 *
 * Funções puras: sem banco nem rede, para testar isoladamente.
 */

export interface IncomingPix {
  id: string
  /** AAAA-MM-DD */
  date: string
  amount: number
  /** Nome do pagador informado pelo banco (paymentData.payer.name) */
  payerName: string | null
  description: string
}

export interface PendingCharge {
  kind: "registration" | "donation"
  id: string
  amount: number
  /** Nomes que podem aparecer como pagador */
  names: string[]
  /** AAAA-MM-DD (Brasília): o PIX não pode ser anterior à inscrição */
  createdDate: string
}

export interface PixMatch {
  pix: IncomingPix
  charge: PendingCharge
}

export interface PixSuggestion {
  pix: IncomingPix
  /** Pendências com o mesmo valor (e, se ambíguo, também o nome) */
  candidates: PendingCharge[]
  reason: "amount_only" | "ambiguous"
}

const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e"])

/** Palavras que os bancos põem na descrição do PIX e não fazem parte do nome. */
const PIX_NOISE = new Set([
  "pix", "recebido", "recebida", "receb", "transferencia", "transf", "ted", "doc",
  "rem", "remetente", "de", "credito", "cred", "pagamento", "pgto", "qr", "code",
])

export function nameTokens(value: string | null | undefined): string[] {
  if (!value) return []
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t))
}

/** Tokens iguais, ou um é o começo do outro com 3+ letras (bancos truncam nomes). */
function tokenMatches(a: string, b: string) {
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= 3 && long.startsWith(short)
}

/**
 * O pagador corresponde ao nome cadastrado se o primeiro nome aparece e,
 * depois dele, aparece também outro nome (sobrenome) do cadastro.
 * Só o primeiro nome não basta: "Maria" casaria com metade da igreja.
 */
export function namesMatch(payer: string | null | undefined, candidate: string | null | undefined) {
  const p = nameTokens(payer).filter((t) => !PIX_NOISE.has(t))
  const c = nameTokens(candidate)
  if (p.length < 2 || c.length < 2) return false

  for (let i = 0; i < p.length; i++) {
    if (p[i] !== c[0]) continue
    const rest = c.slice(1)
    if (p.slice(i + 1).some((pt) => rest.some((ct) => tokenMatches(pt, ct)))) return true
  }
  return false
}

const cents = (v: number) => Math.round(v * 100)

function payerMatchesCharge(pix: IncomingPix, charge: PendingCharge) {
  // O nome estruturado do banco é a fonte principal; a descrição cobre
  // bancos que só mandam "PIX RECEBIDO - FULANO DE TAL".
  const sources = [pix.payerName, pix.description]
  return charge.names.some((name) => sources.some((src) => namesMatch(src, name)))
}

export function findMatches(pixes: IncomingPix[], pending: PendingCharge[]) {
  const matches: PixMatch[] = []
  const suggestions: PixSuggestion[] = []
  const used = new Set<string>()

  const ordered = [...pixes].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  for (const pix of ordered) {
    const sameAmount = pending.filter(
      (c) => !used.has(c.id) && cents(c.amount) === cents(pix.amount) && pix.date >= c.createdDate
    )
    if (sameAmount.length === 0) continue

    const byName = sameAmount.filter((c) => payerMatchesCharge(pix, c))
    if (byName.length === 1) {
      used.add(byName[0].id)
      matches.push({ pix, charge: byName[0] })
    } else if (byName.length > 1) {
      suggestions.push({ pix, candidates: byName, reason: "ambiguous" })
    } else {
      suggestions.push({ pix, candidates: sameAmount, reason: "amount_only" })
    }
  }

  // Uma pendência confirmada por outro PIX não precisa mais aparecer como sugestão
  const open = suggestions
    .map((s) => ({ ...s, candidates: s.candidates.filter((c) => !used.has(c.id)) }))
    .filter((s) => s.candidates.length > 0)

  return { matches, suggestions: open }
}
