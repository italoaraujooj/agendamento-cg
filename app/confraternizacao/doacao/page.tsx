"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Heart, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EventHeader, brl, type EventInfo } from "@/components/confraternizacao/shared"

interface Summary {
  event: EventInfo
  open: boolean
  price: number
  pix_configured: boolean
  sponsorship: { requested: number; covered: number } | null
}

export default function DoacaoPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [slots, setSlots] = useState(1)
  const [custom, setCustom] = useState("")
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/confraternizacao/resumo")
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => toast.error("Erro ao carregar a página"))
  }, [])

  if (!summary) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const customValue = Number(custom.replace(",", "."))
  const amount = custom.trim() !== "" && customValue > 0 ? Math.round(customValue * 100) / 100 : slots * summary.price

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim().split(/\s+/).length < 2) return toast.error("Informe nome e sobrenome")
    if (amount < 1) return toast.error("Escolha um valor")
    setSubmitting(true)
    try {
      const res = await fetch("/api/confraternizacao/doacoes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payer_name: name.trim(), amount, website }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao registrar doação")
      router.push(`/confraternizacao/doacao/${data.access_token}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao registrar doação")
      setSubmitting(false)
    }
  }

  const sp = summary.sponsorship

  return (
    <div className="container mx-auto max-w-xl px-4 py-6 md:py-10 space-y-6">
      <EventHeader event={summary.event} />

      {!summary.open ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">As doações estão encerradas.</CardContent>
        </Card>
      ) : (
        <form onSubmit={submit}>
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />
          <Card className="border-rose-200 dark:border-rose-900/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <Heart className="h-5 w-5" /> Ajude alguém a estar com a gente
              </CardTitle>
              <CardDescription>
                Cada {brl(summary.price)} garante a vaga de uma pessoa que não pode pagar a inscrição. Sua doação é
                anônima: ninguém fica sabendo quem ajudou nem quem foi ajudado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {sp && sp.requested > 0 && (
                <p className="text-sm font-medium">
                  {sp.requested} {sp.requested === 1 ? "pessoa pediu" : "pessoas pediram"} ajuda ·{" "}
                  {Math.min(sp.covered, sp.requested)} já {Math.min(sp.covered, sp.requested) === 1 ? "foi custeada" : "foram custeadas"}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 5].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={slots === n && custom === "" ? "default" : "outline"}
                    onClick={() => {
                      setSlots(n)
                      setCustom("")
                    }}
                  >
                    {n} {n === 1 ? "inscrição" : "inscrições"} ({brl(n * summary.price)})
                  </Button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custom">Ou outro valor (R$)</Label>
                <Input
                  id="custom"
                  inputMode="decimal"
                  placeholder="Ex.: 50,00"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.replace(/[^\d,.]/g, ""))}
                  className="max-w-40"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Seu nome</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome e sobrenome, como aparece no comprovante do Pix"
                  autoComplete="name"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Não aparece para ninguém: serve só para confirmarmos que o PIX chegou.
                </p>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={submitting || !summary.pix_configured}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Doar {brl(amount)} via PIX
              </Button>
            </CardContent>
          </Card>
        </form>
      )}

      <div className="text-center">
        <Button variant="ghost" asChild>
          <Link href="/confraternizacao">Voltar para a inscrição</Link>
        </Button>
      </div>
    </div>
  )
}
