"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { AlertCircle, CheckCircle2, Heart, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EventHeader, PixPayment, type EventInfo } from "@/components/confraternizacao/shared"

interface DonationData {
  event: EventInfo
  price: number
  donation: { amount: number; status: "pending" | "paid" | "cancelled" }
  pix: { payload: string; receiver_name: string; key: string } | null
}

export default function DoacaoStatusPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<DonationData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/confraternizacao/doacoes/${token}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao carregar doação")
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar doação")
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const pending = data?.donation.status === "pending"
  useEffect(() => {
    if (!pending) return
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [pending, load])

  if (error && !data) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-muted-foreground">{error}</p>
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

  const people = Math.floor(data.donation.amount / data.price + 1e-9)

  return (
    <div className="container mx-auto max-w-xl px-4 py-6 md:py-10 space-y-6">
      <EventHeader event={data.event} />

      {data.donation.status === "paid" ? (
        <Card className="border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="flex gap-4 pt-6">
            <CheckCircle2 className="h-8 w-8 shrink-0 text-green-600" />
            <div>
              <p className="font-semibold">Doação recebida. Muito obrigado!</p>
              <p className="text-sm text-muted-foreground">
                {people > 0
                  ? `Você garantiu a participação de ${people} ${people === 1 ? "pessoa" : "pessoas"}.`
                  : "Sua contribuição vai ajudar quem não pode pagar."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : data.donation.status === "cancelled" ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">Esta doação foi cancelada.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-rose-600" /> Sua doação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.pix ? (
              <PixPayment pix={data.pix} amount={data.donation.amount} />
            ) : (
              <p className="text-sm text-destructive">O PIX não está disponível no momento.</p>
            )}
            <p className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              Faça o PIX com o valor exato, da conta com o nome que você informou. A confirmação é automática e pode
              levar até um dia.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="text-center">
        <Button variant="ghost" asChild>
          <Link href="/confraternizacao">Ir para a inscrição</Link>
        </Button>
      </div>
    </div>
  )
}
