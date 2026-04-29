"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  Shield,
  UserCheck,
  User,
  Search,
  Loader2,
  Mail,
  Phone,
  Crown,
  Building,
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
  KeyRound,
  UserX,
  UserCircle2,
  ChevronDown,
  Copy,
  Check,
  CalendarClock,
  LogIn,
  UserMinus,
  Link2,
  Link2Off,
  Music,
} from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import Link from "next/link"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Ministry {
  id: string
  name: string
  color: string
}

interface MinistryRole {
  id: string
  user_id: string
  ministry_id: string
  role: "leader" | "coordinator" | "helper"
  ministry?: Ministry
}

interface ServantRecord {
  id: string
  name: string
  email: string | null
  is_leader: boolean
  is_active: boolean
  area?: { id: string; name: string; ministry?: { id: string; name: string; color: string } }
}

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: "user" | "ministry_leader" | "admin"
  is_admin: boolean
  profile_completed: boolean
  created_at: string
  ministry_roles: MinistryRole[]
  // de auth.users
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  banned_until: string | null
  providers: string[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  user: {
    label: "Usuário",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    icon: User,
  },
  ministry_leader: {
    label: "Líder de Ministério",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: UserCheck,
  },
  admin: {
    label: "Administrador",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    icon: Shield,
  },
}

const MINISTRY_ROLE_CONFIG = {
  leader: { label: "Líder Principal", color: "bg-amber-100 text-amber-800" },
  coordinator: { label: "Coordenador", color: "bg-blue-100 text-blue-800" },
  helper: { label: "Auxiliar", color: "bg-green-100 text-green-800" },
}

const PROVIDER_CONFIG: Record<string, { label: string; color: string }> = {
  google: { label: "Google", color: "bg-red-100 text-red-700" },
  email: { label: "Email", color: "bg-gray-100 text-gray-700" },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "—"
  try {
    return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return "—"
  }
}

