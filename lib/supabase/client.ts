/**
 * lib/supabase/client.ts
 * ─────────────────────────────────────────────────────────────
 * Client Supabase pour le NAVIGATEUR uniquement.
 * À utiliser dans les composants 'use client'.
 * N'importe RIEN de next/headers → safe côté client.
 * ─────────────────────────────────────────────────────────────
 */
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
