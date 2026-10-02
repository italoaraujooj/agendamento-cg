"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { ChevronDown, Search, Wrench } from "lucide-react"
import type { ManualTroubleshooting } from "@/lib/escalas/manual"
import { EmptyState } from "./empty-state"

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/** Problemas comuns: o problema é o título; a solução abre ao tocar */
export function TroubleshootingTab({ items }: { items: ManualTroubleshooting[] }) {
  const [query, setQuery] = useState("")

  if (items.length === 0) {
    return <EmptyState icon={Wrench} title="Nenhum problema cadastrado ainda" description="Quando o líder cadastrar os problemas mais comuns desta área, as soluções aparecem aqui." />
  }

  const q = normalize(query.trim())
  const filtered = q ? items.filter((i) => normalize(`${i.problem} ${i.solution}`).includes(q)) : items

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar (ex.: microfone, projetor)" className="pl-9" aria-label="Buscar problema" />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum problema encontrado para “{query}”.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <details key={item.id} className="group rounded-lg border bg-card open:border-primary/30" open={!!q && filtered.length <= 3}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 font-medium text-sm [&::-webkit-details-marker]:hidden">
                <span className="break-words">{item.problem}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t px-3 py-3 text-sm text-muted-foreground whitespace-pre-line break-words">{item.solution}</div>
            </details>
          ))}
        </div>
      )}
    </div>
  )
}
