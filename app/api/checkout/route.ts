// app/api/checkout/route.ts
//
// POST → form (application/x-www-form-urlencoded) : redirection 303 native (Safari iOS)
// POST → JSON                                      : retourne { url }
//
// Variables Vercel requises :
//   STRIPE_SECRET_KEY   = sk_live_...   (jamais sk_test_ en prod)
//   NEXT_PUBLIC_URL     = https://votre-domaine.vercel.app

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// ── Price IDs récurrents live — générés via fetch-stripe-prices.mjs ──────────
// ⚠️  Ces IDs doivent appartenir au même compte que STRIPE_SECRET_KEY
const PRIX_FOIS4: Record<string, Record<number, string>> = {
  coran: {
    1: 'price_1TcCXxGc0wtxjNeQbfVeF64d',
    2: 'price_1TcCnnGc0wtxjNeQyS1UllQ9',
    3: 'price_1TcCuVGc0wtxjNeQjYnvBH3A',
    4: 'price_1TcCzcGc0wtxjNeQkykPEUhB',
    5: 'price_1TcD2jGc0wtxjNeQK63BWb5P',
  },
  'arabe-religion': {
    1: 'price_1TcD8wGc0wtxjNeQoKfzNeSF',
    2: 'price_1TcDCHGc0wtxjNeQrfoix6nR',
    3: 'price_1TcDELGc0wtxjNeQW7dGfxeq',
    4: 'price_1TcDHRGc0wtxjNeQ1GWOJGLB',
    5: 'price_1TcDKIGc0wtxjNeQxhwKZmQe',
  },
  'arabe-adultes': {
    1: 'price_1TcDPBGc0wtxjNeQ3QxR80J9',
    2: 'price_1TcDRZGc0wtxjNeQXluQMBXu',
    3: 'price_1TcDTyGc0wtxjNeQglAjZEKd',
    4: 'price_1TcDW3Gc0wtxjNeQeiXLs8kt',
    5: 'price_1TcDZrGc0wtxjNeQozgraq2h',
  },
}

// ── Initialisation Stripe à la demande (jamais au niveau module) ──────────────
// Raison : new Stripe() au niveau module peut s'exécuter avant que Vercel
// injecte les variables d'environnement → clé vide → "Expired API Key"
function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  console.log('[checkout] key prefix:', key?.slice(0, 20))

  // Logs de diagnostic — jamais la clé complète
  console.log('[checkout] STRIPE_SECRET_KEY présente :', !!key)
  if (key) {
    const prefix = key.slice(0, 7)         // "sk_live" ou "sk_test"
    const mode   = key.startsWith('sk_live') ? 'LIVE ✅' : key.startsWith('sk_test') ? 'TEST ⚠️' : 'INCONNU ❌'
    console.log('[checkout] Clé préfixe :', prefix, '— mode :', mode)
  } else {
    console.error('[checkout] ❌ STRIPE_SECRET_KEY absente — vérifiez Vercel > Settings > Environment Variables')
  }

  if (!key) {
    throw new Error('STRIPE_SECRET_KEY manquante. Ajoutez-la dans Vercel > Project Settings > Environment Variables.')
  }

  return new Stripe(key, { apiVersion: '2026-05-27.dahlia' })
}

async function createFois4Session(formule: string, nbEleves: number): Promise<string> {
  const priceId = PRIX_FOIS4[formule]?.[nbEleves]

  // Log diagnostic — priceId et paramètres
  console.log('[checkout] Paramètres :', { formule, nbEleves, mode: 'fois4' })
  console.log('[checkout] priceId    :', priceId ?? '❌ INTROUVABLE')

  if (!priceId) {
    throw new Error(`Price ID introuvable pour : formule="${formule}", nbEleves=${nbEleves}. Vérifiez PRIX_FOIS4 dans route.ts.`)
  }

  // Vérifier cohérence clé / priceId
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  const isLiveKey   = key.startsWith('sk_live')
  // Les Price IDs live commencent par price_ et sont associés au compte live
  // Impossible de vérifier le mode du priceId sans appel API, on log un rappel
  if (!isLiveKey) {
    console.warn('[checkout] ⚠️  Clé TEST détectée — assurez-vous que les priceId sont aussi en mode TEST')
  }

  const stripe = getStripe()

  const base       = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
  const successUrl = `${base}/inscription?paiement=confirme`
  const cancelUrl  = `${base}/inscription`

  console.log('[checkout] Création session Checkout Stripe…')

  const session = await stripe.checkout.sessions.create({
    mode:        'subscription',
    line_items:  [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: {
        formule,
        nb_eleves:    String(nbEleves),
        mode:         'fois4',
        cancel_after: '4',       // lu par le webhook → cancel_at dans 4 mois
        institut:     'Al-Itqan',
      },
    },
    success_url:          successUrl,
    cancel_url:           cancelUrl,
    locale:               'fr',
    payment_method_types: ['card'],
    metadata:             { formule, nb_eleves: String(nbEleves), mode: 'fois4' },
  })

  console.log('[checkout] ✅ Session créée — ID :', session.id)
  return session.url!
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? ''
    const isForm      = contentType.includes('application/x-www-form-urlencoded')

    let formule: string, nbEleves: number, mode: string

    if (isForm) {
      const body = await req.text()
      const p    = new URLSearchParams(body)
      formule    = p.get('formule')            ?? ''
      nbEleves   = Number(p.get('nbEleves')    ?? 0)
      mode       = p.get('mode')               ?? ''
    } else {
      const body = await req.json()
      formule    = String(body.formule   ?? '')
      nbEleves   = Number(body.nbEleves  ?? 0)
      mode       = String(body.mode      ?? '')
    }

    console.log('[checkout] Requête reçue :', { formule, nbEleves, mode, isForm })

    // Validation
    const FORMULES = ['coran', 'arabe-religion', 'arabe-adultes']
    if (!FORMULES.includes(formule))         return errResponse(isForm, 'Formule invalide.')
    if (![1,2,3,4,5].includes(nbEleves))     return errResponse(isForm, "Nombre d'élèves invalide.")
    if (!['comptant','fois4'].includes(mode)) return errResponse(isForm, 'Mode invalide.')
    if (mode !== 'fois4')                    return errResponse(isForm, 'Le comptant utilise des liens directs.')

    const url = await createFois4Session(formule, nbEleves)

    if (isForm) {
      return NextResponse.redirect(url, { status: 303 })
    }
    return NextResponse.json({ url })

  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur serveur inconnue.'
    console.error('[checkout] ❌ Erreur :', msg)

    // Retourner l'erreur lisible — côté form on redirige avec le message
    const contentType = req.headers.get('content-type') ?? ''
    const isForm      = contentType.includes('application/x-www-form-urlencoded')
    return errResponse(isForm, msg)
  }
}

function errResponse(isForm: boolean, message: string) {
  console.error('[checkout] Erreur retournée :', message)
  if (isForm) {
    const base = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    return NextResponse.redirect(
      `${base}/inscription?erreur=${encodeURIComponent(message)}`,
      { status: 303 }
    )
  }
  return NextResponse.json({ error: message }, { status: 400 })
}
