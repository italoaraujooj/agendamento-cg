"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, ArrowLeft, CalendarCheck } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { AssignmentResponse } from "@/components/escalas/assignment-response"
import { CalendarSubscribe } from "@/components/escalas/calendar-subscribe"
import type { AssignmentStatus } from "@/types/escalas"

interface PersonalSchedule {
  servant: { id: string; name: string }
  period: { id: string; month: number; year: number; ministry: { name: string; color: string } | null }
  assignments: {
    id: string
    status: AssignmentStatus
    area: string
    event: { id: string; event_date: string; event_time: string; title: string }
  }[]
  calendar_token: string
}

export default function EscalaPessoalPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PersonalSchedule | null>(null)
  const [signature, setSignature] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const s = params.get("s")
    const k = params.get("k")
    if (!s || !k) {
      setError("Link incompleto. Abra o link recebido por e-mail.")
      setLoading(false)
      return
    }
    setSignature(k)

    fetch(`/api/escalas/escala/${token}?s=${encodeURIComponent(s)}&k=${encodeURIComponent(k)}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Erro ao carregar escala")
        setData(json)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erro ao carregar escala"))
      .finally(() => setLoading(false))
  }, [token])

  const updateStatus = (assignmentId: string, status: AssignmentStatus) =>
    setData((prev) =>
      prev
        ? { ...prev, assignments: prev.assignments.map((a) => (a.id === assignmentId ? { ...a, status } : a)) }
        : prev
    )

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button variant="outline" asChild>
              <Link href="/minha-escala">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Minha Escala
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const monthLabel = format(new Date(data.period.year, data.period.month - 1), "MMMM 'de' yyyy", { locale: ptBR })
  const pending = data.assignments.filter((a) => a.status === "pending").length

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.period.ministry?.color || "#888" }}
          />
          <p className="text-sm text-muted-foreground">
            {data.period.ministry?.name} · <span className="capitalize">{monthLabel}</span>
          </p>
        </div>
        <h1 className="text-2xl font-bold">Olá, {data.servant.name.split(" ")[0]}!</h1>
        <p className="text-muted-foreground text-sm">
          {data.assignments.length === 0
            ? "Você não está escalado(a) neste mês."
            : pending > 0
              ? `Confirme sua presença em ${pending === 1 ? "1 escala" : `${pending} escalas`} ou avise se não puder servir.`
              : "Obrigado por confirmar! Se algo mudar, você pode alterar sua resposta abaixo."}
        </p>
      </div>

      <div className="space-y-3">
        {data.assignments.map((a) => (
          <Card key={a.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base capitalize">
                {format(parseISO(a.event.event_date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                {a.event.event_time.slice(0, 5)} — {a.event.title} · <strong>{a.area}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AssignmentResponse
                assignmentId={a.id}
                status={a.status}
                eventDate={a.event.event_date}
                token={signature}
                onChange={(status) => updateStatus(a.id, status)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {data.assignments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Adicionar ao seu calendário
            </CardTitle>
            <CardDescription>
              Suas escalas aparecem no calendário do celular e se atualizam sozinhas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CalendarSubscribe calendarToken={data.calendar_token} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
