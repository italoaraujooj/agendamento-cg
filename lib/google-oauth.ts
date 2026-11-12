/**
 * Escopos do Google.
 *
 * O login comum pede só os não sensíveis (nome e e-mail), que não exigem a
 * verificação do app no Google e não mostram a tela "O Google não verificou
 * este app". Os de agenda são sensíveis e ficam só no botão "Conectar Google
 * Calendar" do Perfil.
 */
export const GOOGLE_LOGIN_SCOPES = "openid email profile"

export const GOOGLE_CALENDAR_SCOPES = [
  GOOGLE_LOGIN_SCOPES,
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.calendarlist",
].join(" ")

/**
 * Cookie curto marcado antes de ir ao Google pelo botão de conectar a agenda.
 * O callback só guarda os tokens do Google quando ele existe: um login comum
 * (sem escopos de agenda) não pode sobrescrever a conexão com a agenda.
 */
export const GOOGLE_CALENDAR_CONNECT_COOKIE = "gcal_connect"
