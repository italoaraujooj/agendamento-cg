"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Shield,
  UserCheck,
  User,
  Search,
  Edit,
  X,
  Loader2,
  Mail,
  Phone,
  Crown,
  Building,
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
} from "lucide-react"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
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

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  is_admin: boolean
  role: 'user' | 'ministry_leader' | 'admin'
  profile_completed: boolean
  created_at: string
  ministry_roles?: UserMinistryRole[]
}

interface Ministry {
  id: string
  name: string
  color: string
}

interface UserMinistryRole {
  id: string
  user_id: string
  ministry_id: string
  role: 'leader' | 'coordinator' | 'helper'
  ministry?: Ministry
}

const ROLE_CONFIG = {
  user: {
    label: 'Usuário',
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    icon: User
  },
  ministry_leader: {
    label: 'Líder de Ministério',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: UserCheck
  },
  admin: {
    label: 'Administrador',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    icon: Shield
  },
}

const MINISTRY_ROLE_CONFIG = {
  leader: { label: 'Líder', color: 'bg-amber-100 text-amber-800' },
  coordinator: { label: 'Coordenador', color: 'bg-blue-100 text-blue-800' },
  helper: { label: 'Auxiliar', color: 'bg-green-100 text-green-800' },
}

export function UsersManager() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [ministries, setMinistries] = useState<Ministry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterRole, setFilterRole] = useState<string>("all")

  // Estado do modal de edição
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [editForm, setEditForm] = useState({
    role: 'user' as UserProfile['role'],
    is_admin: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Estado para adicionar ministério
  const [addingMinistry, setAddingMinistry] = useState(false)
  const [newMinistryForm, setNewMinistryForm] = useState({
    ministry_id: '',
    role: 'leader' as UserMinistryRole['role'],
  })

  // Estado para confirmação de remoção
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    type: 'ministry_role'
    id: string
    userName: string
    ministryName: string
  } | null>(null)

  // Carregar dados
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Buscar usuários via API admin (inclui nomes do auth.users)
      const res = await fetch('/api/admin/users')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao buscar usuários')
      }
      const usersData: UserProfile[] = await res.json()
      setUsers(usersData)

      // Buscar ministérios
      const { data: ministriesData, error: ministriesError } = await supabase
        .from('ministries')
        .select('id, name, color')
        .eq('is_active', true)
        .order('name')

      if (ministriesError) {
        console.error('Erro ao buscar ministérios:', ministriesError)
      } else {
        setMinistries(ministriesData || [])
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  // Filtrar usuários
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesRole = filterRole === 'all' || user.role === filterRole

    return matchesSearch && matchesRole
  })

  // Abrir modal de edição
  const openEditModal = (user: UserProfile) => {
    setEditingUser(user)
    setEditForm({
      role: user.role,
      is_admin: user.is_admin,
    })
    setAddingMinistry(false)
    setNewMinistryForm({ ministry_id: '', role: 'leader' })
  }

  // Salvar alterações do usuário
  const handleSaveUser = async () => {
    if (!editingUser) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: editForm.role,
          is_admin: editForm.role === 'admin' ? true : editForm.is_admin,
        })
        .eq('id', editingUser.id)

      if (error) throw error

      toast.success('Usuário atualizado com sucesso!')
      setEditingUser(null)
      fetchData()
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error)
      toast.error(error.message || 'Erro ao atualizar usuário')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Adicionar ministério ao usuário
  const handleAddMinistry = async () => {
    if (!editingUser || !newMinistryForm.ministry_id) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('user_ministry_roles')
        .insert({
          user_id: editingUser.id,
          ministry_id: newMinistryForm.ministry_id,
          role: newMinistryForm.role,
        })

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este usuário já está vinculado a este ministério')
        }
        throw error
      }

      toast.success('Ministério vinculado com sucesso!')
      setAddingMinistry(false)
      setNewMinistryForm({ ministry_id: '', role: 'leader' })

      // Atualizar role do usuário para ministry_leader se ainda for user
      if (editingUser.role === 'user') {
        await supabase
          .from('profiles')
          .update({ role: 'ministry_leader' })
          .eq('id', editingUser.id)
      }

      fetchData()

      // Atualizar o editingUser com os novos dados
      const { data: updatedUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', editingUser.id)
        .single()

      const { data: updatedRoles } = await supabase
        .from('user_ministry_roles')
        .select('*, ministry:ministries(id, name, color)')
        .eq('user_id', editingUser.id)

      if (updatedUser) {
        setEditingUser({
          ...updatedUser,
          role: updatedUser.role || 'user',
          ministry_roles: updatedRoles || [],
        })
        setEditForm({
          role: updatedUser.role || 'ministry_leader',
          is_admin: updatedUser.is_admin,
        })
      }
    } catch (error: any) {
      console.error('Erro ao vincular ministério:', error)
      toast.error(error.message || 'Erro ao vincular ministério')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Remover ministério do usuário
  const handleRemoveMinistry = async () => {
    if (!deleteDialog) return

    try {
      const { error } = await supabase
        .from('user_ministry_roles')
        .delete()
        .eq('id', deleteDialog.id)

      if (error) throw error

      toast.success('Vínculo removido com sucesso!')
      setDeleteDialog(null)
      fetchData()

      // Atualizar o editingUser
      if (editingUser) {
        const updatedRoles = editingUser.ministry_roles?.filter(r => r.id !== deleteDialog.id) || []
        setEditingUser({
          ...editingUser,
          ministry_roles: updatedRoles,
        })

        // Se não tiver mais ministérios, voltar role para user
        if (updatedRoles.length === 0 && editingUser.role === 'ministry_leader') {
          await supabase
            .from('profiles')
            .update({ role: 'user' })
            .eq('id', editingUser.id)

          setEditForm(prev => ({ ...prev, role: 'user' }))
        }
      }
    } catch (error: any) {
      console.error('Erro ao remover vínculo:', error)
      toast.error(error.message || 'Erro ao remover vínculo')
    }
  }

  // Estatísticas
  const stats = {
    total: users.length,
    admins: users.filter(u => u.is_admin).length,
    leaders: users.filter(u => u.role === 'ministry_leader').length,
    regular: users.filter(u => u.role === 'user' && !u.is_admin).length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando usuários...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Usuários Comuns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.regular}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
      </div>

      {/* Lista de Usuários */}
      {filteredUsers.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h4 className="text-lg font-semibold mb-2">Nenhum usuário encontrado</h4>
          <p className="text-muted-foreground">
            {searchTerm || filterRole !== 'all'
              ? 'Tente ajustar os filtros de busca.'
              : 'Não há usuários cadastrados no sistema.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredUsers.map((user) => {
            const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.user
            const RoleIcon = roleConfig.icon

            return (
              <Card key={user.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${roleConfig.color}`}>
                        <RoleIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {user.full_name || 'Sem nome'}
                          </p>
                          <Badge variant="outline" className={roleConfig.color}>
                            {roleConfig.label}
                          </Badge>
                          {user.is_admin && user.role !== 'admin' && (
                            <Badge variant="outline" className="bg-purple-100 text-purple-800">
                              Admin
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
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
                          {!user.profile_completed && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Perfil incompleto
                            </Badge>
                          )}
                        </div>
                        {/* Ministérios vinculados */}
                        {user.ministry_roles && user.ministry_roles.length > 0 && (
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
                                  color: mr.ministry?.color
                                }}
                              >
                                {mr.ministry?.name} ({MINISTRY_ROLE_CONFIG[mr.role]?.label})
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(user)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal de Edição */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold">Editar Usuário</h2>
                <p className="text-sm text-muted-foreground">{editingUser.email}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingUser(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações básicas */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={editingUser.full_name || 'Sem nome'} disabled />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role do Sistema</Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(value: UserProfile['role']) => {
                      setEditForm({
                        ...editForm,
                        role: value,
                        is_admin: value === 'admin' ? true : editForm.is_admin,
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Usuário Comum
                        </div>
                      </SelectItem>
                      <SelectItem value="ministry_leader">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" />
                          Líder de Ministério
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Administrador
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {editForm.role === 'admin' && 'Administradores têm acesso total ao sistema.'}
                    {editForm.role === 'ministry_leader' && 'Líderes podem gerenciar as escalas dos ministérios vinculados.'}
                    {editForm.role === 'user' && 'Usuários comuns podem fazer agendamentos e visualizar escalas.'}
                  </p>
                </div>
              </div>

              {/* Ministérios vinculados */}
              {editForm.role === 'ministry_leader' && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Ministérios Vinculados
                    </Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddingMinistry(true)}
                      disabled={addingMinistry}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {/* Lista de ministérios vinculados */}
                  {editingUser.ministry_roles && editingUser.ministry_roles.length > 0 ? (
                    <div className="space-y-2">
                      {editingUser.ministry_roles.map((mr) => (
                        <div
                          key={mr.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                          style={{ borderLeftColor: mr.ministry?.color, borderLeftWidth: 4 }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: mr.ministry?.color }}
                            />
                            <div>
                              <p className="font-medium">{mr.ministry?.name}</p>
                              <Badge variant="secondary" className={MINISTRY_ROLE_CONFIG[mr.role]?.color}>
                                {MINISTRY_ROLE_CONFIG[mr.role]?.label}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteDialog({
                              open: true,
                              type: 'ministry_role',
                              id: mr.id,
                              userName: editingUser.full_name || editingUser.email,
                              ministryName: mr.ministry?.name || 'Ministério',
                            })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum ministério vinculado. Adicione um ministério para este líder.
                    </p>
                  )}

                  {/* Formulário para adicionar ministério */}
                  {addingMinistry && (
                    <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                      <div className="space-y-2">
                        <Label>Ministério</Label>
                        <Select
                          value={newMinistryForm.ministry_id}
                          onValueChange={(value) => setNewMinistryForm({ ...newMinistryForm, ministry_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um ministério" />
                          </SelectTrigger>
                          <SelectContent>
                            {ministries
                              .filter(m => !editingUser.ministry_roles?.some(mr => mr.ministry_id === m.id))
                              .map((ministry) => (
                                <SelectItem key={ministry.id} value={ministry.id}>
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: ministry.color }}
                                    />
                                    {ministry.name}
                                  </div>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Função no Ministério</Label>
                        <Select
                          value={newMinistryForm.role}
                          onValueChange={(value: UserMinistryRole['role']) =>
                            setNewMinistryForm({ ...newMinistryForm, role: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="leader">Líder Principal</SelectItem>
                            <SelectItem value="coordinator">Coordenador</SelectItem>
                            <SelectItem value="helper">Auxiliar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAddingMinistry(false)
                            setNewMinistryForm({ ministry_id: '', role: 'leader' })
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleAddMinistry}
                          disabled={!newMinistryForm.ministry_id || isSubmitting}
                        >
                          {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Plus className="h-4 w-4 mr-1" />
                          )}
                          Vincular
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botões de ação */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setEditingUser(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveUser} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Salvar Alterações
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de Confirmação de Remoção */}
      <AlertDialog open={deleteDialog?.open} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Remover Vínculo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o vínculo de <strong>{deleteDialog?.userName}</strong> com o ministério <strong>{deleteDialog?.ministryName}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMinistry}
              className="bg-red-600 hover:bg-red-700"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
