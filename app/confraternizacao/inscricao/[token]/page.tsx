"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Baby, CheckCircle2, Clock, HandHeart, Loader2, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EventHeader, PixPayment, ReceiptWhatsAppCard, brl, type EventInfo } from "@/components/confraternizacao/shared"

interface RegistrationData {
  event: EventInfo
  price: number
  registration: {
    contact_name: string
    payer_name: string | null
    cannot_pay: boolean
    payers_count: number
    free_count: number
    amount_due: number
    donation_amount: number
    total_expected: number
    status: "pending_payment" | "paid" | "sponsored" | "cancelled"
    participants: { name: string; age: number; is_child: boolean }[]
  }
  pix: { payload: string; receiver_name: string; key: string } | null
}

export default function InscricaoStatusPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<RegistrationData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/confraternizacao/inscricoes/${token}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao carregar inscrição")
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar inscrição")
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  // Enquanto aguarda o pagamento, confere o status de tempos em tempos
  const pending = data?.registration.status === "pending_payment"
  useEffect(() => {
    if (!pending) return
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [pending, load])

  if (error && !data) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button variant="outline" asChild>
          <Link href="/confraternizacao">Ir para a inscrição</Link>
        </Button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const { registration: reg, pix, event } = data
  const payerHint = reg.payer_name ?? "um dos participantes"

  return (
    <div className="container mx-auto max-w-xl px-4 py-6 md:py-10 space-y-6">
      <EventHeader event={event} />

      <StatusCard status={reg.status} />

      {reg.status === "pending_payment" && (
        <Card>
          <CardHeader>
            <CardTitle>Pagamento via PIX</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pix ? (
              <PixPayment pix={pix} amount={reg.total_expected} />
            ) : (
              <p className="text-sm text-destructive">
                O PIX não está disponível no momento. Fale com a organização.
              </p>
            )}
            <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
              <p>
                <strong>Importante:</strong> faça o PIX com o valor exato de{" "}
                <strong>{brl(reg.total_expected)}</strong> a partir da conta de <strong>{payerHint}</strong>.
                É assim que reconhecemos o seu pagamento.
              </p>
              <p className="text-muted-foreground">
                A confirmação é automática, mas pode levar até um dia. Guarde este link para acompanhar.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {reg.status === "pending_payment" && (
        <ReceiptWhatsAppCard
          message={`Olá! Segue o comprovante do PIX de ${brl(reg.total_expected)} da inscrição de ${reg.contact_name} na confraternização.`}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo da inscrição</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ul className="space-y-2">
            {reg.participants.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>
                  {p.name} <span className="text-muted-foreground">· {p.age} anos</span>
                </span>
                {p.is_child && (
                  <Badge variant="secondary" className="gap-1">
                    <Baby className="h-3 w-3" /> Não pagante
                  </Badge>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t pt-3 space-y-1">
            {!reg.cannot_pay && (
              <div className="flex justify-between">
                <span>
                  {reg.payers_count} {reg.payers_count === 1 ? "pagante" : "pagantes"}
                </span>
                <span>{brl(reg.amount_due)}</span>
              </div>
            )}
            {reg.donation_amount > 0 && (
              <div className="flex justify-between text-rose-700 dark:text-rose-300">
                <span>Doação para custear inscrições</span>
                <span>{brl(reg.donation_amount)}</span>
              </div>
            )}
            {!reg.cannot_pay && (
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{brl(reg.total_expected)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button variant="ghost" asChild>
          <Link href="/confraternizacao">Fazer outra inscrição</Link>
        </Button>
      </div>
    </div>
  )
}

function StatusCard({ status }: { status: RegistrationData["registration"]["status"] }) {
  const config = {
    pending_payment: {
      icon: Clock,
      title: "Inscrição recebida: falta o pagamento",
      text: "Faça o PIX abaixo para garantir sua vaga.",
      className: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30",
      iconClass: "text-amber-600",
    },
    paid: {
      icon: CheckCircle2,
      title: "Inscrição confirmada!",
      text: "Pagamento recebido. Nos vemos na confraternização!",
      className: "border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
      iconClass: "text-green-600",
    },
    sponsored: {
      icon: HandHeart,
      title: "Inscrição confirmada!",
      text: "Sua participação está garantida. Que bom ter você com a gente!",
      className: "border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/30",
      iconClass: "text-green-600",
    },
    cancelled: {
      icon: XCircle,
      title: "Inscrição cancelada",
      text: "Se isso não era esperado, fale com a organização.",
      className: "border-destructive/40 bg-destructive/5",
      iconClass: "text-destructive",
    },
  }[status]
  const Icon = config.icon

  return (
    <Card className={config.className}>
      <CardContent className="flex gap-4 pt-6">
        <Icon className={`h-8 w-8 shrink-0 ${config.iconClass}`} />
        <div>
          <p className="font-semibold">{config.title}</p>
          <p className="text-sm text-muted-foreground">{config.text}</p>
        </div>
      </CardContent>
    </Card>
  )
}
