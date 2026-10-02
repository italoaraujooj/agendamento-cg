"use client"

import { useCallback, useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { GENERAL, type PickerMinistry } from "./area-picker"

interface AreasResponse {
  ministries: PickerMinistry[]
  mine: { ministryId: string; areaId: string }[]
  managed: string[]
  isAdmin: boolean
}

/**
 * Ministério/área escolhidos no manual, guardados na URL (?ministry_id=&area_id=)
 * para o link poder ser compartilhado. Sem parâmetros, abre na área em que a
 * pessoa serve (ou, na edição, no primeiro ministério que ela gerencia).
 */
export function useManualScope({ managedOnly = false } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const [data, setData] = useState<AreasResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/escalas/manual/areas")
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error || "Erro ao carregar")
        setData(json)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar"))
  }, [])

  const ministries = data
    ? managedOnly
      ? data.ministries.filter((m) => data.managed.includes(m.id))
      : data.ministries
    : []

  const paramMinistry = search.get("ministry_id")
  const paramArea = search.get("area_id")

  let ministryId: string | null = null
  let areaId = GENERAL
  if (data) {
    const fromParam = ministries.find((m) => m.id === paramMinistry)
    if (fromParam) {
      ministryId = fromParam.id
      areaId = paramArea && fromParam.areas.some((a) => a.id === paramArea) ? paramArea : paramArea === GENERAL ? GENERAL : fromParam.areas[0]?.id ?? GENERAL
    } else {
      const mine = data.mine.find((x) => ministries.some((m) => m.id === x.ministryId))
      if (mine) {
        ministryId = mine.ministryId
        areaId = mine.areaId
      } else if (managedOnly && ministries[0]) {
        ministryId = ministries[0].id
        areaId = ministries[0].areas[0]?.id ?? GENERAL
      }
    }
  }

  const setScope = useCallback(
    (m: string, a: string) => {
      const params = new URLSearchParams(search.toString())
      params.set("ministry_id", m)
      params.set("area_id", a)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, search]
  )

  return {
    loading: !data && !error,
    error,
    ministries,
    ministryId,
    areaId,
    setScope,
    isMyArea: !!data?.mine.some((x) => x.areaId === areaId),
  }
}
