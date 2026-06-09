"use client"

import { useState, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  CheckCircle2, XCircle, Loader2, CalendarDays, Megaphone, History,
  Clock, MapPin, DollarSign, Link2, User, Building, ImageIcon, Video, Trash2, ChevronDown, ChevronUp,
} from "lucide-react"
import { toast } from "sonner"
import { sundaysBetween, formatSunday } from "@/lib/announcements"
import { format, parseISO, isAfter, startOfDay, addDays } from "date-fns"
import { ptBR } from "date-fns/locale"

interface Announcement {
  id: string
  type: "event" | "general" | "ministry"
  title: string
  description: string | null
  location: string | null
  event_time: string | null
  event_date: string | null
  registration_type: "free" | "paid" | null
  registration_value: number | null
  registration_where: string | null
  has_art: boolean
  art_url: string | null
  first_sunday: string
  last_sunday: string
  status: "pending" | "approved" | "rejected"
  review_notes: string | null
  reviewed_at: string | null
  created_at: string
  ministry: { id: string; name: string; color: string } | null
  submitter: { id: string; full_name: string | null; email: string } | null
}

const TYPE_CONFIG = {
  event: { label: "Evento", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  general: { label: "Comunicado Geral", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300" },
  ministry: { label: "Aviso de Ministério", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
}

const STATUS_CONFIG = {
  pending: { label: "Pendente", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Aprovado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejeitado", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

function AnnouncementCard({
  announcement: a,
  onApprove,
  onReject,
  onDelete,
  showActions = false,
}: {
  announcement: Announcement
  onApprove?: (id: string) => void
  onReject?: (id: string, notes: string) => void
  onDelete?: (id: string) => void
  showActions?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [rejectNotes, setRejectNotes] = useState("")
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const sundays = sundaysBetween(parseISO(a.first_sunday), parseISO(a.last_sunday))

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={TYPE_CONFIG[a.type].color}>{TYPE_CONFIG[a.type].label}</Badge>
              <Badge className={STATUS_CONFIG[a.status].color}>{STATUS_CONFIG[a.status].label}</Badge>
              {a.has_art && (
                <Badge variant="outline" className="text-xs gap-1">
                  {a.art_url?.includes("mp4") || a.art_url?.includes("mov") || a.art_url?.includes("webm")
                    ? <><Video className="h-3 w-3" />Vídeo</>
                    : <><ImageIcon className="h-3 w-3" />Arte</>
                  }
                </Badge>
              )}
            </div>
            <h3 className="font-semibold mt-1.5">{a.title}</h3>
            {a.submitter && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <User className="h-3 w-3" />
                {a.submitter.full_name || a.submitter.email}
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {expanded && (
          <div className="space-y-3 border-t pt-3 text-sm">
            {a.description && <p className="text-muted-foreground">{a.description}</p>}
            {a.ministry && (
              <p className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.ministry.color }} />
                {a.ministry.name}
              </p>
            )}
            {a.location && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{a.location}</p>}
            {a.event_time && <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-muted-foreground" />{a.event_time}</p>}
            {a.event_date && <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />{format(parseISO(a.event_date), "dd/MM/yyyy", { locale: ptBR })}</p>}
            {a.registration_type && (
              <p className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                {a.registration_type === "free" ? "Gratuito" : `Pago — R$ ${a.registration_value?.toFixed(2) ?? "—"}`}
              </p>
            )}
            {a.registration_where && <p className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5 text-muted-foreground" />{a.registration_where}</p>}

            {/* Arte */}
            {a.art_url && (
              <div className="rounded-lg overflow-hidden border">
                {a.art_url.match(/\.(mp4|mov|webm)$/i) ? (
                  <video src={a.art_url} controls className="w-full max-h-56 object-contain bg-black" />
                ) : (
                  <img src={a.art_url} alt="Arte do aviso" className="w-full max-h-56 object-contain bg-muted" />
                )}
              </div>
            )}

            {/* Notas de revisão */}
            {a.review_notes && (
              <div className="bg-muted/50 rounded p-2 text-xs">
                <strong>Observação:</strong> {a.review_notes}
              </div>
            )}

            {/* Domingos */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Domingos programados:</p>
              <div className="flex flex-wrap gap-1">
                {sundays.map((d, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {format(d, "dd/MM", { locale: ptBR })}
                  </Badge>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Enviado em {format(parseISO(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        )}

        {showActions && a.status === "pending" && (
          <div className="flex gap-2 pt-1 border-t">
            <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => onApprove?.(a.id)}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aprovar
            </Button>
            <Button size="sm" variant="outline" className="flex-1 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setShowRejectDialog(true)}>
              <XCircle className="h-3.5 w-3.5 mr-1" />Rejeitar
            </Button>
            {onDelete && (
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => onDelete(a.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>

      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar aviso</AlertDialogTitle>
            <AlertDialogDescription>Informe o motivo da rejeição para o solicitante.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo da rejeição (opcional)..."
            value={rejectNotes}
            onChange={e => setRejectNotes(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => { onReject?.(a.id, rejectNotes); setShowRejectDialog(false); setRejectNotes("") }}
            >
              Rejeitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

export function AnnouncementsManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [sundayFilter, setSundayFilter] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
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

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    })
    if (res.ok) { toast.success("Aviso aprovado!"); fetchAll() }
    else { const d = await res.json(); toast.error(d.error || "Erro ao aprovar") }
  }

  const handleReject = async (id: string, notes: string) => {
    const res = await fetch(`/api/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", review_notes: notes }),
    })
    if (res.ok) { toast.success("Aviso rejeitado."); fetchAll() }
    else { const d = await res.json(); toast.error(d.error || "Erro ao rejeitar") }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    const res = await fetch(`/api/announcements/${deleteId}`, { method: "DELETE" })
    if (res.ok) { toast.success("Aviso removido."); fetchAll() }
    else { const d = await res.json(); toast.error(d.error || "Erro ao remover") }
    setDeleteId(null)
  }

  const pending = announcements.filter(a => a.status === "pending")
  const approved = announcements.filter(a => a.status === "approved")

  // Próximos 8 domingos
  const today = startOfDay(new Date())
  const nextSundays: Date[] = []
  let d = today
  while (nextSundays.length < 8) {
    if (d.getDay() === 0) nextSundays.push(new Date(d))
    d = addDays(d, 1)
  }

  const scheduledForSunday = (sunday: Date) =>
    approved.filter(a => {
      const first = parseISO(a.first_sunday)
      const last = parseISO(a.last_sunday)
      return !isAfter(first, sunday) && !isAfter(sunday, last)
    })

  const filteredSunday = sundayFilter
    ? approved.filter(a => {
        const sd = parseISO(sundayFilter)
        const first = parseISO(a.first_sunday)
        const last = parseISO(a.last_sunday)
        return !isAfter(first, sd) && !isAfter(sd, last)
      })
    : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <Tabs defaultValue="pending">
        <TabsList className="w-full">
          <TabsTrigger value="pending" className="flex-1">
            Pendentes
            {pending.length > 0 && (
              <Badge className="ml-1.5 h-5 px-1.5 bg-amber-500 text-white text-xs">{pending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="scheduled" className="flex-1">Programados</TabsTrigger>
          <TabsTrigger value="history" className="flex-1">Histórico</TabsTrigger>
        </TabsList>

        {/* Pendentes */}
        <TabsContent value="pending" className="mt-4 space-y-3">
          {pending.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum aviso pendente de revisão.</p>
            </div>
          ) : (
            pending.map(a => (
              <AnnouncementCard
                key={a.id}
                announcement={a}
                showActions
                onApprove={handleApprove}
                onReject={handleReject}
                onDelete={setDeleteId}
              />
            ))
          )}
        </TabsContent>

        {/* Programados */}
        <TabsContent value="scheduled" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Label className="shrink-0 text-sm">Filtrar por domingo:</Label>
            <Input
              type="date"
              value={sundayFilter}
              onChange={e => setSundayFilter(e.target.value)}
              className="w-44"
            />
            {sundayFilter && <Button variant="ghost" size="sm" onClick={() => setSundayFilter("")}>Limpar</Button>}
          </div>

          {sundayFilter ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {format(parseISO(sundayFilter), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                <span className="text-muted-foreground ml-1">— {filteredSunday?.length ?? 0} aviso(s)</span>
              </p>
              {filteredSunday?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum aviso programado para este domingo.</p>
              ) : (
                filteredSunday?.map(a => <AnnouncementCard key={a.id} announcement={a} />)
              )}
            </div>
          ) : (
            nextSundays.map(sunday => {
              const list = scheduledForSunday(sunday)
              return (
                <div key={sunday.toISOString()} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <p className="text-sm font-semibold text-muted-foreground shrink-0 flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {format(sunday, "dd 'de' MMMM", { locale: ptBR })}
                      <Badge variant="outline" className="ml-1 text-xs">{list.length}</Badge>
                    </p>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {list.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center pb-2">Nenhum aviso programado.</p>
                  ) : (
                    list.map(a => <AnnouncementCard key={a.id} announcement={a} />)
                  )}
                </div>
              )
            })
          )}
        </TabsContent>

        {/* Histórico */}
        <TabsContent value="history" className="mt-4 space-y-3">
          {announcements.filter(a => a.status !== "pending").length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>Nenhum aviso revisado ainda.</p>
            </div>
          ) : (
            announcements
              .filter(a => a.status !== "pending")
              .map(a => <AnnouncementCard key={a.id} announcement={a} onDelete={setDeleteId} />)
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover aviso</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
