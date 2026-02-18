"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { User, Phone, Mail, Loader2, CheckCircle } from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useAuth } from "./auth-provider"
import { maskPhone } from "@/lib/masks"

interface ProfileData {
  full_name: string | null
  phone: string | null
  profile_completed: boolean
}

export function CompleteProfileModal() {
  const { user, isAuthenticated } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
  })

  // Verificar se o perfil está completo ao carregar
  useEffect(() => {
    const checkProfile = async () => {
      if (!isAuthenticated || !user) {
        setIsLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, phone, profile_completed")
          .eq("id", user.id)
          .single()

        if (error) {
          // Silenciar erros de coluna inexistente ou perfil não encontrado
          // (migração 013 pode não ter sido executada ainda)
          if (error.code !== "PGRST116") {
            console.warn("Erro ao verificar perfil:", error.message || error.code || JSON.stringify(error))
          }
          setIsLoading(false)
          return
        }

        setProfileData(data)

        // Se o perfil não está completo, mostrar o modal
        if (!data.profile_completed) {
          // Preencher o formulário com dados existentes
          setForm({
            full_name: data.full_name || user.user_metadata?.full_name || user.user_metadata?.name || "",
            phone: data.phone || "",
          })
          setIsOpen(true)
        }
      } catch {
        // Ignorar silenciosamente - perfil pode não existir ainda
      } finally {
        setIsLoading(false)
      }
    }

    checkProfile()
  }, [isAuthenticated, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.full_name.trim()) {
      toast.error("Por favor, informe seu nome completo")
      return
    }

    if (!form.phone.trim()) {
      toast.error("Por favor, informe seu telefone")
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          profile_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user?.id)

      if (error) throw error

      toast.success("Perfil atualizado com sucesso!")
      setIsOpen(false)
    } catch (error: any) {
      console.error("Erro ao atualizar perfil:", error)
      toast.error(error.message || "Erro ao atualizar perfil")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Permitir pular (mas lembrar depois)
  const handleSkip = async () => {
    // Apenas fechar o modal, não marca como completo
    setIsOpen(false)
    toast.info("Você pode completar seu perfil a qualquer momento na página de Perfil")
  }

  // Não renderizar nada enquanto carrega ou se usuário não está autenticado
  if (isLoading || !isAuthenticated || !user) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Complete seu Perfil
          </DialogTitle>
          <DialogDescription>
            Para uma melhor experiência, precisamos de algumas informações adicionais.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Email (readonly) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={user.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email da sua conta
            </p>
          </div>

          {/* Nome completo */}
          <div className="space-y-2">
            <Label htmlFor="full_name" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Nome Completo *
            </Label>
            <Input
              id="full_name"
              type="text"
              placeholder="Seu nome completo"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              required
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Telefone *
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(99) 99999-9999"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
              maxLength={15}
              required
            />
            <p className="text-xs text-muted-foreground">
              Usado para contato sobre suas reservas
            </p>
          </div>

          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleSkip}
              className="order-2 sm:order-1"
              disabled={isSubmitting}
            >
              Completar depois
            </Button>
            <Button
              type="submit"
              className="flex-1 order-1 sm:order-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Salvar Perfil
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
