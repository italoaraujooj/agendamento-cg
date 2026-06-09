import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { Resend } from "resend"
import { sundaysBetween } from "@/lib/announcements"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agendamento-cg.vercel.app"

function formatDate(iso: string) {
  try { return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR }) } catch { return iso }
}

function newAnnouncementTemplate(a: Record<string, unknown>, submitterName: string) {
  const typeLabel = a.type === "event" ? "Evento" : a.type === "general" ? "Comunicado Geral" : "Aviso de Ministério"
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f3f4f6;padding:24px;margin:0">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px">📢 Nova Solicitação de Aviso</h1>
    <p style="color:#e0e7ff;margin:4px 0 0;font-size:14px">Um novo aviso foi submetido para revisão</p>
  </div>
  <div style="padding:28px 32px;space-y:16px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#6b7280;width:140px">Tipo</td><td style="padding:6px 0;font-weight:600">${typeLabel}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Título</td><td style="padding:6px 0;font-weight:600">${a.title}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280">Solicitante</td><td style="padding:6px 0">${submitterName}</td></tr>
      ${a.event_date ? `<tr><td style="padding:6px 0;color:#6b7280">Data do evento</td><td style="padding:6px 0">${formatDate(a.event_date as string)}</td></tr>` : ""}
      ${a.location ? `<tr><td style="padding:6px 0;color:#6b7280">Local</td><td style="padding:6px 0">${a.location}</td></tr>` : ""}
    </table>
    <div style="margin-top:24px">
      <a href="${APP_URL}/admin" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Revisar Aviso</a>
    </div>
  </div>
</div></body></html>`
}

function announcementReviewedTemplate(a: Record<string, unknown>, approved: boolean) {
  const sundays = sundaysBetween(parseISO(a.first_sunday as string), parseISO(a.last_sunday as string))
  const sundayList = sundays.map(d => `<li style="padding:2px 0">${format(d, "dd 'de' MMMM", { locale: ptBR })} (domingo)</li>`).join("")
  const color = approved ? "#059669" : "#dc2626"
  const label = approved ? "aprovado" : "rejeitado"
  const emoji = approved ? "✅" : "❌"
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;background:#f3f4f6;padding:24px;margin:0">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <div style="background:${approved ? "linear-gradient(135deg,#059669,#047857)" : "linear-gradient(135deg,#dc2626,#b91c1c)"};padding:28px 32px">
    <h1 style="color:#fff;margin:0;font-size:20px">${emoji} Aviso ${label}</h1>
    <p style="color:#fff;opacity:.85;margin:4px 0 0;font-size:14px">Seu aviso foi analisado</p>
  </div>
  <div style="padding:28px 32px">
    <p style="font-size:15px;color:#111827">Seu aviso <strong>${a.title}</strong> foi <span style="color:${color};font-weight:700">${label}</span>.</p>
    ${a.review_notes ? `<div style="background:#f9fafb;border-left:4px solid ${color};padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0"><p style="margin:0;font-size:14px;color:#374151"><strong>Observação:</strong> ${a.review_notes}</p></div>` : ""}
    ${approved && sundays.length > 0 ? `<div style="margin-top:20px"><p style="font-size:14px;font-weight:600;color:#374151">Domingos programados:</p><ul style="font-size:14px;color:#374151;padding-left:20px;margin:8px 0">${sundayList}</ul></div>` : ""}
    <div style="margin-top:24px">
      <a href="${APP_URL}/avisos" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Ver minhas solicitações</a>
    </div>
  </div>
</div></body></html>`
}

export async function POST(request: NextRequest) {
  try {
    const { type, announcementId } = await request.json()
    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: "Erro de configuração" }, { status: 500 })

    const { data: announcement } = await admin
      .from("church_announcements")
      .select("*, submitter:profiles!church_announcements_submitted_by_fkey(id, full_name, email)")
      .eq("id", announcementId)
      .single()

    if (!announcement) return NextResponse.json({ error: "Aviso não encontrado" }, { status: 404 })

    const submitter = announcement.submitter as { full_name: string | null; email: string } | null

    if (type === "new_announcement") {
      const [adminsRes, manageRes] = await Promise.all([
        admin.from("profiles").select("email").eq("is_admin", true),
        admin
          .from("user_permissions")
          .select("user_id, profiles!user_permissions_user_id_fkey(email)")
          .eq("permission", "manage_avisos"),
      ])

      const emailSet = new Set<string>()
      adminsRes.data?.forEach(p => p.email && emailSet.add(p.email))
      manageRes.data?.forEach((r: any) => r.profiles?.email && emailSet.add(r.profiles.email))

      if (emailSet.size > 0) {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: Array.from(emailSet),
          subject: `📢 Novo aviso solicitado: ${announcement.title}`,
          html: newAnnouncementTemplate(announcement, submitter?.full_name || submitter?.email || "Usuário"),
        })
      }
    }

    if (type === "announcement_reviewed" && submitter?.email) {
      const approved = announcement.status === "approved"
      await resend.emails.send({
        from: FROM_EMAIL,
        to: [submitter.email],
        subject: `${approved ? "✅ Aviso aprovado" : "❌ Aviso rejeitado"}: ${announcement.title}`,
        html: announcementReviewedTemplate(announcement, approved),
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("POST /api/announcements/notify:", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
