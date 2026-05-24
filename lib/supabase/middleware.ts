/**
 * lib/supabase/middleware.ts
 * ─────────────────────────────────────────────────────────────
 * Client Supabase pour MIDDLEWARE uniquement.
 * Lit et écrit les cookies via NextRequest / NextResponse.
 * N'importe pas next/headers.
 * ─────────────────────────────────────────────────────────────
 */
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export function createClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Écrire dans la requête (pour les lectures suivantes dans ce cycle)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Écrire dans la réponse (pour que le navigateur reçoive les cookies)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}
