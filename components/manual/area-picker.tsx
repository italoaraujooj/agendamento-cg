"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface PickerMinistry {
  id: string
  name: string
  color: string
  areas: { id: string; name: string }[]
}

export const GENERAL = "general"

interface AreaPickerProps {
  ministries: PickerMinistry[]
  ministryId: string | null
  areaId: string
  onChange: (ministryId: string, areaId: string) => void
  /** Rótulo da opção sem área */
  generalLabel?: string
}

/** Seletor de ministério + área (ou o manual geral do ministério) */
export function AreaPicker({ ministries, ministryId, areaId, onChange, generalLabel = "Geral do ministério" }: AreaPickerProps) {
  const ministry = ministries.find((m) => m.id === ministryId)

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Select
        value={ministryId ?? ""}
        onValueChange={(id) => {
          const m = ministries.find((x) => x.id === id)
          onChange(id, m?.areas[0]?.id ?? GENERAL)
        }}
      >
        <SelectTrigger aria-label="Ministério" className="w-full">
          <SelectValue placeholder="Escolha o ministério" />
        </SelectTrigger>
        <SelectContent>
          {ministries.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                {m.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={areaId} onValueChange={(id) => ministryId && onChange(ministryId, id)} disabled={!ministry}>
        <SelectTrigger aria-label="Área" className="w-full">
          <SelectValue placeholder="Escolha a área" />
        </SelectTrigger>
        <SelectContent>
          {ministry?.areas.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
          <SelectItem value={GENERAL}>{generalLabel}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
