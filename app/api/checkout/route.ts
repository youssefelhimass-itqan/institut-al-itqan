// app/api/checkout/route.ts
//
// Crée une session Stripe Checkout.
// Le cancel_at (arrêt après 4 mois) est appliqué par le webhook
// dans app/api/webhook/route.ts dès que l'abonnement est créé.

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  
})

// ─── Price IDs ponctuels (comptant) ──────────────────────────────────────────
const PRIX_COMPTANT: Record<string, Record<number, string>> = {
  coran: {
    1: 'price_1TcCaPGc0wtxjNeQ21gcKbZe',
    2: 'price_1TcCpCGc0wtxjNeQAHNIncw4',
    3: 'price_1TcCvFGc0wtxjNeQOc6gWTAw',
    4: 'price_1TcD0AGc0wtxjNeQeYjdqUcw',
    5: 'price_1TcD3CGc0wtxjNeQ7WmbgoSl',
  },
  'arabe-religion': {
    1: 'price_1TcD8VGc0wtxjNeQiOhBEqlm',
    2: 'price_1TcDBnGc0wtxjNeQS4gMzewZ',
    3: 'price_1TcDDuGc0wtxjNeQQYGzvu26',
    4: 'price_1TcDGzGc0wtxjNeQvPoLLvoK',
    5: 'price_1TcDJdGc0wtxjNeQs5ZqWmR7',
  },
  'arabe-adultes': {
    1: 'price_1TcDOrGc0wtxjNeQ3lANKa1w',
    2: 'price_1TcDR9Gc0wtxjNeQu8ZMHdcY',
    3: 'price_1TcDTUGc0wtxjNeQKwSo2LfZ',
    4: 'price_1TcDVfGc0wtxjNeQH0ozgT8a',
    5: 'price_1TcDZ8Gc0wtxjNeQNc6XtQSV',
  },
}

// ─── Price IDs récurrents (4 fois) ───────────────────────────────────────────
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

export async function POST(req: NextRequest) {
  try {
    const { formule, nbEleves, mode } = await req.json()

    const FORMULES = ['coran', 'arabe-religion', 'arabe-adultes']
    if (!FORMULES.includes(formule))            return NextResponse.json({ error: 'Formule invalide.'          }, { status: 400 })
    if (![1,2,3,4,5].includes(Number(nbEleves))) return NextResponse.json({ error: "Nombre d'élèves invalide."  }, { status: 400 })
    if (!['comptant','fois4'].includes(mode))    return NextResponse.json({ error: 'Mode invalide.'             }, { status: 400 })

    const base       = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    const successUrl = `${base}/inscription?paiement=confirme`
    const cancelUrl  = `${base}/inscription`
    const n          = Number(nbEleves)

    // ── Comptant : paiement unique ──────────────────────────────────────────
    if (mode === 'comptant') {
      const priceId = PRIX_COMPTANT[formule]?.[n]
      if (!priceId) return NextResponse.json({ error: 'Prix comptant introuvable.' }, { status: 404 })

      const session = await stripe.checkout.sessions.create({
        mode:                 'payment',
        line_items:           [{ price: priceId, quantity: 1 }],
        success_url:          successUrl,
        cancel_url:           cancelUrl,
        locale:               'fr',
        payment_method_types: ['card'],
        metadata:             { formule, nb_eleves: String(n), mode, institut: 'Al-Itqan' },
      })
      return NextResponse.json({ url: session.url })
    }

    // ── 4 fois : abonnement — cancel_at appliqué par le webhook ────────────
    const priceId = PRIX_FOIS4[formule]?.[n]
    if (!priceId) return NextResponse.json({ error: 'Prix 4 fois introuvable.' }, { status: 404 })

    const session = await stripe.checkout.sessions.create({
      mode:                 'subscription',
      line_items:           [{ price: priceId, quantity: 1 }],
      success_url:          successUrl,
      cancel_url:           cancelUrl,
      locale:               'fr',
      payment_method_types: ['card'],
      // Les métadonnées sont lues par le webhook pour appliquer cancel_at
      subscription_data: {
        metadata: { formule, nb_eleves: String(n), mode: 'fois4', cancel_after: '4', institut: 'Al-Itqan' },
      },
    })
    return NextResponse.json({ url: session.url })

  } catch (err) {
    console.error('[/api/checkout]', err)
    return NextResponse.json({ error: 'Erreur serveur. Réessayez.' }, { status: 500 })
  }
}
