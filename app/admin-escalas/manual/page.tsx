"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, BookOpen, Eye, Inbox, ListChecks, PlayCircle, Users, Wrench } from "lucide-react"
import { AreaPicker, GENERAL } from "@/components/manual/area-picker"
import { useManualScope } from "@/components/manual/use-manual-scope"
import { ManualEditor } from "@/components/manual/manual-editor"
import { SuggestionsPanel } from "@/components/manual/suggestions-panel"
import { UsageTable } from "@/components/manual/usage-table"
import { EmptyState } from "@/components/manual/empty-state"

export default function ManualEditorPage() {
  return (
    <Suspense fallback={<div className="container max-w-4xl mx-auto px-4 py-8"><Skeleton className="h-40 w-full" /></div>}>
      <Editor />
    </Suspense>
  )
}

const TABS = ["checklist", "problemas", "videos", "sugestoes", "uso"] as const

function Editor() {
  const scope = useManualScope({ managedOnly: true })
  const search = useSearchParams()
  const initialTab = search.get("tab")
  const [tab, setTab] = useState<string>(TABS.includes(initialTab as any) ? initialTab! : "checklist")
  const [pending, setPending] = useState<number | null>(null)
  const { ministryId, areaId } = scope

  // Contador de sugestões no rótulo da aba, mesmo antes de abri-la
  useEffect(() => {
    if (!ministryId) return
    fetch(`/api/escalas/manual/suggestions?ministry_id=${ministryId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setPending(list.length))
      .catch(() => setPending(null))
  }, [ministryId])

  const ministry = scope.ministries.find((m) => m.id === ministryId)
  const areaName = areaId === GENERAL ? "Geral do ministério (aparece em todas as áreas)" : ministry?.areas.find((a) => a.id === areaId)?.name ?? ""
  const scopeLabel = ministry ? `${ministry.name} · ${areaName}` : ""

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link href="/admin-escalas" className="inline-flex items-center gap-2 text-sm font-medium hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Voltar para Admin
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Editar Manual de Serviço</h1>
          <p className="text-sm text-muted-foreground">Checklist, solução de problemas e vídeos de cada área.</p>
        </div>
        {ministryId && (
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={`/manual?ministry_id=${ministryId}&area_id=${areaId}`}>
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Ver como servo</span>
            </Link>
          </Button>
        )}
      </div>

      {scope.loading ? (
        <Skeleton className="h-40 w-full" />
      ) : scope.ministries.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhum ministério para editar" description="Somente administradores e líderes do ministério editam o manual." />
      ) : (
        <>
          <AreaPicker ministries={scope.ministries} ministryId={ministryId} areaId={areaId} onChange={scope.setScope} generalLabel="Geral do ministério (todas as áreas)" />

          {ministryId && (
            <Tabs value={tab} onValueChange={setTab} className="gap-4">
              <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                <TabsList className="w-max">
                  <TabsTrigger value="checklist" className="gap-1.5">
                    <ListChecks className="h-4 w-4" />
                    Checklist
                  </TabsTrigger>
                  <TabsTrigger value="problemas" className="gap-1.5">
                    <Wrench className="h-4 w-4" />
                    Problemas
                  </TabsTrigger>
                  <TabsTrigger value="videos" className="gap-1.5">
                    <PlayCircle className="h-4 w-4" />
                    Vídeos
                  </TabsTrigger>
                  <TabsTrigger value="sugestoes" className="gap-1.5">
                    <Inbox className="h-4 w-4" />
                    Sugestões
                    {!!pending && <Badge variant="warning" className="ml-0.5 px-1.5 py-0 text-[11px]">{pending}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="uso" className="gap-1.5">
                    <Users className="h-4 w-4" />
                    Quem usa
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="checklist">
                <ManualEditor kind="checklist" ministryId={ministryId} areaId={areaId} scopeLabel={scopeLabel} />
              </TabsContent>
              <TabsContent value="problemas">
                <ManualEditor kind="troubleshooting" ministryId={ministryId} areaId={areaId} scopeLabel={scopeLabel} />
              </TabsContent>
              <TabsContent value="videos">
                <ManualEditor kind="videos" ministryId={ministryId} areaId={areaId} scopeLabel={scopeLabel} />
              </TabsContent>
              <TabsContent value="sugestoes">
                <SuggestionsPanel ministryId={ministryId} onCountChange={setPending} />
              </TabsContent>
              <TabsContent value="uso">
                <UsageTable ministryId={ministryId} />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  )
}
