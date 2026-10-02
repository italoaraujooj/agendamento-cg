"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BookOpen, ListChecks, Pencil, PlayCircle, Wrench } from "lucide-react"
import { AreaPicker } from "@/components/manual/area-picker"
import { useManualScope } from "@/components/manual/use-manual-scope"
import { ChecklistTab } from "@/components/manual/checklist-tab"
import { TroubleshootingTab } from "@/components/manual/troubleshooting-tab"
import { VideosTab } from "@/components/manual/videos-tab"
import { EmptyState } from "@/components/manual/empty-state"
import type { ManualData } from "@/lib/escalas/manual"

export default function ManualPage() {
  return (
    <Suspense fallback={<ManualSkeleton />}>
      <Manual />
    </Suspense>
  )
}

function Manual() {
  const scope = useManualScope()
  const [data, setData] = useState<ManualData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState("checklist")
  const { ministryId, areaId } = scope

  useEffect(() => {
    if (!ministryId) return
    let cancelled = false
    setData(null)
    setError(null)
    fetch(`/api/escalas/manual?ministry_id=${ministryId}&area_id=${areaId}`)
      .then(async (r) => {
        const json = await r.json()
        if (!r.ok) throw new Error(json.error || "Erro ao carregar o manual")
        if (!cancelled) setData(json)
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Erro ao carregar o manual"))
    return () => {
      cancelled = true
    }
  }, [ministryId, areaId])

  const counts = data && {
    checklist: data.checklist.length,
    troubleshooting: data.troubleshooting.length,
    videos: data.videos.length,
  }

  return (
    <div className="container max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Manual de Serviço</h1>
          <p className="text-sm text-muted-foreground">Passo a passo, solução de problemas e vídeos de cada área.</p>
        </div>
        {data?.canManage && ministryId && (
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={`/admin-escalas/manual?ministry_id=${ministryId}&area_id=${areaId}`}>
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Editar manual</span>
            </Link>
          </Button>
        )}
      </div>

      {scope.loading ? (
        <ManualSkeleton inline />
      ) : scope.error ? (
        <p className="text-sm text-destructive">{scope.error}</p>
      ) : (
        <>
          <AreaPicker ministries={scope.ministries} ministryId={ministryId} areaId={areaId} onChange={scope.setScope} />

          {!ministryId ? (
            <EmptyState icon={BookOpen} title="Escolha um ministério" description="Selecione o ministério e a área para ver o manual." />
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <Tabs value={tab} onValueChange={setTab} className="gap-4">
              <TabsList className="grid w-full grid-cols-3 h-auto">
                <TabsTrigger value="checklist" className="flex-col sm:flex-row gap-1 py-2">
                  <ListChecks className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">Checklist{counts ? ` (${counts.checklist})` : ""}</span>
                </TabsTrigger>
                <TabsTrigger value="troubleshooting" className="flex-col sm:flex-row gap-1 py-2">
                  <Wrench className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">
                    <span className="sm:hidden">Problemas</span>
                    <span className="hidden sm:inline">Solução de problemas</span>
                    {counts ? ` (${counts.troubleshooting})` : ""}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="videos" className="flex-col sm:flex-row gap-1 py-2">
                  <PlayCircle className="h-4 w-4" />
                  <span className="text-xs sm:text-sm">Vídeos{counts ? ` (${counts.videos})` : ""}</span>
                </TabsTrigger>
              </TabsList>

              {!data ? (
                <ManualSkeleton inline />
              ) : (
                <>
                  <TabsContent value="checklist">
                    <ChecklistTab
                      items={data.checklist}
                      doneToday={data.doneToday}
                      mySuggestions={data.mySuggestions}
                      ministryId={ministryId}
                      areaId={areaId}
                      onDoneChange={(doneToday) => setData((d) => (d ? { ...d, doneToday } : d))}
                      onSuggested={(s) => setData((d) => (d ? { ...d, mySuggestions: [...d.mySuggestions, s] } : d))}
                    />
                  </TabsContent>
                  <TabsContent value="troubleshooting">
                    <TroubleshootingTab items={data.troubleshooting} />
                  </TabsContent>
                  <TabsContent value="videos">
                    <VideosTab items={data.videos} />
                  </TabsContent>
                </>
              )}
            </Tabs>
          )}
        </>
      )}
    </div>
  )
}

function ManualSkeleton({ inline = false }: { inline?: boolean }) {
  const body = (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-14 w-full rounded-lg" />
    </div>
  )
  return inline ? body : <div className="container max-w-3xl mx-auto px-4 py-8">{body}</div>
}
