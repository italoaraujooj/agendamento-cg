import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"

// POST - Importar eventos do sistema de agendamentos
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: periodId } = await params
    const supabase = createAdminClient()
    if (!supabase) {
      return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const rawEnvId = body.environment_id
    const environmentId =
      rawEnvId !== undefined && rawEnvId !== null ? String(rawEnvId) : null

    // Chamar a função do banco de dados (p_environment_id como text: aceita id integer ou uuid)
    const { data, error } = await supabase
      .rpc("import_bookings_to_period", {
        p_period_id: periodId,
        p_environment_id: environmentId,
      })

    if (error) {
      console.error("Erro ao importar bookings:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      imported: data,
      message: `${data} evento(s) importado(s) do sistema de agendamentos`,
    })
  } catch (error) {
    console.error("Erro na API de importação:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
