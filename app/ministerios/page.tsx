"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Users2, ChevronRight, Loader2 } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { useSystemMode } from "@/components/system-mode-provider"
import { supabase } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"
import type { Ministry, Area } from "@/types/escalas"

interface MinistryWithAreas extends Ministry {
  areas: Area[]
}

export default function MinisteriosPage() {
  const { isAuthenticated, isAdmin, loading: authLoading } = useAuth()
  const { setMode } = useSystemMode()
  const [ministries, setMinistries] = useState<MinistryWithAreas[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMode("escalas")
  }, [setMode])

  useEffect(() => {
    async function fetchMinistries() {
      try {
        const { data, error } = await supabase
          .from("ministries")
          .select(`
            *,
            areas (*)
          `)
          .eq("is_active", true)
          .order("name")

        if (error) throw error
        setMinistries(data || [])
      } catch (error) {
        console.error("Erro ao buscar ministérios:", error)
        toast.error("Erro ao carregar ministérios")
      } finally {
        setLoading(false)
      }
    }

    fetchMinistries()
  }, [])

  if (authLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ministérios</h1>
          <p className="text-muted-foreground">
            Gerencie os ministérios e suas áreas de serviço
          </p>
        </div>
        {isAuthenticated && isAdmin && (
          <Button asChild>
            <Link href="/ministerios/novo">
              <Plus className="mr-2 h-4 w-4" />
              Novo Ministério
            </Link>
          </Button>
        )}
      </div>

      {/* Lista de Ministérios */}
      {ministries.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum ministério cadastrado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Comece criando o primeiro ministério para configurar as escalas.
            </p>
            {isAuthenticated && isAdmin && (
              <Button asChild>
                <Link href="/ministerios/novo">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Ministério
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ministries.map((ministry) => (
            <Link key={ministry.id} href={`/ministerios/${ministry.id}`}>
              <Card className="hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: ministry.color }}
                      />
                      <CardTitle className="text-lg">{ministry.name}</CardTitle>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  {ministry.description && (
                    <CardDescription className="line-clamp-2">
                      {ministry.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {ministry.areas?.length || 0} área(s)
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Ver detalhes
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
