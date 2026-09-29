"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Check, X, Loader2, Clock } from "lucide-react"
import { toast } from "sonner"
import type { AssignmentStatus } from "@/types/escalas"

const DECLINE_REASONS = ["Viagem", "Trabalho", "Saúde", "Compromisso familiar"]

/** Hoje no fuso de Brasília (YYYY-MM-DD) */
const todayBr = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  if (status === "accepted") {
    return (
      <Badge className="bg-success hover:bg-success/90 text-success-foreground gap-1">
        <Check className="h-3 w-3" /> Confirmado
      </Badge>
    )
  }
  if (status === "declined") {
    return (
      <Badge variant="outline" className="border-destructive/30 text-destructive gap-1">
        <X className="h-3 w-3" /> Não poderei
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-warning/30 text-warning gap-1">
      <Clock className="h-3 w-3" /> Aguardando confirmação
    </Badge>
  )
}

interface AssignmentResponseProps {
  assignmentId: string
  status: AssignmentStatus
  eventDate: string
  /** Link pessoal (e-mail). Sem ele, a API usa a sessão do usuário logado. */
  token?: string
  onChange: (status: AssignmentStatus) => void
}

/** Botões para o servo confirmar ou recusar uma escala. */
export function AssignmentResponse({ assignmentId, status, eventDate, token, onChange }: AssignmentResponseProps) {
  const [loading, setLoading] = useState<AssignmentStatus | null>(null)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState("")

  const past = eventDate < todayBr()

  const respond = async (next: "accepted" | "declined") => {
    setLoading(next)
    try {
      const res = await fetch(`/api/escalas/assignments/${assignmentId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, reason: next === "declined" ? reason.trim() || null : null, token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Erro ao responder")
      onChange(next)
      setDeclining(false)
      toast.success(next === "accepted" ? "Presença confirmada!" : "Recusa enviada ao líder do ministério.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao responder")
    } finally {
      setLoading(null)
    }
  }

  if (past) return <AssignmentStatusBadge status={status} />

  if (declining) {
    return (
      <div className="w-full space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {DECLINE_REASONS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setReason(reason === chip ? "" : chip)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                reason === chip ? "bg-destructive border-destructive/60 text-destructive-foreground" : "bg-background hover:bg-muted"
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
        <Input
          placeholder="Motivo (opcional)"
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          className="h-9 text-sm"
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setDeclining(false)} disabled={!!loading}>
            Cancelar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => respond("declined")} disabled={!!loading}>
            {loading === "declined" && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Confirmar recusa
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <AssignmentStatusBadge status={status} />
      {status !== "accepted" && (
        <Button
          size="sm"
          className="bg-success hover:bg-success/90 text-success-foreground h-8"
          onClick={() => respond("accepted")}
          disabled={!!loading}
        >
          {loading === "accepted" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
          Confirmar
        </Button>
      )}
      {status !== "declined" && (
        <Button size="sm" variant="outline" className="h-8" onClick={() => setDeclining(true)} disabled={!!loading}>
          <X className="mr-1 h-3.5 w-3.5" />
          Não poderei
        </Button>
      )}
    </div>
  )
}
