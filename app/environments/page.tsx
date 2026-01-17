import { createServerClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Users, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface Environment {
  id: string
  name: string
  description: string | null
  capacity: number
  created_at: string
}

interface EnvironmentAvailability {
  id: number
  environment_id: number
  weekday: number // 0=Domingo ... 6=Sábado
  start_time: string // HH:MM:SS
  end_time: string   // HH:MM:SS
}

const WEEKDAY_LABELS_PT_BR: readonly string[] = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const

export default async function EnvironmentsPage() {
  const supabase = await createServerClient()

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-muted-foreground">Erro ao conectar com o banco de dados</p>
      </div>
    )
  }

  const [{ data: environments, error }, { data: availabilities, error: availError }] = await Promise.all([
    supabase.from("environments").select("*").order("name"),
    supabase.from("environment_availabilities").select("*").order("weekday", { ascending: true }).order("start_time", { ascending: true }),
  ])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-destructive">Erro ao carregar ambientes: {error.message}</p>
      </div>
    )
  }

  if (availError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg text-destructive">Erro ao carregar disponibilidades: {availError.message}</p>
      </div>
    )
  }

  const availabilityByEnvironment: Record<string, EnvironmentAvailability[]> = {}
  for (const av of availabilities || []) {
    const key = String(av.environment_id)
    if (!availabilityByEnvironment[key]) availabilityByEnvironment[key] = []
    availabilityByEnvironment[key].push(av)
  }

  const groupAvailabilityByWeekday = (envId: string) => {
    const items = availabilityByEnvironment[envId] || []
    const grouped: Record<number, { start: string; end: string }[]> = {}
    for (const it of items) {
      if (!grouped[it.weekday]) grouped[it.weekday] = []
      grouped[it.weekday].push({ start: it.start_time.slice(0, 5), end: it.end_time.slice(0, 5) })
    }
    return grouped
  }

  // Agrupa dias que possuem intervalos idênticos para exibição compacta
  const buildCondensedAvailability = (envId: string) => {
    const byWeekday = groupAvailabilityByWeekday(envId)
    // Mapa "chave de intervalos" -> lista de dias [0..6]
    const keyToDays = new Map<string, number[]>()
    for (let d = 0; d <= 6; d++) {
      const ranges = (byWeekday[d] || [])
        .slice()
        .sort((a, b) => a.start.localeCompare(b.start))
        .map((r) => `${r.start}-${r.end}`)
      const key = ranges.length ? ranges.join(",") : "__fechado__"
      if (!keyToDays.has(key)) keyToDays.set(key, [])
      keyToDays.get(key)!.push(d)
    }

    // Converte lista de dias em segmentos consecutivos (ex.: [1,2,4,5,6] -> [[1,2],[4,6]])
    const toSegments = (days: number[]) => {
      const segs: Array<[number, number]> = []
      let start = days[0]
      let prev = days[0]
      for (let i = 1; i < days.length; i++) {
        const cur = days[i]
        if (cur === prev + 1) {
          prev = cur
          continue
        }
        segs.push([start, prev])
        start = prev = cur
      }
      segs.push([start, prev])
      return segs
    }

    // Monta estrutura final, ignorando grupos "fechado" se houver outros grupos
    const entries = Array.from(keyToDays.entries())
    const anyOpen = entries.some(([k]) => k !== "__fechado__")
    const filtered = entries.filter(([k]) => (anyOpen ? k !== "__fechado__" : true))

    return filtered.map(([key, days]) => {
      const segments = toSegments(days)
      const dayLabel = segments
        .map(([a, b]) => (a === b ? WEEKDAY_LABELS_PT_BR[a] : `${WEEKDAY_LABELS_PT_BR[a]}–${WEEKDAY_LABELS_PT_BR[b]}`))
        .join("; ")
      const ranges = key === "__fechado__" ? [] : key.split(",") // ["08:00-22:00", ...]
      return { dayLabel, ranges }
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Início
            </Link>
          </Button>

          <h1 className="text-4xl font-bold mb-4">Ambientes Disponíveis</h1>
          <p className="text-xl text-muted-foreground">Conheça os espaços da igreja e suas capacidades</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr items-stretch">
          {environments?.map((environment: Environment) => (
            <Card key={environment.id} className="h-full flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    <CardTitle className="text-lg">{environment.name}</CardTitle>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {environment.capacity}
                  </Badge>
                </div>
                <CardDescription className="text-sm">Capacidade máxima: {environment.capacity} pessoas</CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col flex-1">
                <p className="mb-4 line-clamp-3">{environment.description || "Sem descrição disponível"}</p>

                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-semibold">Disponibilidade</h4>
                  <div className="space-y-1">
                    {buildCondensedAvailability(environment.id).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Não configurada</p>
                    ) : (
                      buildCondensedAvailability(environment.id).map((g, idx) => (
                        <div key={`${environment.id}-g${idx}`} className="flex items-start gap-2 w-full">
                          <span className="min-w-32 text-sm text-muted-foreground">{g.dayLabel}</span>
                          <div className="flex flex-wrap gap-2 ml-auto justify-end">
                            {g.ranges.length === 0 ? (
                              <Badge variant="secondary">Fechado</Badge>
                            ) : (
                              g.ranges.map((range, rIdx) => (
                                <Badge key={`${idx}-${rIdx}`} variant="secondary">
                                  {range.replace("-", " - ")}
                                </Badge>
                              ))
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Button asChild className="w-full mt-auto">
                  <Link href={`/booking?environment=${environment.id}`}>Agendar Este Espaço</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {(!environments || environments.length === 0) && (
          <div className="text-center py-12">
            <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhum ambiente encontrado</h3>
            <p className="text-gray-500">
              Execute o script de configuração do banco de dados para criar os ambientes padrão.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