function isUserBanned(bannedUntil: string | null) {
  if (!bannedUntil) return false
  return new Date(bannedUntil) > new Date()
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsuariosPage() {
  const router = useRouter()
  const { isAuthenticated, isAdmin, adminChecked, loading: authLoading, user: currentUser } = useAuth()
  const { setMode } = useSystemMode()

  const [users, setUsers] = useState<UserProfile[]>([])
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRole, setFilterRole] = useState("all")
  const [filterStatus, setFilterStatus] = useState("active")

  // Sheet de edição
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [editTab, setEditTab] = useState("account")
  const [editRole, setEditRole] = useState<UserProfile["role"]>("user")
  const [isSavingRole, setIsSavingRole] = useState(false)

  // Ministérios (aba 2)
  const [addingMinistry, setAddingMinistry] = useState(false)
  const [newMinistryForm, setNewMinistryForm] = useState({ ministry_id: "", role: "leader" as MinistryRole["role"] })
  const [isSavingMinistry, setIsSavingMinistry] = useState(false)

  // Servos (aba 3)
  const [servants, setServants] = useState<ServantRecord[]>([])
  const [unlinkedServants, setUnlinkedServants] = useState<ServantRecord[]>([])
  const [loadingServants, setLoadingServants] = useState(false)
  const [linkingServantId, setLinkingServantId] = useState("")
  const [isSavingServant, setIsSavingServant] = useState(false)

  // Dialogs
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; user: UserProfile | null }>({ open: false, user: null })
  const [removeMinistryDialog, setRemoveMinistryDialog] = useState<{ open: boolean; roleId: string; ministryName: string } | null>(null)
  const [unlinkServantDialog, setUnlinkServantDialog] = useState<{ open: boolean; servantId: string; servantName: string } | null>(null)

  // Reset password dialog
  const [resetDialog, setResetDialog] = useState<{ open: boolean; link: string | null; email: string }>({ open: false, link: null, email: "" })
  const [isCopied, setIsCopied] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  useEffect(() => { setMode("agendamentos") }, [setMode])

  useEffect(() => {
    if (!authLoading && adminChecked) {
      if (!isAuthenticated || !isAdmin) {
        toast.error("Acesso negado")
        router.push("/admin")
      }
    }
  }, [authLoading, isAuthenticated, isAdmin, adminChecked, router])

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/users")
      if (!res.ok) throw new Error("Erro ao buscar usuários")
      const { users: data } = await res.json()
      setUsers(data ?? [])
    } catch (error) {
      console.error(error)
      toast.error("Erro ao carregar usuários")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMinistries = useCallback(async () => {
    const { data } = await supabase
      .from("ministries")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name")
    setMinistries(data ?? [])
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchUsers()
      fetchMinistries()
    }
  }, [isAdmin, fetchUsers, fetchMinistries])

  // Forçar limpeza do scroll-lock do Radix após fechar o Sheet
  useEffect(() => {
    if (!isSheetOpen) {
      const timer = setTimeout(() => {
        // react-remove-scroll injeta classes block-interactivity-* no body
        const classesToRemove = Array.from(document.body.classList).filter((c) =>
          c.startsWith("block-interactivity-")
        )
        classesToRemove.forEach((c) => document.body.classList.remove(c))
        // limpar qualquer pointer-events inline residual
        document.body.style.removeProperty("pointer-events")
      }, 350)
      return () => clearTimeout(timer)
    }
  }, [isSheetOpen])

  // Carregar servos vinculados e todos os disponíveis para vincular
  const fetchServants = useCallback(async (userId: string, userEmail: string, userName: string | null) => {
    setLoadingServants(true)
    try {
      const servantSelect = "id, name, email, is_leader, is_active, area:areas!servants_area_id_fkey(id, name, ministry:ministries(id, name, color))"

      // Servos já vinculados a este usuário
      const { data: linked } = await supabase
        .from("servants")
        .select(servantSelect)
        .eq("user_id", userId)

      setServants((linked ?? []) as unknown as ServantRecord[])

      // Todos os servos ativos sem user_id (de qualquer ministério)
      const { data: unlinked } = await supabase
        .from("servants")
        .select(servantSelect)
        .is("user_id", null)
        .eq("is_active", true)
        .order("name")

      const unlinkedList = (unlinked ?? []) as unknown as ServantRecord[]

      // Vinculação automática por email exato
      const emailMatches = unlinkedList.filter(
        (s) => s.email && userEmail && s.email.toLowerCase() === userEmail.toLowerCase()
      )

      if (emailMatches.length > 0) {
        await supabase
          .from("servants")
          .update({ user_id: userId })
          .in("id", emailMatches.map((s) => s.id))

        // Se o perfil não tem nome, puxar do primeiro servo vinculado
        if (!userName?.trim() && emailMatches[0].name) {
          await supabase
            .from("profiles")
            .update({ full_name: emailMatches[0].name })
            .eq("id", userId)
          setEditingUser((prev) => prev ? { ...prev, full_name: emailMatches[0].name } : prev)
          setUsers((prev) =>
            prev.map((u) => u.id === userId ? { ...u, full_name: emailMatches[0].name } : u)
          )
        }

        toast.success(
          emailMatches.length === 1
            ? `Servo "${emailMatches[0].name}" vinculado automaticamente por email.`
            : `${emailMatches.length} servos vinculados automaticamente por email.`
        )

        // Re-buscar após a vinculação automática
        const { data: linkedAfter } = await supabase
          .from("servants")
          .select(servantSelect)
          .eq("user_id", userId)

        setServants((linkedAfter ?? []) as unknown as ServantRecord[])

        const autoLinkedIds = new Set(emailMatches.map((s) => s.id))
        setUnlinkedServants(unlinkedList.filter((s) => !autoLinkedIds.has(s.id)))
      } else {
        setUnlinkedServants(unlinkedList)
      }
    } catch (error) {
      console.error("Erro ao buscar servos:", error)
    } finally {
      setLoadingServants(false)
    }
  }, [])

  // ── Abrir sheet de edição ──────────────────────────────────────────────────

  const openEditSheet = (user: UserProfile) => {
    setEditingUser(user)
    setEditRole(user.role)
    setEditTab("account")
    setAddingMinistry(false)
    setNewMinistryForm({ ministry_id: "", role: "leader" })
    setServants([])
    setUnlinkedServants([])
    setLinkingServantId("")
    setIsSheetOpen(true)
  }

  const closeEditSheet = () => {
    setIsSheetOpen(false)
    // limpar dados após a animação de fechar (~300ms)
    setTimeout(() => setEditingUser(null), 350)
  }

  const handleTabChange = (tab: string) => {
    setEditTab(tab)
    if (tab === "servants" && editingUser) {
      fetchServants(editingUser.id, editingUser.email, editingUser.full_name)
    }
  }

  // ── Salvar role ────────────────────────────────────────────────────────────

  const handleSaveRole = async () => {
    if (!editingUser) return
    if (editingUser.id === currentUser?.id && editRole !== "admin") {
      toast.error("Não é possível remover seu próprio acesso de administrador")
      return
    }
    setIsSavingRole(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: editRole, is_admin: editRole === "admin" })
        .eq("id", editingUser.id)
      if (error) throw error
      toast.success("Role atualizado com sucesso!")
      await fetchUsers()
      setEditingUser((prev) => prev ? { ...prev, role: editRole, is_admin: editRole === "admin" } : prev)
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar role")
    } finally {
      setIsSavingRole(false)
    }
  }

  // ── Reset senha ────────────────────────────────────────────────────────────

  const handleResetPassword = async (user: UserProfile) => {
    setIsResetting(true)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResetDialog({ open: true, link: data.link, email: data.email })
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar link de recuperação")
    } finally {
      setIsResetting(false)
    }
  }

  const handleCopyLink = async () => {
    if (!resetDialog.link) return
    await navigator.clipboard.writeText(resetDialog.link)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // ── Ativar / desativar ─────────────────────────────────────────────────────

  const handleToggleStatus = async () => {
    if (!statusDialog.user) return
    setIsTogglingStatus(true)
    try {
      const isBanned = isUserBanned(statusDialog.user.banned_until)
      const res = await fetch(`/api/admin/users/${statusDialog.user.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: isBanned }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(data.message)
      setStatusDialog({ open: false, user: null })
      await fetchUsers()
      // Atualizar editingUser se aberto
      if (editingUser?.id === statusDialog.user.id) {
        setEditingUser((prev) => prev ? {
          ...prev,
          banned_until: isBanned ? null : new Date(Date.now() + 876000 * 3600 * 1000).toISOString(),
        } : prev)
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar status")
    } finally {
      setIsTogglingStatus(false)
    }
  }

  // ── Ministérios ────────────────────────────────────────────────────────────

  const handleAddMinistry = async () => {
    if (!editingUser || !newMinistryForm.ministry_id) return
    setIsSavingMinistry(true)
    try {
      const { error } = await supabase
        .from("user_ministry_roles")
        .insert({ user_id: editingUser.id, ministry_id: newMinistryForm.ministry_id, role: newMinistryForm.role })
      if (error) {
        if (error.code === "23505") throw new Error("Usuário já vinculado a este ministério")
        throw error
      }
      if (editingUser.role === "user") {
        await supabase.from("profiles").update({ role: "ministry_leader" }).eq("id", editingUser.id)
      }
      toast.success("Ministério vinculado!")
      setAddingMinistry(false)
      setNewMinistryForm({ ministry_id: "", role: "leader" })
      await fetchUsers()
      // Refetch editingUser
      const updated = await supabase
        .from("user_ministry_roles")
        .select("id, user_id, ministry_id, role, ministry:ministries(id, name, color)")
        .eq("user_id", editingUser.id)
      setEditingUser((prev) => prev ? { ...prev, ministry_roles: (updated.data ?? []) as unknown as MinistryRole[] } : prev)
    } catch (error: any) {
      toast.error(error.message || "Erro ao vincular ministério")
    } finally {
      setIsSavingMinistry(false)
    }
  }

  const handleRemoveMinistry = async () => {
    if (!removeMinistryDialog || !editingUser) return
    try {
      const { error } = await supabase.from("user_ministry_roles").delete().eq("id", removeMinistryDialog.roleId)
      if (error) throw error
      const remaining = editingUser.ministry_roles.filter((r) => r.id !== removeMinistryDialog.roleId)
      if (remaining.length === 0 && editingUser.role === "ministry_leader") {
        await supabase.from("profiles").update({ role: "user" }).eq("id", editingUser.id)
      }
      toast.success("Vínculo removido!")
      setRemoveMinistryDialog(null)
      setEditingUser((prev) => prev ? { ...prev, ministry_roles: remaining } : prev)
      await fetchUsers()
    } catch (error: any) {
      toast.error(error.message || "Erro ao remover vínculo")
    }
  }

  // ── Servos ─────────────────────────────────────────────────────────────────

  const handleLinkServant = async () => {
    if (!editingUser || !linkingServantId) return
    setIsSavingServant(true)
    try {
      const { error } = await supabase
        .from("servants")
        .update({ user_id: editingUser.id })
        .eq("id", linkingServantId)
      if (error) throw error
      toast.success("Servo vinculado!")
      setLinkingServantId("")
      await fetchServants(editingUser.id, editingUser.email, editingUser.full_name)
    } catch (error: any) {
      toast.error(error.message || "Erro ao vincular servo")
    } finally {
      setIsSavingServant(false)
    }
  }

  const handleUnlinkServant = async () => {
    if (!unlinkServantDialog || !editingUser) return
    try {
      const { error } = await supabase
        .from("servants")
        .update({ user_id: null })
        .eq("id", unlinkServantDialog.servantId)
      if (error) throw error
      toast.success("Servo desvinculado!")
      setUnlinkServantDialog(null)
      await fetchServants(editingUser.id, editingUser.email, editingUser.full_name)
    } catch (error: any) {
      toast.error(error.message || "Erro ao desvincular servo")
    }
  }

  // ── Filtros ────────────────────────────────────────────────────────────────

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === "all" || u.role === filterRole
    const banned = isUserBanned(u.banned_until)
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && !banned) ||
      (filterStatus === "inactive" && banned)
    return matchesSearch && matchesRole && matchesStatus
  })

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.is_admin).length,
    leaders: users.filter((u) => u.role === "ministry_leader").length,
    inactive: users.filter((u) => isUserBanned(u.banned_until)).length,
  }

  if (authLoading || !adminChecked) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button variant="ghost" asChild className="w-fit">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Admin
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">Gerencie roles, permissões e vínculos de todos os usuários do sistema.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total de Usuários
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Administradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-700 dark:text-purple-400">{stats.admins}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Crown className="h-4 w-4" />
              Líderes de Ministério
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{stats.leaders}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300 flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Desativados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-700 dark:text-red-400">{stats.inactive}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os roles</SelectItem>
            <SelectItem value="admin">Administradores</SelectItem>
            <SelectItem value="ministry_leader">Líderes de Ministério</SelectItem>
            <SelectItem value="user">Usuários Comuns</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Desativados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando usuários...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card className="p-10 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="text-lg font-semibold mb-1">Nenhum usuário encontrado</h4>
          <p className="text-muted-foreground text-sm">Tente ajustar os filtros de busca.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredUsers.map((user) => {
            const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.user
            const RoleIcon = roleConfig.icon
            const banned = isUserBanned(user.banned_until)
            const isSelf = user.id === currentUser?.id

            return (
              <Card key={user.id} className={`transition-shadow hover:shadow-md ${banned ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className={`p-2 rounded-full shrink-0 ${roleConfig.color}`}>
                        <RoleIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{user.full_name || "Sem nome"}</p>
                          <Badge variant="outline" className={roleConfig.color}>
                            {roleConfig.label}
                          </Badge>
                          {banned && (
                            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                              <UserX className="h-3 w-3 mr-1" />
                              Desativado
                            </Badge>
                          )}
                          {!user.profile_completed && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Perfil incompleto
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap mt-1">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </span>
                          {user.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {user.phone}
                            </span>
                          )}
                          {user.providers?.map((p) => {
                            const cfg = PROVIDER_CONFIG[p] || { label: p, color: "bg-gray-100 text-gray-700" }
                            return (
                              <Badge key={p} variant="secondary" className={`text-xs ${cfg.color}`}>
                                {cfg.label}
                              </Badge>
                            )
                          })}
                        </div>

                        {user.last_sign_in_at && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <LogIn className="h-3 w-3" />
                            Último acesso: {formatDate(user.last_sign_in_at)}
                          </p>
                        )}

                        {user.ministry_roles?.length > 0 && (
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Building className="h-3 w-3 text-muted-foreground" />
                            {user.ministry_roles.map((mr) => (
                              <Badge
                                key={mr.id}
                                variant="secondary"
                                className="text-xs"
                                style={{
                                  backgroundColor: `${mr.ministry?.color}20`,
                                  borderColor: mr.ministry?.color,
                                  color: mr.ministry?.color,
                                }}
                              >
                                {mr.ministry?.name} ({MINISTRY_ROLE_CONFIG[mr.role]?.label})
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="shrink-0">
                          Editar
                          <ChevronDown className="ml-1 h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditSheet(user)}>
                          <UserCircle2 className="h-4 w-4 mr-2" />
                          Gerenciar usuário
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleResetPassword(user)}
                          disabled={isResetting}
                        >
                          <KeyRound className="h-4 w-4 mr-2" />
                          Recuperar senha
                        </DropdownMenuItem>
                        {!isSelf && !user.is_admin && (
                          <DropdownMenuItem
                            className={banned ? "text-green-600 focus:text-green-600" : "text-red-600 focus:text-red-600"}
                            onClick={() => setStatusDialog({ open: true, user })}
                          >
                            {banned ? (
                              <><UserCheck className="h-4 w-4 mr-2" />Reativar conta</>
                            ) : (
                              <><UserX className="h-4 w-4 mr-2" />Desativar conta</>
                            )}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Sheet de edição ────────────────────────────────────────────────── */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => { if (!open) closeEditSheet() }}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden p-0">
          {editingUser && (
            <>
              {/* Header fixo com padding para o botão X */}
              <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
                <SheetTitle>{editingUser.full_name || "Sem nome"}</SheetTitle>
                <SheetDescription>{editingUser.email}</SheetDescription>
              </SheetHeader>

              {/* Conteúdo com scroll independente */}
              <div className="flex-1 overflow-y-auto">
                <Tabs value={editTab} onValueChange={handleTabChange} className="flex flex-col h-full">
                  <div className="shrink-0 px-6 pt-4">
                    <TabsList className="w-full mb-0">
                      <TabsTrigger value="account" className="flex-1">Conta</TabsTrigger>
                      <TabsTrigger value="ministries" className="flex-1">Ministérios</TabsTrigger>
                      <TabsTrigger value="servants" className="flex-1">Servos</TabsTrigger>
                    </TabsList>
                  </div>
                  <div className="px-6 pt-4 pb-6">

                {/* ── Aba Conta ─────────────────────────────────────────── */}
                <TabsContent value="account" className="space-y-5">
                  {/* Role */}
                  <div className="space-y-2">
                    <Label>Role do sistema</Label>
                    <Select
                      value={editRole}
                      onValueChange={(v: UserProfile["role"]) => setEditRole(v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <span className="flex items-center gap-2"><User className="h-4 w-4" />Usuário Comum</span>
                        </SelectItem>
                        <SelectItem value="ministry_leader">
                          <span className="flex items-center gap-2"><UserCheck className="h-4 w-4" />Líder de Ministério</span>
                        </SelectItem>
                        <SelectItem value="admin">
                          <span className="flex items-center gap-2"><Shield className="h-4 w-4" />Administrador</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {editRole === "admin" && "Acesso total ao sistema (agendamentos e escalas)."}
                      {editRole === "ministry_leader" && "Pode gerenciar escalas dos ministérios vinculados."}
                      {editRole === "user" && "Pode fazer agendamentos e visualizar escalas."}
                    </p>
                    <Button
                      size="sm"
                      onClick={handleSaveRole}
                      disabled={isSavingRole || editRole === editingUser.role}
                    >
                      {isSavingRole && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      Salvar role
                    </Button>
                  </div>

                  {/* Dados de autenticação */}
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">Informações de autenticação</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Membro desde</p>
                        <p>{formatDate(editingUser.created_at)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Último acesso</p>
                        <p>{formatDate(editingUser.last_sign_in_at)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Email confirmado</p>
                        <p>{editingUser.email_confirmed_at ? "Sim" : <span className="text-amber-600">Não</span>}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Provedores</p>
                        <div className="flex gap-1 flex-wrap mt-0.5">
                          {editingUser.providers?.length > 0
                            ? editingUser.providers.map((p) => {
                                const cfg = PROVIDER_CONFIG[p] || { label: p, color: "bg-gray-100 text-gray-700" }
                                return <Badge key={p} variant="secondary" className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
                              })
                            : <span className="text-muted-foreground">—</span>
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-sm font-medium">Ações</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleResetPassword(editingUser)}
                      disabled={isResetting}
                    >
                      {isResetting
                        ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        : <KeyRound className="h-4 w-4 mr-2" />
                      }
                      Gerar link de recuperação de senha
                    </Button>

                    {editingUser.id !== currentUser?.id && !editingUser.is_admin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={`w-full justify-start ${
                          isUserBanned(editingUser.banned_until)
                            ? "text-green-600 border-green-200 hover:bg-green-50"
                            : "text-red-600 border-red-200 hover:bg-red-50"
                        }`}
                        onClick={() => setStatusDialog({ open: true, user: editingUser })}
                      >
                        {isUserBanned(editingUser.banned_until)
                          ? <><UserCheck className="h-4 w-4 mr-2" />Reativar conta</>
                          : <><UserX className="h-4 w-4 mr-2" />Desativar conta</>
                        }
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* ── Aba Ministérios ──────────────────────────────────── */}
                <TabsContent value="ministries" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Ministérios vinculados
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddingMinistry(true)}
                      disabled={addingMinistry}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {editingUser.ministry_roles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Nenhum ministério vinculado.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {editingUser.ministry_roles.map((mr) => (
                        <div
                          key={mr.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                          style={{ borderLeftColor: mr.ministry?.color, borderLeftWidth: 4 }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: mr.ministry?.color }} />
                            <div>
                              <p className="font-medium text-sm">{mr.ministry?.name}</p>
                              <Badge variant="secondary" className={`text-xs ${MINISTRY_ROLE_CONFIG[mr.role]?.color}`}>
                                {MINISTRY_ROLE_CONFIG[mr.role]?.label}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                            onClick={() => setRemoveMinistryDialog({
                              open: true,
                              roleId: mr.id,
                              ministryName: mr.ministry?.name || "Ministério",
                            })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingMinistry && (
                    <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                      <div className="space-y-2">
                        <Label>Ministério</Label>
                        <Select
                          value={newMinistryForm.ministry_id}
                          onValueChange={(v) => setNewMinistryForm({ ...newMinistryForm, ministry_id: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um ministério" />
                          </SelectTrigger>
                          <SelectContent>
                            {ministries
                              .filter((m) => !editingUser.ministry_roles.some((mr) => mr.ministry_id === m.id))
                              .map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  <span className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: m.color }} />
                                    {m.name}
                                  </span>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Função no ministério</Label>
                        <Select
                          value={newMinistryForm.role}
                          onValueChange={(v: MinistryRole["role"]) => setNewMinistryForm({ ...newMinistryForm, role: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="leader">Líder Principal</SelectItem>
                            <SelectItem value="coordinator">Coordenador</SelectItem>
                            <SelectItem value="helper">Auxiliar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setAddingMinistry(false)}>
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAddMinistry}
                          disabled={!newMinistryForm.ministry_id || isSavingMinistry}
                        >
                          {isSavingMinistry && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                          Vincular
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ── Aba Servos ────────────────────────────────────────── */}
                <TabsContent value="servants" className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Registros de servo no módulo de Escalas vinculados a esta conta de usuário.
                  </p>

                  {loadingServants ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {servants.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum servo vinculado a esta conta.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {servants.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between p-3 rounded-lg border"
                            >
                              <div className="flex items-center gap-3">
                                <Music className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium text-sm">{s.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {s.area?.ministry?.name} · {s.area?.name}
                                    {s.is_leader && " · Líder"}
                                  </p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                                onClick={() => setUnlinkServantDialog({ open: true, servantId: s.id, servantName: s.name })}
                              >
                                <Link2Off className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Vincular novo servo */}
                      {unlinkedServants.length > 0 && (
                        <div className="border-t pt-4 space-y-3">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <Link2 className="h-4 w-4" />
                            Vincular registro de servo
                          </p>

                          {/* Sugestões por nome parecido */}
                          {(() => {
                            const userName = editingUser.full_name?.toLowerCase().trim() ?? ""
                            const suggested = unlinkedServants.filter((s) =>
                              userName && s.name.toLowerCase().trim().includes(userName.split(" ")[0])
                            )
                            if (suggested.length === 0) return null
                            return (
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Possíveis correspondências pelo nome:</p>
                                {suggested.map((s) => (
                                  <div
                                    key={s.id}
                                    className="flex items-center justify-between p-2 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20"
                                  >
                                    <div>
                                      <p className="text-sm font-medium">{s.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {s.area?.ministry?.name} · {s.area?.name}
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={() => setLinkingServantId(s.id)}
                                    >
                                      Selecionar
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )
                          })()}

                          <div className="flex gap-2">
                            <Select value={linkingServantId} onValueChange={setLinkingServantId}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Buscar servo por nome..." />
                              </SelectTrigger>
                              <SelectContent>
                                {unlinkedServants.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name} — {s.area?.ministry?.name} · {s.area?.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={handleLinkServant}
                              disabled={!linkingServantId || isSavingServant}
                            >
                              {isSavingServant
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Link2 className="h-3 w-3" />
                              }
                            </Button>
                          </div>
                        </div>
                      )}

                      {servants.length === 0 && unlinkedServants.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center">
                          Nenhum registro de servo sem vínculo encontrado.
                        </p>
                      )}
                    </>
                  )}
                </TabsContent>
                </div>
              </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Dialog: Desativar / Reativar ──────────────────────────────────── */}
      <AlertDialog
        open={statusDialog.open}
        onOpenChange={(open) => { if (!open) setStatusDialog({ open: false, user: null }) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {statusDialog.user && isUserBanned(statusDialog.user.banned_until)
                ? "Reativar conta"
                : "Desativar conta"
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusDialog.user && isUserBanned(statusDialog.user.banned_until) ? (
                <>Reativar a conta de <strong>{statusDialog.user?.full_name || statusDialog.user?.email}</strong>? O usuário voltará a conseguir fazer login.</>
              ) : (
                <>Desativar a conta de <strong>{statusDialog.user?.full_name || statusDialog.user?.email}</strong>? O usuário não conseguirá fazer login enquanto a conta estiver desativada.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatus}
              disabled={isTogglingStatus}
              className={
                statusDialog.user && isUserBanned(statusDialog.user.banned_until)
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-red-600 hover:bg-red-700"
              }
            >
              {isTogglingStatus && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {statusDialog.user && isUserBanned(statusDialog.user.banned_until) ? "Reativar" : "Desativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog: Remover ministério ────────────────────────────────────── */}
      <AlertDialog
        open={!!removeMinistryDialog}
        onOpenChange={(open) => { if (!open) setRemoveMinistryDialog(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo</AlertDialogTitle>
            <AlertDialogDescription>
              Remover o vínculo de <strong>{editingUser?.full_name || editingUser?.email}</strong> com o ministério <strong>{removeMinistryDialog?.ministryName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMinistry} className="bg-red-600 hover:bg-red-700">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog: Desvincular servo ─────────────────────────────────────── */}
      <AlertDialog
        open={!!unlinkServantDialog}
        onOpenChange={(open) => { if (!open) setUnlinkServantDialog(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desvincular servo</AlertDialogTitle>
            <AlertDialogDescription>
              Desvincular o registro de servo <strong>{unlinkServantDialog?.servantName}</strong> desta conta de usuário?
              O registro do servo continuará existindo no sistema, apenas sem vínculo com esta conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlinkServant} className="bg-red-600 hover:bg-red-700">
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dialog: Link de recuperação de senha ─────────────────────────── */}
      <Dialog open={resetDialog.open} onOpenChange={(open) => { if (!open) setResetDialog({ open: false, link: null, email: "" }) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Link de recuperação de senha
            </DialogTitle>
            <DialogDescription>
              Link gerado para <strong>{resetDialog.email}</strong>. Copie e envie ao usuário.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {resetDialog.link ? (
              <>
                <div className="flex gap-2">
                  <Input value={resetDialog.link} readOnly className="text-xs" />
                  <Button variant="outline" size="icon" onClick={handleCopyLink}>
                    {isCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  Este link expira em 24 horas e é de uso único.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Não foi possível gerar o link. Tente novamente.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
