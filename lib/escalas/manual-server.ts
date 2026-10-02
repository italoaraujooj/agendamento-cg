import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { todayBr } from "./manual"

/** "general" (ou vazio) = manual do ministério inteiro; senão o id da área */
export const scopeSchema = z.object({
  ministry_id: z.string().uuid(),
  area_id: z.union([z.string().uuid(), z.literal("general"), z.null()]).optional(),
})

export const normalizeArea = (area: string | null | undefined) =>
  !area || area === "general" ? null : area

/** A área informada pertence ao ministério? (null = manual geral, sempre válido) */
export async function areaBelongsTo(supabase: SupabaseClient, ministryId: string, areaId: string | null) {
  if (!areaId) return true
  const { data } = await supabase.from("areas").select("ministry_id").eq("id", areaId).maybeSingle()
  return data?.ministry_id === ministryId
}

/** Registra que a pessoa usou o manual hoje (um registro por pessoa, área e dia) */
export async function recordUsage(
  supabase: SupabaseClient,
  userId: string,
  ministryId: string,
  areaId: string | null
) {
  const { error } = await supabase.from("manual_usage").upsert(
    { user_id: userId, ministry_id: ministryId, area_id: areaId, scope_id: areaId ?? ministryId, used_on: todayBr() },
    { onConflict: "user_id,scope_id,used_on", ignoreDuplicates: true }
  )
  if (error) console.error("Erro ao registrar uso do manual:", error)
}
