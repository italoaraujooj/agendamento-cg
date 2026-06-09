"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { AnnouncementForm } from "@/components/announcements/announcement-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Megaphone, CalendarDays, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { sundaysBetween } from "@/lib/announcements"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Announcement {
  id: string
  type: "event" | "general" | "ministry"
  title: string
  description: string | null
  event_date: string | null
  event_time: string | null
  location: string | null
  first_sunday: string
  last_sunday: string
  status: "pending" | "approved" | "rejected"
  review_notes: string | null
  created_at: string
  ministry_name: string | null
}

const TYPE_LABELS = { event: "Evento", general: "Comunicado Geral", ministry: "Aviso de Ministério" }
const STATUS_CONFIG = {
  pending: { label: "Aguardando revisão", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Aprovado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejeitado", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

export default function AvisosPage() {
  const router = useRouter()
  const { isAuthenticated, loading: authLoading, adminChecked } = useAuth()
  const { setMode } = useSystemMode()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => { setMode("agendamentos") }, [setMode])

  useEffect(() => {
    if (!authLoading && adminChecked && !isAuthenticated) {
      router.push("/login")
    }
  }, [authLoading, adminChecked, isAuthenticated, router])

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/announcements")
      const data = await res.json()
      setAnnouncements(data.announcements ?? [])
    } catch {
      toast.error("Erro ao carregar avisos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) fetchAnnouncements()
  }, [isAuthenticated, fetchAnnouncements])

  const handleDelete = async () => {
    if (!deleteId) return
    const res = await fetch(`/api/announcements/${deleteId}`, { method: "DELETE" })
    if (res.ok) { toast.success("Aviso removido."); fetchAnnouncements() }
    else { const d = await res.json(); toast.error(d.error || "Erro ao remover") }
    setDeleteId(null)
  }

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (authLoading || !adminChecked) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6" />
          Avisos no Culto
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Solicite que um aviso seja dado nos cultos de domingo (10h e 18h).
        </p>
      </div>

      {/* Formulário */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Nova solicitação</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnouncementForm onSuccess={fetchAnnouncements} />
        </CardContent>
      </Card>

      {/* Minhas solicitações */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Minhas solicitações</h2>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Megaphone className="h-10 w-10 mx-auto text-muted-foreground opacity-30 mb-3" />
              <p className="text-muted-foreground text-sm">Você ainda não enviou nenhuma solicitação.</p>
            </CardContent>
          </Card>
        ) : (
          announcements.map(a => {
            const isOpen = expanded.has(a.id)
            const sundays = sundaysBetween(parseISO(a.first_sunday), parseISO(a.last_sunday))
            const statusCfg = STATUS_CONFIG[a.status]
            return (
              <Card key={a.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{TYPE_LABELS[a.type]}</Badge>
                        <Badge className={statusCfg.color + " text-xs"}>{statusCfg.label}</Badge>
                      </div>
                      <p className="font-medium mt-1">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Enviado em {format(parseISO(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {a.status === "pending" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={() => setDeleteId(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleExpanded(a.id)}>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t pt-3 space-y-2 text-sm">
                      {a.description && <p className="text-muted-foreground">{a.description}</p>}
                      {a.ministry_name && (
                        <p className="text-muted-foreground">{a.ministry_name}</p>
                      )}
                      {a.event_date && (
                        <p className="text-muted-foreground">
                          {a.location} · {a.event_time} · {format(parseISO(a.event_date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                      {a.review_notes && (
                        <div className="bg-muted/50 rounded p-2 text-xs">
                          <strong>Observação:</strong> {a.review_notes}
                        </div>
                      )}
                      {sundays.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            Domingos {a.status === "approved" ? "programados" : "estimados"}:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {sundays.map((d, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {format(d, "dd/MM", { locale: ptBR })}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar solicitação</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja remover esta solicitação de aviso?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
