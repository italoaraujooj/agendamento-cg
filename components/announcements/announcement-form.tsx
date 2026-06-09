"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, Upload, X, CalendarDays, Info, ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { getNextEligibleSunday, getLastSundayBeforeDate, addWeeks, sundaysBetween, formatSunday } from "@/lib/announcements"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface AnnouncementFormProps { onSuccess?: () => void }

export function AnnouncementForm({ onSuccess }: AnnouncementFormProps) {
  const [type, setType] = useState<"event" | "general" | "ministry">("event")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [ministryName, setMinistryName] = useState("")
  const [location, setLocation] = useState("")
  const [eventTime, setEventTime] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [registrationType, setRegistrationType] = useState<"free" | "paid">("free")
  const [registrationValue, setRegistrationValue] = useState("")
  const [registrationWhere, setRegistrationWhere] = useState("")
  const [repeatWeeks, setRepeatWeeks] = useState(1)
  const [hasArt, setHasArt] = useState(false)
  const [artFile, setArtFile] = useState<File | null>(null)
  const [artPreview, setArtPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingArt, setUploadingArt] = useState(false)
  const [confirmedSundays, setConfirmedSundays] = useState<Date[] | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const previewSundays = (): Date[] => {
    const first = getNextEligibleSunday(new Date())
    if (type === "event" && eventDate) {
      const ed = new Date(eventDate + "T12:00:00")
      const last = getLastSundayBeforeDate(ed)
      return last >= first ? sundaysBetween(first, last) : []
    }
    const last = addWeeks(first, repeatWeeks - 1)
    return sundaysBetween(first, last)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 52_428_800) { toast.error("Arquivo muito grande. Máximo: 50 MB."); return }
    setArtFile(file)
    const url = URL.createObjectURL(file)
    setArtPreview(url)
  }

  const removeArt = () => {
    setArtFile(null)
    if (artPreview) URL.revokeObjectURL(artPreview)
    setArtPreview(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = { type, title }
      if (description) body.description = description
      if (ministryName) body.ministry_name = ministryName

      if (type === "event") {
        if (!location || !eventTime || !eventDate) {
          toast.error("Preencha local, horário e data do evento."); return
        }
        body.location = location
        body.event_time = eventTime
        body.event_date = eventDate
        body.registration_type = registrationType
        if (registrationType === "paid") {
          body.registration_value = parseFloat(registrationValue) || null
          body.registration_where = registrationWhere || null
        }
      } else {
        if (!description) { toast.error("Descrição é obrigatória."); return }
        if (type === "ministry" && !ministryName) { toast.error("Informe o ministério responsável."); return }
        body.repeat_weeks = repeatWeeks
      }

      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Erro ao enviar aviso"); return }

      const announcementId = data.announcement.id

      if (hasArt && artFile) {
        setUploadingArt(true)
        const fd = new FormData()
        fd.append("file", artFile)
        const artRes = await fetch(`/api/announcements/${announcementId}/art`, { method: "POST", body: fd })
        if (!artRes.ok) toast.error("Aviso enviado, mas houve erro no upload da arte.")
        setUploadingArt(false)
      }

      const sundays = previewSundays()
      setConfirmedSundays(sundays)
      toast.success("Aviso enviado com sucesso!")
      onSuccess?.()
    } catch {
      toast.error("Erro ao enviar aviso.")
    } finally {
      setSubmitting(false)
      setUploadingArt(false)
    }
  }

  if (confirmedSundays) {
    return (
      <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CalendarDays className="h-5 w-5" />
            <p className="font-semibold">Aviso enviado para aprovação!</p>
          </div>
          <p className="text-sm text-green-700 dark:text-green-400">
            Se aprovado, seu aviso será dado nos seguintes domingos:
          </p>
          <div className="flex flex-wrap gap-2">
            {confirmedSundays.map((d, i) => (
              <Badge key={i} variant="outline" className="bg-white dark:bg-background border-green-300 text-green-800 dark:text-green-300">
                {format(d, "dd/MM/yyyy", { locale: ptBR })}
              </Badge>
            ))}
          </div>
          {confirmedSundays.length === 0 && (
            <p className="text-sm text-amber-600">Não há domingos disponíveis com os dados informados.</p>
          )}
          <Button variant="outline" size="sm" onClick={() => {
            setConfirmedSundays(null)
            setTitle(""); setDescription(""); setLocation(""); setEventTime("")
            setEventDate(""); setRegistrationValue(""); setRegistrationWhere("")
            setMinistryName(""); setHasArt(false); removeArt()
          }}>
            Enviar outro aviso
          </Button>
        </CardContent>
      </Card>
    )
  }

  const sundays = previewSundays()

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 flex gap-2 text-sm text-amber-800 dark:text-amber-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Solicitações recebidas até <strong>sexta-feira</strong> serão incluídas no domingo seguinte. Após isso, apenas no próximo.</span>
      </div>

      {/* Tipo */}
      <div className="space-y-2">
        <Label>Tipo de aviso</Label>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="event">📅 Evento</SelectItem>
            <SelectItem value="general">📣 Comunicado Geral</SelectItem>
            <SelectItem value="ministry">⛪ Aviso de Ministério</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Título */}
      <div className="space-y-2">
        <Label>Título <span className="text-red-500">*</span></Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Retiro de Jovens 2025" required maxLength={200} />
      </div>

      {/* Ministério (obrigatório para ministry, opcional para event) */}
      {(type === "ministry" || type === "event") && (
        <div className="space-y-2">
          <Label>Ministério responsável {type === "ministry" && <span className="text-red-500">*</span>}</Label>
          <Input
            value={ministryName}
            onChange={e => setMinistryName(e.target.value)}
            placeholder="Ex: Ministério de Louvor"
            maxLength={150}
          />
        </div>
      )}

      {/* Campos de Evento */}
      {type === "event" && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Local do Evento <span className="text-red-500">*</span></Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: Salão Principal" required maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Horário <span className="text-red-500">*</span></Label>
              <Input value={eventTime} onChange={e => setEventTime(e.target.value)} placeholder="Ex: 19h30" required maxLength={20} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data do Evento <span className="text-red-500">*</span></Label>
            <Input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Inscrição <span className="text-red-500">*</span></Label>
            <RadioGroup value={registrationType} onValueChange={(v: string) => setRegistrationType(v as "free" | "paid")} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="free" id="free" />
                <Label htmlFor="free" className="cursor-pointer">Gratuita</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="paid" id="paid" />
                <Label htmlFor="paid" className="cursor-pointer">Paga</Label>
              </div>
            </RadioGroup>
          </div>
          {registrationType === "paid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" min="0" step="0.01" value={registrationValue} onChange={e => setRegistrationValue(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Onde fazer a inscrição</Label>
                <Input value={registrationWhere} onChange={e => setRegistrationWhere(e.target.value)} placeholder="Ex: link, local, pessoa responsável" maxLength={300} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Descrição */}
      <div className="space-y-2">
        <Label>
          Descrição {(type === "general" || type === "ministry") && <span className="text-red-500">*</span>}
        </Label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder={type === "event" ? "Informações adicionais sobre o evento (opcional)" : "Descreva o comunicado..."}
          rows={3}
          maxLength={1000}
        />
      </div>

      {/* Repetição (non-event) */}
      {type !== "event" && (
        <div className="space-y-2">
          <Label>Repetir por</Label>
          <Select value={String(repeatWeeks)} onValueChange={v => setRepeatWeeks(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Apenas o próximo domingo</SelectItem>
              <SelectItem value="2">2 domingos</SelectItem>
              <SelectItem value="3">3 domingos</SelectItem>
              <SelectItem value="4">4 domingos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Arte */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Possui arte para o aviso?
          </Label>
          <Switch checked={hasArt} onCheckedChange={setHasArt} />
        </div>
        {hasArt && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Formato ideal: <strong>1920×1080 px</strong> (16:9). Aceito: JPG, PNG, WebP, GIF, MP4, MOV. Máx: 50 MB.
            </p>
            {artPreview ? (
              <div className="relative rounded-lg overflow-hidden border">
                {artFile?.type.startsWith("video/") ? (
                  <video src={artPreview} controls className="w-full max-h-64 object-contain bg-black" />
                ) : (
                  <img src={artPreview} alt="Preview da arte" className="w-full max-h-64 object-contain bg-muted" />
                )}
                <Button
                  type="button" size="icon" variant="destructive"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={removeArt}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Clique para selecionar imagem ou vídeo</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" className="hidden" onChange={handleFileChange} />
          </div>
        )}
      </div>

      {/* Preview dos domingos */}
      {sundays.length > 0 && (
        <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-3 space-y-2">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Domingos em que o aviso será dado (se aprovado):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sundays.map((d, i) => (
              <Badge key={i} variant="outline" className="bg-white dark:bg-background border-blue-200 text-blue-700 dark:text-blue-300 text-xs">
                {format(d, "dd/MM", { locale: ptBR })}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {type === "event" && eventDate && sundays.length === 0 && (
        <p className="text-sm text-amber-600 flex items-center gap-2">
          <Info className="h-4 w-4" />
          A data do evento é muito próxima para inclusão nos avisos.
        </p>
      )}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" />{uploadingArt ? "Enviando arte..." : "Enviando..."}</>
        ) : "Enviar solicitação de aviso"}
      </Button>
    </form>
  )
}
