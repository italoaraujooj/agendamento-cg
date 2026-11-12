/**
 * Login com Google: só escopos não sensíveis (nome e e-mail). Não exigem a
 * verificação do app no Google e não mostram a tela "O Google não verificou
 * este app". As reservas e escalas chegam à agenda da pessoa por links de
 * assinatura (ICS: /api/reservas/ics e /api/escalas/ics), sem acesso à conta
 * Google.
 */
export const GOOGLE_LOGIN_SCOPES = "openid email profile"
