import { NextResponse } from "next/server"

/**
 * GET - Verificação simples de que o app está no ar.
 * Não expõe variáveis de ambiente, cookies nem dados de sessão.
 */
export function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() })
}
