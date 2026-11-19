import { NextRequest, NextResponse } from "next/server"
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
import { getEscalasCaller, requireMinistryManager } from "@/lib/escalas/auth"
import { z } from "zod"
import { MAX_PERIOD_MONTHS, monthRangeDates, monthSpan } from "@/lib/escalas/period-label"

const schedulePeriodSchema = z
  .object({
    ministry_id: z.string().uuid("Ministério inválido"),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2024),
    // Mês final (opcional): períodos de mais de um mês, ex. dezembro + janeiro
    end_month: z.number().int().min(1).max(12).optional(),
    end_year: z.number().int().min(2024).optional(),
    availability_deadline: z.string().datetime().optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (d) => {
      const span = monthSpan(d.month, d.year, d.end_month ?? d.month, d.end_year ?? d.year)
      return span >= 1 && span <= MAX_PERIOD_MONTHS
    },
    { message: `O mês final deve ser igual ou até ${MAX_PERIOD_MONTHS - 1} meses depois do inicial` }
  )

// GET - Listar períodos de escala
export async function GET(request: NextRequest) {
  try {
    // Admin e líderes veem todos os períodos (qualquer status) dos ministérios
    // que gerenciam; os demais, só o que a RLS permite (escalas publicadas)
    const caller = await getEscalasCaller()
    const managesAny = !!caller && (caller.isAdmin || caller.ministryIds.length > 0)
    const supabase = managesAny ? createAdminClient() : await createServerClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const ministryId = searchParams.get("ministry_id")
    const status = searchParams.get("status")
    const limit = Number(searchParams.get("limit")) || null

    let query = supabase
      .from("schedule_periods")
      .select(`
        *,
        ministry:ministries(id, name, color)
      `)
      .order("year", { ascending: false })
      .order("month", { ascending: false })

    if (ministryId) {
      query = query.eq("ministry_id", ministryId)
    }
    if (managesAny && !caller!.isAdmin) {
      query = query.in("ministry_id", caller!.ministryIds)
    }

    if (status) {
      query = query.eq("status", status)
    }
    if (limit) {
      query = query.limit(Math.min(limit, 200))
    }

    const { data, error } = await query

    if (error) {
      console.error("Erro ao buscar períodos:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Erro na API de períodos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST - Criar período de escala
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validationResult = schedulePeriodSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: validationResult.error.errors[0]?.message || "Dados inválidos",
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const { ministry_id, month, year, availability_deadline, notes } = validationResult.data
    const endMonth = validationResult.data.end_month ?? month
    const endYear = validationResult.data.end_year ?? year

    const auth = await requireMinistryManager(ministry_id)
    if (!auth.ok) return auth.response
    const { supabase } = auth

    // Do 1º dia do mês inicial ao último dia do mês final
    const { start_date: startDateStr, end_date: endDateStr } = monthRangeDates(month, year, endMonth, endYear)

    const { data, error } = await supabase
      .from("schedule_periods")
      .insert({
        ministry_id,
        month,
        year,
        start_date: startDateStr,
        end_date: endDateStr,
        availability_deadline: availability_deadline || null,
        notes: notes || null,
        status: "draft",
      })
      .select(`
        *,
        ministry:ministries(id, name, color)
      `)
      .single()

    if (error) {
      console.error("Erro ao criar período:", error)
      // 23505: unique antigo; 23P01: períodos do ministério se sobrepondo
      if (error.code === "23505" || error.code === "23P01") {
        return NextResponse.json(
          { error: "Já existe um período deste ministério cobrindo algum desses meses" },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Gerar automaticamente os eventos a partir do calendário regular
    const { error: rpcError } = await supabase.rpc("generate_regular_events_for_period", {
      p_period_id: data.id,
    })

    if (rpcError) {
      console.error("Erro ao gerar eventos regulares (período já criado):", rpcError)
      // Não falha a criação do período; os eventos podem ser gerados depois manualmente
    }

    // Auto-importar agendamentos aprovados do Salão Principal que solicitaram apoio deste ministério
    try {
      // Buscar o ID do Salão Principal
      const { data: salaoEnv } = await supabase
        .from("environments")
        .select("id")
        .eq("name", "Salão Principal")
        .single()

      if (salaoEnv) {
        // Buscar IDs de bookings que solicitaram apoio deste ministério
        const { data: ministryRequests } = await supabase
          .from("booking_ministry_requests")
          .select("booking_id")
          .eq("ministry_id", ministry_id)

        const requestedBookingIds = (ministryRequests || []).map(r => r.booking_id)

        if (requestedBookingIds.length > 0) {
          // Buscar esses bookings aprovados no intervalo do período
          const { data: bookings } = await supabase
            .from("bookings")
            .select("id, booking_date, start_time, occasion, responsible_person, name")
            // Salão Principal ou igreja inteira (que inclui o salão)
            .or(`environment_id.eq.${salaoEnv.id},blocks_all_environments.eq.true`)
            .eq("status", "approved")
            .gte("booking_date", startDateStr)
            .lte("booking_date", endDateStr)
            .in("id", requestedBookingIds)
            .order("booking_date", { ascending: true })

          if (bookings && bookings.length > 0) {
            // Verificar quais já foram importados para não duplicar
            const { data: existingEvents } = await supabase
              .from("schedule_events")
              .select("external_id")
              .eq("period_id", data.id)
              .eq("source", "booking_system")
              .not("external_id", "is", null)

            const importedIds = new Set((existingEvents || []).map(e => e.external_id))

            const eventsToInsert = bookings
              .filter(b => !importedIds.has(String(b.id)))
              .map(b => ({
                period_id: data.id,
                event_date: b.booking_date,
                event_time: b.start_time,
                event_type: "imported" as const,
                title: b.occasion || "Evento importado",
                description: `Reserva: ${b.occasion} | Responsável: ${b.responsible_person} | Local: Salão Principal`,
                source: "booking_system" as const,
                external_id: String(b.id),
              }))

            if (eventsToInsert.length > 0) {
              const { error: insertErr } = await supabase
                .from("schedule_events")
                .insert(eventsToInsert)

              if (insertErr) {
                console.error("Erro ao auto-importar bookings no período:", insertErr)
              } else {
                console.log(`✅ ${eventsToInsert.length} evento(s) do Salão Principal importado(s) automaticamente para o período`)
              }
            }
          }
        }
      }
    } catch (importError) {
      console.error("Erro no auto-import de bookings (período já criado):", importError)
      // Não falha a criação do período
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error("Erro na API de períodos:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
