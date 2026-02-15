"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Search, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { maskPhone } from "@/lib/masks"
import type { Servant, Area, Ministry } from "@/types/escalas"

interface ServantWithArea extends Servant {
  area?: Area & { ministry?: Ministry }
}

interface ServantFormProps {
  areaId: string
  servant?: Servant
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ServantForm({ areaId, servant, open, onOpenChange, onSuccess }: ServantFormProps) {
  const isEditing = !!servant

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: servant?.name || "",
    email: servant?.email || "",
    phone: servant?.phone || "",
    notes: servant?.notes || "",
  })

  // Existing servant search state
  const [searchQuery, setSearchQuery] = useState("")
  const [allServants, setAllServants] = useState<ServantWithArea[]>([])
  const [loadingServants, setLoadingServants] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  // Fetch all servants when dialog opens (for new servant only)
  useEffect(() => {
    if (open && !isEditing) {
      setLoadingServants(true)
      fetch("/api/escalas/servants")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            // Filter out servants already in this area
            setAllServants(data.filter((s: ServantWithArea) => s.area_id !== areaId))
          }
        })
        .catch(() => {})
        .finally(() => setLoadingServants(false))
    }
  }, [open, isEditing, areaId])

  // Close search results when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("")
      setShowResults(false)
    }
  }, [open])

  const filteredServants = searchQuery.trim().length >= 2
    ? allServants.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : []

  const handleSelectExisting = (s: ServantWithArea) => {
    setFormData({
      name: s.name,
      email: s.email || "",
      phone: s.phone || "",
      notes: s.notes || "",
    })
    setSearchQuery("")
    setShowResults(false)
    toast.info(`Dados de "${s.name}" importados. Revise e clique em Adicionar.`)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = isEditing
        ? `/api/escalas/servants/${servant.id}`
        : "/api/escalas/servants"

      const payload = {
        area_id: areaId,
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        notes: formData.notes || null,
      }

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar servo")
      }

      toast.success(isEditing ? "Servo atualizado!" : "Servo adicionado!")
      onOpenChange(false)
      onSuccess()

      // Reset form
      if (!isEditing) {
        setFormData({
          name: "",
          email: "",
          phone: "",
          notes: "",
        })
      }
    } catch (error) {
      console.error("Erro ao salvar servo:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar servo")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Servo" : "Adicionar Servo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Search existing servants - only when adding */}
            {!isEditing && (
              <div className="space-y-2" ref={searchRef}>
                <Label className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Importar de outra área
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar servo existente pelo nome ou email..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setShowResults(true)
                    }}
                    onFocus={() => setShowResults(true)}
                    className="pl-9"
                  />
                </div>
                {showResults && searchQuery.trim().length >= 2 && (
                  <div className="border rounded-md max-h-48 overflow-y-auto bg-popover shadow-md">
                    {loadingServants ? (
                      <div className="flex items-center justify-center p-3">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm text-muted-foreground">Carregando...</span>
                      </div>
                    ) : filteredServants.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3">
                        Nenhum servo encontrado.
                      </p>
                    ) : (
                      filteredServants.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b last:border-b-0"
                          onClick={() => handleSelectExisting(s)}
                        >
                          <span className="text-sm font-medium">{s.name}</span>
                          {s.area?.name && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {s.area.ministry?.name ? `${s.area.ministry.name} / ` : ""}
                              {s.area.name}
                            </span>
                          )}
                          {s.email && (
                            <span className="block text-xs text-muted-foreground">{s.email}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {!isEditing && allServants.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Digite pelo menos 2 caracteres para buscar entre {allServants.length} servo(s) de outras áreas.
                  </p>
                )}
              </div>
            )}

            {!isEditing && allServants.length > 0 && (
              <div className="border-t" />
            )}

            <div className="space-y-2">
              <Label htmlFor="servant-name">Nome Completo *</Label>
              <Input
                id="servant-name"
                placeholder="Nome do servo"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="servant-email">Email</Label>
              <Input
                id="servant-email"
                type="email"
                placeholder="email@exemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Usado para enviar link de disponibilidade
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="servant-phone">Telefone</Label>
              <Input
                id="servant-phone"
                placeholder="(00) 00000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
                maxLength={15}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="servant-notes">Observações</Label>
              <Textarea
                id="servant-notes"
                placeholder="Ex: Disponível apenas domingos manhã"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                maxLength={500}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
