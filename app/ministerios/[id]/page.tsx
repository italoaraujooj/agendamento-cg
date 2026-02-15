"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Plus,
  Loader2,
  Users,
  Pencil,
  Trash2,
  MoreHorizontal,
  Crown,
  Save
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { AreaForm } from "@/components/escalas/area-form"
import { ServantForm } from "@/components/escalas/servant-form"
import { toast } from "sonner"
import Link from "next/link"
import type { Ministry, Area, Servant } from "@/types/escalas"

interface MinistryWithAreas extends Ministry {
  areas: (Area & { servants: Servant[] })[]
}

export default function MinisterioDetalhePage() {
  const router = useRouter()
  const params = useParams()
  const ministryId = params.id as string
  
  const { isAuthenticated, isAdmin, isMinistryLeader, adminChecked, loading: authLoading } = useAuth()
  const { setMode } = useSystemMode()
  
  const [ministry, setMinistry] = useState<MinistryWithAreas | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Leadership state
  const [leaderId, setLeaderId] = useState<string | null>(null)
  const [coLeaderId, setCoLeaderId] = useState<string | null>(null)
  const [savingLeaders, setSavingLeaders] = useState(false)

  // Dialog states
  const [areaFormOpen, setAreaFormOpen] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | undefined>()
  const [servantFormOpen, setServantFormOpen] = useState(false)
  const [editingServant, setEditingServant] = useState<Servant | undefined>()
  const [selectedAreaId, setSelectedAreaId] = useState<string>("")
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    type: "area" | "servant"
    id: string
    name: string
  }>({ open: false, type: "area", id: "", name: "" })

  useEffect(() => {
    setMode("escalas")
  }, [setMode])

  const fetchMinistry = useCallback(async () => {
    try {
      const response = await fetch(`/api/escalas/ministries/${ministryId}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Ministério não encontrado")
          router.push("/ministerios")
          return
        }
        throw new Error("Erro ao carregar ministério")
      }
      const data = await response.json()
      setMinistry(data)
      setLeaderId(data.leader_id || null)
      setCoLeaderId(data.co_leader_id || null)
    } catch (error) {
      console.error("Erro ao buscar ministério:", error)
      toast.error("Erro ao carregar ministério")
    } finally {
      setLoading(false)
    }
  }, [ministryId, router])

  useEffect(() => {
    fetchMinistry()
  }, [fetchMinistry])

  // Get all active servants across all areas
  const allServants = (ministry?.areas
    ?.flatMap(a => a.servants?.filter(s => s.is_active) || []) || [])
    .sort((a, b) => a.name.localeCompare(b.name))

  const uniqueServantCount = new Set(allServants.map(s => s.name.toLowerCase().trim())).size

  const handleSaveLeaders = async () => {
    setSavingLeaders(true)
    try {
      const response = await fetch(`/api/escalas/ministries/${ministryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leader_id: leaderId || null,
          co_leader_id: coLeaderId || null,
        }),
      })
      if (!response.ok) throw new Error("Erro ao salvar liderança")
      toast.success("Liderança atualizada!")
      fetchMinistry()
    } catch (error) {
      console.error("Erro ao salvar liderança:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar liderança")
    } finally {
      setSavingLeaders(false)
    }
  }

  const leadersChanged = ministry && (
    leaderId !== (ministry.leader_id || null) ||
    coLeaderId !== (ministry.co_leader_id || null)
  )

  const handleAddArea = () => {
    setEditingArea(undefined)
    setAreaFormOpen(true)
  }

  const handleEditArea = (area: Area) => {
    setEditingArea(area)
    setAreaFormOpen(true)
  }

  const handleAddServant = (areaId: string) => {
    setSelectedAreaId(areaId)
    setEditingServant(undefined)
    setServantFormOpen(true)
  }

  const handleEditServant = (servant: Servant, areaId: string) => {
    setSelectedAreaId(areaId)
    setEditingServant(servant)
    setServantFormOpen(true)
  }

  const handleDelete = async () => {
    const { type, id } = deleteDialog
    
    try {
      const url = type === "area" 
        ? `/api/escalas/areas/${id}`
        : `/api/escalas/servants/${id}`
      
      const response = await fetch(url, { method: "DELETE" })
      
      if (!response.ok) {
        throw new Error(`Erro ao excluir ${type === "area" ? "área" : "servo"}`)
      }

      toast.success(`${type === "area" ? "Área" : "Servo"} removido(a)!`)
      fetchMinistry()
    } catch (error) {
      console.error("Erro ao excluir:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao excluir")
    } finally {
      setDeleteDialog({ open: false, type: "area", id: "", name: "" })
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (!ministry) {
    return null
  }

  const canEdit = isAuthenticated && (isAdmin || isMinistryLeader(ministryId))

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" asChild className="w-fit">
          <Link href="/ministerios">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Ministérios
          </Link>
        </Button>
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-6 h-6 rounded-full" 
              style={{ backgroundColor: ministry.color }}
            />
            <div>
              <h1 className="text-3xl font-bold">{ministry.name}</h1>
              {ministry.description && (
                <p className="text-muted-foreground">{ministry.description}</p>
              )}
            </div>
          </div>
          {canEdit && (
            <Button variant="outline" asChild>
              <Link href={`/ministerios/${ministry.id}/editar`}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Liderança */}
      {canEdit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Liderança do Ministério
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Líder</label>
                <Select
                  value={leaderId || "none"}
                  onValueChange={(v) => setLeaderId(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o líder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {allServants.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Co-líder</label>
                <Select
                  value={coLeaderId || "none"}
                  onValueChange={(v) => setCoLeaderId(v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o co-líder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {allServants.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {leadersChanged && (
              <Button
                className="mt-4"
                onClick={handleSaveLeaders}
                disabled={savingLeaders}
              >
                {savingLeaders ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar Liderança
              </Button>
            )}

            {/* Resumo de servos */}
            <div className="border-t mt-4 pt-4">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Resumo — {uniqueServantCount} servo(s) no total
              </h4>
              <div className="flex flex-wrap gap-2">
                {ministry.areas
                  .filter(a => a.is_active)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((area) => {
                    const count = area.servants?.filter(s => s.is_active).length || 0
                    return (
                      <Badge key={area.id} variant="secondary">
                        {area.name}: {count}
                      </Badge>
                    )
                  })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show leadership info and summary for non-admins */}
      {!canEdit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Liderança do Ministério
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(ministry?.leader || ministry?.co_leader) && (
              <div className="grid gap-4 sm:grid-cols-2 mb-4">
                {ministry.leader && (
                  <div>
                    <span className="text-sm text-muted-foreground">Líder</span>
                    <p className="font-medium">{ministry.leader.name}</p>
                  </div>
                )}
                {ministry.co_leader && (
                  <div>
                    <span className="text-sm text-muted-foreground">Co-líder</span>
                    <p className="font-medium">{ministry.co_leader.name}</p>
                  </div>
                )}
              </div>
            )}

            {/* Resumo de servos */}
            <div className={ministry?.leader || ministry?.co_leader ? "border-t pt-4" : ""}>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Resumo — {uniqueServantCount} servo(s) no total
              </h4>
              <div className="flex flex-wrap gap-2">
                {ministry.areas
                  .filter(a => a.is_active)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((area) => {
                    const count = area.servants?.filter(s => s.is_active).length || 0
                    return (
                      <Badge key={area.id} variant="secondary">
                        {area.name}: {count}
                      </Badge>
                    )
                  })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Áreas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Áreas de Serviço</h2>
          {canEdit && (
            <Button onClick={handleAddArea}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Área
            </Button>
          )}
        </div>

        {ministry.areas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-center">
                Nenhuma área cadastrada neste ministério.
              </p>
              {canEdit && (
                <Button onClick={handleAddArea} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeira Área
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {ministry.areas
              .filter(a => a.is_active)
              .sort((a, b) => a.order_index - b.order_index || a.name.localeCompare(b.name))
              .map((area) => (
                <Card key={area.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{area.name}</CardTitle>
                        {area.description && (
                          <CardDescription>{area.description}</CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {area.min_servants} - {area.max_servants || "∞"} servos
                        </Badge>
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditArea(area)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar Área
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => setDeleteDialog({
                                  open: true,
                                  type: "area",
                                  id: area.id,
                                  name: area.name
                                })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remover Área
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">
                          Servos ({area.servants?.filter(s => s.is_active).length || 0})
                        </span>
                        {canEdit && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleAddServant(area.id)}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Adicionar
                          </Button>
                        )}
                      </div>
                      
                      {area.servants?.filter(s => s.is_active).length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          Nenhum servo cadastrado nesta área.
                        </p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {area.servants
                            ?.filter(s => s.is_active)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((servant) => (
                              <div 
                                key={servant.id}
                                className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm truncate">{servant.name}</span>
                                </div>
                                {canEdit && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-6 w-6">
                                        <MoreHorizontal className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem 
                                        onClick={() => handleEditServant(servant, area.id)}
                                      >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={() => setDeleteDialog({
                                          open: true,
                                          type: "servant",
                                          id: servant.id,
                                          name: servant.name
                                        })}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Remover
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <AreaForm
        ministryId={ministryId}
        area={editingArea}
        open={areaFormOpen}
        onOpenChange={setAreaFormOpen}
        onSuccess={fetchMinistry}
      />

      <ServantForm
        areaId={selectedAreaId}
        servant={editingServant}
        open={servantFormOpen}
        onOpenChange={setServantFormOpen}
        onSuccess={fetchMinistry}
      />

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => 
        setDeleteDialog(prev => ({ ...prev, open }))
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {deleteDialog.type === "area" ? "a área" : "o servo"}{" "}
              <strong>{deleteDialog.name}</strong>?
              {deleteDialog.type === "area" && (
                <span className="block mt-2 text-destructive">
                  Todos os servos desta área também serão removidos.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
