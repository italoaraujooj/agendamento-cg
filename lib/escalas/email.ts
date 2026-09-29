import { Resend } from "resend"

/**
 * E-mails do módulo de Escalas (convites de disponibilidade, lembretes e
 * avisos de alteração tardia ao líder).
 */

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
const APP_NAME = "Cidade Viva CG"
const BRAND = "#eabc08"
const BRAND_DARK = "#4f4f4d"
const BATCH_SIZE = 100 // limite do resend.batch.send

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://agendamento-cg.vercel.app"

export interface EmailMessage {
  to: string
  subject: string
  html: string
}

export function isEmailConfigured() {
  return !!process.env.RESEND_API_KEY
}

/** Envia em lotes; retorna quantos foram aceitos pelo provedor. */
export async function sendEmails(messages: EmailMessage[]): Promise<{ sent: number; failed: number }> {
  if (messages.length === 0) return { sent: 0, failed: 0 }
  if (!isEmailConfigured()) {
    console.warn("RESEND_API_KEY não configurada — e-mails não enviados")
    return { sent: 0, failed: messages.length }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0
  let failed = 0

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const chunk = messages.slice(i, i + BATCH_SIZE)
    const { error } = await resend.batch.send(
      chunk.map((m) => ({ from: FROM_EMAIL, to: [m.to], subject: m.subject, html: m.html }))
    )
    if (error) {
      console.error("Erro ao enviar lote de e-mails:", error)
      failed += chunk.length
    } else {
      sent += chunk.length
    }
  }

  return { sent, failed }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function layout(params: { title: string; subtitle?: string; body: string }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(params.title)}</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <tr><td style="background-color:${BRAND};padding:28px;text-align:center;">
          <h1 style="color:${BRAND_DARK};margin:0;font-size:22px;">${escapeHtml(params.title)}</h1>
          ${params.subtitle ? `<p style="color:${BRAND_DARK};margin:8px 0 0;font-size:14px;">${escapeHtml(params.subtitle)}</p>` : ""}
        </td></tr>
        <tr><td style="padding:28px;color:#374151;font-size:15px;line-height:1.5;">
          ${params.body}
          <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">Esta é uma mensagem automática do ${APP_NAME}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function button(href: string, label: string) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:8px;background-color:${BRAND_DARK};">
    <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">${escapeHtml(label)}</a>
  </td></tr></table>`
}

export function availabilityInviteEmail(params: {
  name: string
  ministryName: string
  monthLabel: string
  deadlineLabel: string | null
  link: string
  reminder: boolean
}): { subject: string; html: string } {
  const first = params.name.split(" ")[0]
  const subject = params.reminder
    ? `⏰ Lembrete: informe sua disponibilidade — ${params.ministryName} (${params.monthLabel})`
    : `📅 Informe sua disponibilidade — ${params.ministryName} (${params.monthLabel})`

  const body = `
    <p style="margin:0 0 12px;">Olá, <strong>${escapeHtml(first)}</strong>!</p>
    <p style="margin:0 0 12px;">
      ${params.reminder
        ? "Ainda não recebemos sua disponibilidade para a escala de"
        : "A escala de"}
      <strong>${escapeHtml(params.ministryName)}</strong> de <strong>${escapeHtml(params.monthLabel)}</strong>
      ${params.reminder ? "." : "está sendo montada. Conte pra gente em quais eventos você pode servir."}
    </p>
    ${params.deadlineLabel ? `<p style="margin:0 0 12px;">Prazo para responder: <strong>${escapeHtml(params.deadlineLabel)}</strong></p>` : ""}
    ${button(params.link, "Informar disponibilidade")}
    <p style="margin:0;color:#6b7280;font-size:13px;">
      Este link é pessoal. Você pode abri-lo novamente para editar suas respostas até o prazo.
    </p>`

  return {
    subject,
    html: layout({ title: params.reminder ? "Lembrete de disponibilidade" : "Disponibilidade para a escala", subtitle: `${params.ministryName} · ${params.monthLabel}`, body }),
  }
}

export function lateAvailabilityChangeEmail(params: {
  servantName: string
  ministryName: string
  monthLabel: string
  changes: { label: string; before: string; after: string }[]
  link: string
}): { subject: string; html: string } {
  const rows = params.changes
    .map(
      (c) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;">${escapeHtml(c.label)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${escapeHtml(c.before)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;font-weight:600;">${escapeHtml(c.after)}</td>
      </tr>`
    )
    .join("")

  const body = `
    <p style="margin:0 0 12px;">
      <strong>${escapeHtml(params.servantName)}</strong> alterou a disponibilidade para
      <strong>${escapeHtml(params.ministryName)}</strong> (${escapeHtml(params.monthLabel)}) depois do prazo.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse;margin:12px 0;">
      <tr style="background-color:#f9fafb;">
        <th align="left" style="padding:6px 8px;">Evento</th>
        <th align="left" style="padding:6px 8px;">Antes</th>
        <th align="left" style="padding:6px 8px;">Agora</th>
      </tr>
      ${rows}
    </table>
    ${button(params.link, "Abrir montagem da escala")}`

  return {
    subject: `⚠️ Alteração de disponibilidade após o prazo — ${params.servantName}`,
    html: layout({ title: "Alteração após o prazo", subtitle: `${params.ministryName} · ${params.monthLabel}`, body }),
  }
}
