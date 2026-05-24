/**
 * lib/supabase/server.ts
 * ─────────────────────────────────────────────────────────────
 * Client Supabase pour SERVER COMPONENTS et Server Actions.
 * Importe cookies() de next/headers → NE PAS importer
 * dans un composant 'use client' ni dans middleware.ts.
 * ─────────────────────────────────────────────────────────────
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // Ignorer : appelé depuis un Server Component
            }
          })
        },
      },
    }
  )
}
