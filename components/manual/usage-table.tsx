"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Users } from "lucide-react"
import { format, parseISO } from "date-fns"
import { plural } from "@/lib/plural"
import { EmptyState } from "./empty-state"

interface UsagePerson {
  user_id: string
  name: string
  last_used_on: string
  days_used: number
  areas: string[]
}

/** Quem usa o manual do ministério — sem mostrar o que cada um marcou */
export function UsageTable({ ministryId }: { ministryId: string }) {
  const [data, setData] = useState<{ days: number; people: UsagePerson[] } | null>(null)

  useEffect(() => {
    setData(null)
    fetch(`/api/escalas/manual/usage?ministry_id=${ministryId}&days=90`)
      .then((r) => (r.ok ? r.json() : { days: 90, people: [] }))
      .then(setData)
      .catch(() => setData({ days: 90, people: [] }))
  }, [ministryId])

  if (!data) return <Skeleton className="h-32 w-full" />
  if (data.people.length === 0) {
    return <EmptyState icon={Users} title="Ninguém usou o manual ainda" description={`Nos últimos ${data.days} dias ninguém abriu o manual deste ministério.`} />
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {plural(data.people.length, "pessoa usou", "pessoas usaram")} o manual nos últimos {data.days} dias. As marcações de cada um são privadas.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Pessoa</th>
              <th className="px-3 py-2 font-medium">Último acesso</th>
              <th className="px-3 py-2 font-medium text-right">Dias de uso</th>
              <th className="px-3 py-2 font-medium hidden sm:table-cell">Áreas</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.people.map((p) => (
              <tr key={p.user_id}>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2 tabular-nums">{format(parseISO(p.last_used_on), "dd/MM/yyyy")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.days_used}</td>
                <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{p.areas.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
