import { createServerClient as createSSRClient } from '@supabase/ssr'
import { createClient } from "@supabase/supabase-js"
import { cache } from "react"
import { cookies } from 'next/headers'

// Check if Supabase environment variables are available
export const isSupabaseConfigured =
  typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.length > 0 &&
  typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0

// Create a Supabase client for Server Components with cookie support
export const createServerClient = cache(async () => {
  if (!isSupabaseConfigured) {
    console.warn("Supabase environment variables are not set.")
    return null
  }

  const cookieStore = await cookies()

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Ignorar erros em server components
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Ignorar erros em server components
          }
        },
      },
      auth: {
        flowType: 'pkce',
      },
    }
  )
})

