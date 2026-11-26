"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Baby,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  HandHeart,
  Heart,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
  Wallet,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { maskPhone } from "@/lib/masks"
import { ConfraternizacaoEvento, type EventSettings } from "./confraternizacao-evento"

type Status = "pending_payment" | "paid" | "sponsored" | "cancelled"

interface Registration {
  id: string
  contact_name: string
  contact_phone: string
  payer_name: string | null
  cannot_pay: boolean
  payers_count: number
  free_count: number
  amount_due: number
  donation_amount: number
  total_expected: number
  status: Status
  paid_at: string | null
  created_at: string
  confra_participants: { name: string; age: number; phone: string | null; is_child: boolean }[]
  payment: { match: "auto" | "manual"; payer_name: string | null; tx_date: string | null; amount: number } | null
}

interface AdminData {
  event: EventSettings
  price: number
  pluggy_configured: boolean
  pix_configured: boolean
  stats: {
    registrations: number
    participants: number
    payers: number
    children: number
    sponsored_people: number
    pending_count: number
    pending_amount: number
    paid_registrations_amount: number
    donations_with_registration: number
    standalone_donations_paid: number
    standalone_donations_pending: number
  }
  sponsorship: { requested: number; covered: number; donated: number } | null
  registrations: Registration[]
}

interface Suggestion {
  pix: { id: string; date: string; amount: number; payer_name: string | null }
  reason: "amount_only" | "ambiguous"
  registration_ids: string[]
  donation_count: number
}

