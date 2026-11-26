"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Baby, HandHeart, Heart, Loader2, Plus, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { maskPhone } from "@/lib/masks"
import { EventHeader, brl, type EventInfo } from "@/components/confraternizacao/shared"

interface Summary {
  event: EventInfo
  open: boolean
  price: number
  free_max_age: number
  max_participants: number
  pix_configured: boolean
  sponsorship: { requested: number; covered: number; donated: number } | null
}

interface ParticipantDraft {
  name: string
  age: string
  phone: string
}

const emptyParticipant = (): ParticipantDraft => ({ name: "", age: "", phone: "" })

export default function ConfraternizacaoPage() {
  const router = useRouter()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loadError, setLoadError] = useState(false)

  const [participants, setParticipants] = useState<ParticipantDraft[]>([emptyParticipant()])
  const [otherPayer, setOtherPayer] = useState(false)
  const [payerName, setPayerName] = useState("")
  const [cannotPay, setCannotPay] = useState(false)
  const [sponsorSlots, setSponsorSlots] = useState(0)
  const [customDonation, setCustomDonation] = useState("")
  const [website, setWebsite] = useState("") // honeypot
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/confraternizacao/resumo")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setSummary)
      .catch(() => setLoadError(true))
  }, [])

  const price = summary?.price ?? 15
  const freeMaxAge = summary?.free_max_age ?? 9

  const totals = useMemo(() => {
    const withAge = participants.filter((p) => p.age.trim() !== "")
    const free = withAge.filter((p) => Number(p.age) <= freeMaxAge).length
    const payers = withAge.length - free
    const custom = Number(customDonation.replace(",", "."))
    const donation = cannotPay
      ? 0
      : customDonation.trim() !== "" && custom > 0
        ? Math.round(custom * 100) / 100
        : sponsorSlots * price
    const due = cannotPay ? 0 : payers * price
    return { payers, free, due, donation, total: due + donation }
  }, [participants, freeMaxAge, price, cannotPay, sponsorSlots, customDonation])

  const update = (i: number, patch: Partial<ParticipantDraft>) =>
    setParticipants((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!summary) return

    for (const [i, p] of participants.entries()) {
      const label = i === 0 ? "Responsável" : `Participante ${i + 1}`
      if (p.name.trim().split(/\s+/).length < 2) return toast.error(`${label}: informe nome e sobrenome`)
      if (p.age.trim() === "" || Number.isNaN(Number(p.age))) return toast.error(`${label}: informe a idade`)
    }
    if (participants[0].phone.replace(/\D/g, "").length < 10) {
      return toast.error("Informe um telefone para contato com DDD")
    }
    if (otherPayer && !cannotPay && payerName.trim().split(/\s+/).length < 2) {
      return toast.error("Informe nome e sobrenome de quem vai fazer o PIX")
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/confraternizacao/inscricoes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participants: participants.map((p) => ({
            name: p.name.trim(),
            age: Number(p.age),
            phone: p.phone || null,
          })),
          contact_phone: participants[0].phone,
          payer_name: otherPayer && !cannotPay ? payerName.trim() : null,
          cannot_pay: cannotPay,
          donation_amount: totals.donation,
          website,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao enviar inscrição")
      router.push(`/confraternizacao/inscricao/${data.access_token}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar inscrição")
      setSubmitting(false)
    }
  }

  if (loadError) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <p className="text-muted-foreground">Não foi possível carregar a página. Tente novamente em instantes.</p>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!summary.open) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-10 space-y-6">
        <EventHeader event={summary.event} />
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            As inscrições estão encerradas. Se você já se inscreveu, use o link que recebeu ao concluir a inscrição.
          </CardContent>
        </Card>
      </div>
    )
  }

  const sp = summary.sponsorship

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 md:py-10 space-y-6">
      <EventHeader event={summary.event} price={price} />

      <form onSubmit={submit} className="space-y-6">
        {/* Honeypot: escondido de pessoas, preenchido por robôs */}
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Participantes
            </CardTitle>
            <CardDescription>
              Inscreva você e quem vai com você (família, amigos). O primeiro é o responsável pela inscrição.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
              <Baby className="h-6 w-6 shrink-0 text-emerald-600" />
              <p>
                <strong className="text-emerald-800 dark:text-emerald-300">
                  Crianças de até {freeMaxAge} anos não pagam.
                </strong>{" "}
                Inscreva-as normalmente, com nome e idade, para sabermos quantas pessoas virão. O valor é calculado
                sozinho.
              </p>
            </div>

            {participants.map((p, i) => {
              const isChild = p.age.trim() !== "" && Number(p.age) <= freeMaxAge
              return (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {i === 0 ? "Responsável" : `Participante ${i + 1}`}
                    </span>
                    <div className="flex items-center gap-2">
                      {p.age.trim() !== "" &&
                        (isChild ? (
                          <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
                            <Baby className="h-3 w-3" /> Criança: não paga
                          </Badge>
                        ) : (
                          <Badge variant="outline">{brl(price)}</Badge>
                        ))}
                      {i > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remover participante ${i + 1}`}
                          onClick={() => setParticipants((ps) => ps.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
                    <div className="space-y-1.5">
                      <Label htmlFor={`name-${i}`}>Nome completo</Label>
                      <Input
                        id={`name-${i}`}
                        value={p.name}
                        onChange={(e) => update(i, { name: e.target.value })}
                        placeholder="Nome e sobrenome"
                        autoComplete={i === 0 ? "name" : "off"}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`age-${i}`}>Idade</Label>
                      <Input
                        id={`age-${i}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        value={p.age}
                        onChange={(e) => update(i, { age: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`phone-${i}`}>
                      Telefone {i === 0 ? "para contato" : <span className="text-muted-foreground">(opcional)</span>}
                    </Label>
                    <Input
                      id={`phone-${i}`}
                      type="tel"
                      inputMode="tel"
                      value={p.phone}
                      onChange={(e) => update(i, { phone: maskPhone(e.target.value) })}
                      placeholder="(83) 99999-9999"
                      autoComplete={i === 0 ? "tel" : "off"}
                      required={i === 0}
                    />
                  </div>
                </div>
              )
            })}

            {participants.length < summary.max_participants && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setParticipants((ps) => [...ps, emptyParticipant()])}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar participante (adulto ou criança)
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={cannotPay ? "cannot_pay" : "pix"}
              onValueChange={(v) => setCannotPay(v === "cannot_pay")}
              className="grid gap-3 sm:grid-cols-2"
            >
              <Label
                htmlFor="pay-pix"
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value="pix" id="pay-pix" className="mt-0.5" />
                <span>
                  <span className="font-medium">Vou pagar via PIX</span>
                  <span className="block text-sm text-muted-foreground">
                    O PIX já sai com o valor calculado.
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="pay-cannot"
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 font-normal has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value="cannot_pay" id="pay-cannot" className="mt-0.5" />
                <span>
                  <span className="font-medium">Quero participar, mas não posso pagar agora</span>
                  <span className="block text-sm text-muted-foreground">
                    Sem problema! Sua inscrição é confirmada do mesmo jeito.
                  </span>
                </span>
              </Label>
            </RadioGroup>

            {cannotPay ? (
              <div className="flex gap-3 rounded-lg bg-primary/5 p-4 text-sm">
                <HandHeart className="h-5 w-5 shrink-0 text-primary" />
                <p>
                  Queremos muito você com a gente. Outras pessoas da igreja estão contribuindo para que ninguém
                  fique de fora, e isso fica só entre você e a organização.
                </p>
              </div>
            ) : (
              <>
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={otherPayer}
                    onCheckedChange={(v) => setOtherPayer(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Outra pessoa vai fazer o PIX</span>
                    <span className="block text-sm text-muted-foreground">
                      Usamos o nome de quem paga para confirmar o pagamento automaticamente.
                    </span>
                  </span>
                </label>
                {otherPayer && (
                  <div className="space-y-1.5">
                    <Label htmlFor="payer-name">Nome de quem vai fazer o PIX</Label>
                    <Input
                      id="payer-name"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="Nome e sobrenome, como aparece no comprovante do Pix"
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {!cannotPay && (
          <Card className="border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <Heart className="h-5 w-5" /> Ajude alguém a estar com a gente
              </CardTitle>
              <CardDescription>
                Some uma ou mais inscrições ao seu PIX e, de forma anônima, garanta a vaga de quem não pode
                pagar. Ninguém fica sabendo quem ajudou nem quem foi ajudado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sp && sp.requested > 0 && (
                <p className="text-sm font-medium">
                  {sp.requested} {sp.requested === 1 ? "pessoa pediu" : "pessoas pediram"} ajuda ·{" "}
                  {Math.min(sp.covered, sp.requested)} já {Math.min(sp.covered, sp.requested) === 1 ? "foi custeada" : "foram custeadas"}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={sponsorSlots === n && customDonation === "" ? "default" : "outline"}
                    onClick={() => {
                      setSponsorSlots(n)
                      setCustomDonation("")
                    }}
                  >
                    {n === 0 ? "Agora não" : `+${n} ${n === 1 ? "inscrição" : "inscrições"} (${brl(n * price)})`}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-donation">Ou outro valor (R$)</Label>
                <Input
                  id="custom-donation"
                  inputMode="decimal"
                  placeholder="Ex.: 20,00"
                  value={customDonation}
                  onChange={(e) => setCustomDonation(e.target.value.replace(/[^\d,.]/g, ""))}
                  className="max-w-40"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Quer só doar, sem se inscrever?{" "}
                <Link href="/confraternizacao/doacao" className="font-medium text-primary underline underline-offset-4">
                  Fazer uma doação
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>
                {totals.payers} {totals.payers === 1 ? "pagante" : "pagantes"} × {brl(price)}
              </span>
              <span className={cannotPay ? "line-through text-muted-foreground" : ""}>
                {brl(totals.payers * price)}
              </span>
            </div>
            {totals.free > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>
                  {totals.free} {totals.free === 1 ? "criança" : "crianças"} (até {freeMaxAge} anos)
                </span>
                <span>grátis</span>
              </div>
            )}
            {totals.donation > 0 && (
              <div className="flex justify-between text-rose-700 dark:text-rose-300">
                <span>Doação para custear inscrições</span>
                <span>{brl(totals.donation)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Total</span>
              <span>{brl(totals.total)}</span>
            </div>
          </CardContent>
        </Card>

        {!summary.pix_configured && !cannotPay && totals.total > 0 && (
          <p className="text-sm text-destructive text-center">
            O pagamento por PIX ainda não está disponível. Tente novamente mais tarde.
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={submitting || (!summary.pix_configured && !cannotPay && totals.total > 0)}
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {cannotPay || totals.total === 0 ? "Confirmar inscrição" : "Continuar para o pagamento"}
        </Button>
      </form>
    </div>
  )
}
