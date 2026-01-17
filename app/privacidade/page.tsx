import { redirect } from 'next/navigation'

/**
 * Redireciona /privacidade para /privacy
 * Mantém compatibilidade com URLs em português
 */
export default function PrivacidadePage() {
  redirect('/privacy')
}