const STATUS: Record<Status, { label: string; className: string }> = {
  pending_payment: { label: "Aguardando PIX", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  paid: { label: "Pago", className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  sponsored: { label: "Custeada", className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  cancelled: { label: "Cancelada", className: "bg-muted text-muted-foreground" },
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dateBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
const ymdBR = (ymd: string) => ymd.split("-").reverse().join("/")

export function ConfraternizacaoManager() {
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [filter, setFilter] = useState<Status | "all">("all")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ reg: Registration; action: "mark_paid" | "cancel" | "reopen" } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/confraternizacao/admin", { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao carregar")
      setData(json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar inscrições")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const byId = useMemo(() => new Map((data?.registrations ?? []).map((r) => [r.id, r])), [data])

  const visible = useMemo(() => {
    const q = search
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
    return (data?.registrations ?? []).filter((r) => {
      if (filter !== "all" && r.status !== filter) return false
      if (!q) return true
      const hay = [r.contact_name, r.payer_name ?? "", r.contact_phone, ...r.confra_participants.map((p) => p.name)]
        .join(" ")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [data, filter, search])

  const checkPayments = async () => {
    setChecking(true)
    try {
      const res = await fetch("/api/confraternizacao/admin/conferir", { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao conferir")
      setSuggestions(json.suggestions)
      toast.success(
        json.confirmed > 0
          ? `${json.confirmed} ${json.confirmed === 1 ? "pagamento confirmado" : "pagamentos confirmados"}`
          : "Nenhum pagamento novo encontrado"
      )
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao conferir pagamentos")
    } finally {
      setChecking(false)
    }
  }

  const act = async (id: string, body: Record<string, unknown>) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/confraternizacao/admin/inscricoes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao atualizar")
      toast.success("Inscrição atualizada")
      await load()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar inscrição")
      return false
    } finally {
      setBusyId(null)
    }
  }

  const confirmWithPix = async (s: Suggestion, regId: string) => {
    const ok = await act(regId, { action: "mark_paid", pix: s.pix })
    if (ok) setSuggestions((cur) => cur?.filter((x) => x.pix.id !== s.pix.id) ?? null)
  }

  const confirmDonation = async (s: Suggestion) => {
    setBusyId(s.pix.id)
    try {
      const res = await fetch("/api/confraternizacao/admin/doacoes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pix: s.pix }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao confirmar doação")
      toast.success("Doação confirmada")
      setSuggestions((cur) => cur?.filter((x) => x.pix.id !== s.pix.id) ?? null)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao confirmar doação")
    } finally {
      setBusyId(null)
    }
  }

  const exportRows = () =>
    (data?.registrations ?? [])
      .filter((r) => r.status !== "cancelled")
      .flatMap((r) =>
        r.confra_participants.map((p, i) => ({
          participante: p.name,
          idade: p.age,
          tipo: p.is_child ? "Criança (não pagante)" : r.status === "sponsored" ? "Custeado" : "Pagante",
          telefone: maskPhone(p.phone ?? (i === 0 ? r.contact_phone : "")),
          responsavel: r.contact_name,
          status: STATUS[r.status].label,
        }))
      )

  const exportCsv = () => {
    const rows = exportRows()
    const header = ["Participante", "Idade", "Tipo", "Telefone", "Responsável", "Status"]
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const csv = [header, ...rows.map((r) => Object.values(r))].map((line) => line.map(esc).join(";")).join("\r\n")
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `confraternizacao-participantes-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    if (!data) return
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    doc.setFontSize(16)
    doc.text(`${data.event.title} - Participantes`, pageWidth / 2, 18, { align: "center" })
    doc.setFontSize(10)
    const s = data.stats
    doc.text(
      `${s.participants} participantes · ${s.payers} pagantes · ${s.children} crianças · ${s.sponsored_people} custeados`,
      pageWidth / 2,
      26,
      { align: "center" }
    )
    autoTable(doc, {
      startY: 32,
      head: [["Participante", "Idade", "Tipo", "Telefone", "Responsável", "Status"]],
      body: exportRows().map((r) => Object.values(r).map(String)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    })
    doc.save(`confraternizacao-participantes-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Não foi possível carregar as inscrições.{" "}
        <Button variant="link" onClick={load}>
          Tentar de novo
        </Button>
      </div>
    )
  }

  const s = data.stats
  const totalDonated = s.donations_with_registration + s.standalone_donations_paid

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          Inscrições da {data.event.title.toLowerCase()} ·{" "}
          <a href="/confraternizacao" target="_blank" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
            página pública <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={checkPayments} disabled={checking || !data.pluggy_configured}>
            {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Conferir pagamentos agora
          </Button>
          <Button variant="outline" onClick={exportPdf}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {(!data.pluggy_configured || !data.pix_configured) && (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <div>
            {!data.pix_configured && <p>PIX não configurado (CONFRA_PIX_KEY, CONFRA_PIX_NAME, CONFRA_PIX_CITY).</p>}
            {!data.pluggy_configured && (
              <p>Conferência automática desligada (PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET, PLUGGY_ACCOUNT_ID).</p>
            )}
          </div>
        </div>
      )}

      <ConfraternizacaoEvento event={data.event} onSaved={load} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Users} label="Participantes" value={s.participants} hint={`${s.registrations} inscrições`} />
        <Stat icon={Wallet} label="Pagantes" value={s.payers} hint={`${brl(s.paid_registrations_amount)} recebidos`} />
        <Stat icon={Baby} label="Crianças (não pagantes)" value={s.children} hint="até 9 anos" />
        <Stat
          icon={HandHeart}
          label="Pediram ajuda"
          value={s.sponsored_people}
          hint={data.sponsorship ? `${Math.min(data.sponsorship.covered, s.sponsored_people)} já custeados` : undefined}
        />
        <Stat
          icon={RefreshCw}
          label="Aguardando PIX"
          value={s.pending_count}
          hint={s.pending_count > 0 ? `${brl(s.pending_amount)} a receber` : undefined}
        />
        <Stat
          icon={Heart}
          label="Doações recebidas"
          value={brl(totalDonated)}
          hint={`cobrem ${data.sponsorship?.covered ?? 0} inscrições`}
        />
        <Stat
          icon={Heart}
          label="Doações avulsas"
          value={brl(s.standalone_donations_paid)}
          hint={s.standalone_donations_pending > 0 ? `${s.standalone_donations_pending} aguardando PIX` : undefined}
        />
        <Stat
          icon={Wallet}
          label="Total arrecadado"
          value={brl(s.paid_registrations_amount + totalDonated)}
        />
      </div>

      {suggestions && suggestions.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-900">
          <CardHeader>
            <CardTitle className="text-lg">PIX para revisar</CardTitle>
            <CardDescription>
              Estes PIX têm o valor de alguma pendência, mas o nome do pagador não bateu (ou bateu com mais de uma).
              Confirme só se tiver certeza.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.map((sg) => (
              <div key={sg.pix.id} className="rounded-lg border p-3 space-y-2">
                <p className="text-sm">
                  <strong>{brl(sg.pix.amount)}</strong> em {ymdBR(sg.pix.date)} de{" "}
                  <strong>{sg.pix.payer_name ?? "pagador não informado"}</strong>
                  {sg.reason === "ambiguous" && <Badge variant="outline" className="ml-2">nome em mais de uma inscrição</Badge>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {sg.registration_ids.map((id) => {
                    const reg = byId.get(id)
                    if (!reg || reg.status !== "pending_payment") return null
                    return (
                      <Button
                        key={id}
                        size="sm"
                        variant="outline"
                        disabled={busyId !== null}
                        onClick={() => confirmWithPix(sg, id)}
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Inscrição de {reg.contact_name}
                      </Button>
                    )
                  })}
                  {sg.donation_count > 0 && (
                    <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => confirmDonation(sg)}>
                      <Heart className="mr-1 h-3.5 w-3.5" /> Doação avulsa
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="text-lg">Inscrições</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as Status | "all")}>
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {(Object.keys(STATUS) as Status[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {STATUS[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Nenhuma inscrição.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 w-8" />
                    <th className="px-4 py-2">Responsável</th>
                    <th className="px-4 py-2">Pessoas</th>
                    <th className="px-4 py-2">Valor</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const open = expanded.has(r.id)
                    return (
                      <Fragment key={r.id}>
                        <tr className="border-b">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              aria-label={open ? "Recolher participantes" : "Ver participantes"}
                              onClick={() =>
                                setExpanded((cur) => {
                                  const next = new Set(cur)
                                  if (next.has(r.id)) next.delete(r.id)
                                  else next.add(r.id)
                                  return next
                                })
                              }
                            >
                              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{r.contact_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {maskPhone(r.contact_phone)} · {dateBR(r.created_at)}
                            </p>
                            {r.payer_name && <p className="text-xs text-muted-foreground">PIX por: {r.payer_name}</p>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {r.payers_count} {r.cannot_pay ? "custeado(s)" : "pagante(s)"}
                            {r.free_count > 0 && <span className="text-muted-foreground"> + {r.free_count} criança(s)</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {r.cannot_pay ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <>
                                {brl(r.total_expected)}
                                {r.donation_amount > 0 && (
                                  <p className="text-xs text-rose-600">inclui {brl(r.donation_amount)} de doação</p>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={STATUS[r.status].className} variant="secondary">
                              {STATUS[r.status].label}
                            </Badge>
                            {r.payment && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {r.payment.match === "auto" ? "automático" : "manual"}
                                {r.payment.tx_date && ` · ${ymdBR(r.payment.tx_date)}`}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {busyId === r.id ? (
                              <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                            ) : (
                              <div className="flex justify-end gap-1">
                                {r.status === "pending_payment" && (
                                  <Button size="sm" variant="outline" onClick={() => setConfirm({ reg: r, action: "mark_paid" })}>
                                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Pago
                                  </Button>
                                )}
                                {r.status === "cancelled" || r.status === "paid" ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label="Reabrir inscrição"
                                    onClick={() => setConfirm({ reg: r, action: "reopen" })}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </Button>
                                ) : null}
                                {r.status !== "cancelled" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label="Cancelar inscrição"
                                    onClick={() => setConfirm({ reg: r, action: "cancel" })}
                                  >
                                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-b bg-muted/20">
                            <td />
                            <td colSpan={5} className="px-4 py-3">
                              <ul className="space-y-1">
                                {r.confra_participants.map((p, i) => (
                                  <li key={i} className="flex flex-wrap items-center gap-2">
                                    <span>{p.name}</span>
                                    <span className="text-muted-foreground">· {p.age} anos</span>
                                    {p.phone && <span className="text-muted-foreground">· {maskPhone(p.phone)}</span>}
                                    {p.is_child && (
                                      <Badge variant="secondary" className="gap-1">
                                        <Baby className="h-3 w-3" /> Não pagante
                                      </Badge>
                                    )}
                                  </li>
                                ))}
                              </ul>
                              {r.payment?.payer_name && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  PIX recebido de {r.payment.payer_name} ({brl(r.payment.amount)})
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "mark_paid"
                ? "Marcar como pago?"
                : confirm?.action === "cancel"
                  ? "Cancelar inscrição?"
                  : "Reabrir inscrição?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "mark_paid" &&
                `Confirma que o PIX de ${brl(confirm.reg.total_expected)} da inscrição de ${confirm.reg.contact_name} foi recebido?`}
              {confirm?.action === "cancel" &&
                `A inscrição de ${confirm.reg.contact_name} sai das contagens. Se já estava paga, o PIX fica livre para outra inscrição.`}
              {confirm?.action === "reopen" &&
                `A inscrição de ${confirm.reg.contact_name} volta ao status inicial e o pagamento registrado é desfeito.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm) act(confirm.reg.id, { action: confirm.action })
                setConfirm(null)
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
