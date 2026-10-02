/**
 * Manual de Serviço: tipos e helpers compartilhados entre APIs e telas.
 */

export interface ManualChecklistItem {
  id: string
  ministry_id: string
  area_id: string | null
  section: string | null
  title: string
  details: string | null
  order_index: number
  is_active: boolean
}

export interface ManualTroubleshooting {
  id: string
  ministry_id: string
  area_id: string | null
  problem: string
  solution: string
  order_index: number
  is_active: boolean
}

export interface ManualVideo {
  id: string
  ministry_id: string
  area_id: string | null
  title: string
  url: string
  description: string | null
  order_index: number
  is_active: boolean
}

export interface ManualSuggestion {
  id: string
  ministry_id: string
  area_id: string | null
  section: string | null
  title: string
  details: string | null
  status: "pending" | "approved" | "rejected"
  review_note: string | null
  created_at: string
  suggested_by?: string
  suggested_by_name?: string | null
  area_name?: string | null
}

export interface ManualData {
  checklist: ManualChecklistItem[]
  troubleshooting: ManualTroubleshooting[]
  videos: ManualVideo[]
  /** ids dos passos marcados hoje pelo usuário */
  doneToday: string[]
  /** Sugestões do próprio usuário ainda aguardando aprovação */
  mySuggestions: ManualSuggestion[]
  canManage: boolean
}

export type ManualKind = "checklist" | "troubleshooting" | "videos"

export const MANUAL_TABLES: Record<ManualKind, string> = {
  checklist: "manual_checklist_items",
  troubleshooting: "manual_troubleshooting",
  videos: "manual_videos",
}

/** Hoje no fuso de Brasília (YYYY-MM-DD): as marcações do checklist zeram a cada dia */
export const todayBr = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)

/** Id do vídeo do YouTube (watch, youtu.be, shorts, embed) ou null */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\.|^m\./, "")
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v")
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,})/)
      if (m) return m[1]
    }
  } catch {
    // URL inválida
  }
  return null
}

/** Agrupa os passos por seção, mantendo a ordem de aparição */
export function groupBySection(items: ManualChecklistItem[]) {
  const groups: { section: string | null; items: ManualChecklistItem[] }[] = []
  for (const item of items) {
    const key = item.section?.trim() || null
    let g = groups.find((x) => x.section === key)
    if (!g) {
      g = { section: key, items: [] }
      groups.push(g)
    }
    g.items.push(item)
  }
  return groups
}
