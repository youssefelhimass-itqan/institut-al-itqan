/**
 * middleware.ts  (racine du projet)
 * ─────────────────────────────────────────────────────────────
 * Importe UNIQUEMENT depuis lib/supabase/middleware.ts
 * pour éviter tout import de next/headers dans ce contexte.
 * ─────────────────────────────────────────────────────────────
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // La réponse initiale — le client middleware va y ajouter les cookies de session
  let response = NextResponse.next({ request })

  const supabase = createClient(request, response)

  // getUser() valide le JWT côté serveur (plus sûr que getSession())
  const { data: { user } } = await supabase.auth.getUser()

  // ── Non connecté ──────────────────────────────────────────
  if (!user) {
    if (pathname.startsWith('/parent') || pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return response
  }

  // ── Connecté : récupérer le rôle ─────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'parent'

  // Sur /  → rediriger vers l'espace approprié
  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(role === 'admin' ? '/admin' : '/parent', request.url)
    )
  }

  // Sur /admin sans être admin → renvoyer vers /parent
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/parent', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
