"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, Calendar, ArrowLeft } from "lucide-react"
import { AvailabilityForm } from "@/components/escalas/availability-form"
import Link from "next/link"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"

interface PeriodData {
  id: string
  month: number
  year: number
  availability_deadline: string | null
  ministry: {
    id: string
    name: string
    color: string
  } | null
}

interface EventData {
  id: string
  event_date: string
  event_time: string
  title: string
  description: string | null
}

interface ServantData {
  id: string
  name: string
  email: string | null
  is_leader: boolean
  area: {
    id: string
    name: string
    ministry_id: string
  } | null
}

export default function DisponibilidadePage() {
  const params = useParams()
  const token = params.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{
    period: PeriodData
    events: EventData[]
    servants: ServantData[]
  } | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/escalas/availability/${token}`)
        const result = await response.json()

        if (!response.ok) {
          setError(result.error || "Erro ao carregar formulário")
          return
        }

        setData(result)
      } catch (err) {
        console.error("Erro:", err)
        setError("Erro ao carregar formulário")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando formulário...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Ops!</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button variant="outline" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Início
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header simplificado */}
      <header 
        className="border-b"
        style={{ 
          backgroundColor: data.period.ministry?.color 
            ? `${data.period.ministry.color}15` 
            : undefined 
        }}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: data.period.ministry?.color || '#3b82f6' }}
            >
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold">
                Disponibilidade - {data.period.ministry?.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {format(new Date(data.period.year, data.period.month - 1), "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="container mx-auto px-4 py-6">
        <AvailabilityForm
          period={data.period}
          events={data.events as any}
          servants={data.servants as any}
        />
      </main>

      {/* Footer */}
      <footer className="border-t mt-8">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-muted-foreground">
          Sistema de Escalas - Igreja Cidade Viva CG
        </div>
      </footer>
    </div>
  )
}
