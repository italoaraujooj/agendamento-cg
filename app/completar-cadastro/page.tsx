"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Lock, User, Phone } from "lucide-react"
import { toast } from "sonner"

interface ServantData {
  name: string
  phone: string | null
}

export default function CompletarCadastroPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [servant, setServant] = useState<ServantData | null>(null)

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace("/login")
        return
      }

      const userId = session.user.id

      // Buscar dados do servo vinculado para pré-preencher
      const { data: servantData } = await supabase
        .from("servants")
        .select("name, phone")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .single()

      if (servantData) {
        setServant(servantData)
        setFullName(servantData.name || "")
        setPhone(servantData.phone || "")
      } else {
        // Tentar pré-preencher pelo perfil já existente
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", userId)
          .single()
        if (profile) {
          setFullName(profile.full_name || "")
          setPhone(profile.phone || "")
        }
      }

      setLoading(false)
    }

    init()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fullName.trim()) {
      toast.error("Informe seu nome")
      return
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres")
      return
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem")
      return
    }

    setSubmitting(true)
    try {
      // Definir senha
      const { error: pwError } = await supabase.auth.updateUser({ password })
      if (pwError) {
        toast.error(pwError.message)
        return
      }

      // Atualizar perfil
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          profile_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", (await supabase.auth.getUser()).data.user!.id)

      if (profileError) {
        toast.error("Erro ao salvar perfil")
        return
      }

      toast.success("Cadastro concluído! Bem-vindo ao sistema.")
      router.push("/")
    } catch {
      toast.error("Erro ao concluir cadastro")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Completar cadastro</CardTitle>
          <CardDescription>
            {servant
              ? "Encontramos seu cadastro no módulo de escalas. Confirme seus dados e defina uma senha para acessar o sistema."
              : "Defina sua senha e complete seu perfil para acessar o sistema."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Nome completo
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Telefone
                <span className="text-muted-foreground text-xs font-normal">(opcional)</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(67) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Confirmar senha
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={submitting}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Concluir cadastro"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
