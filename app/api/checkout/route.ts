// app/api/checkout/route.ts
//
// POST  → JSON   : retourne { url } pour la redirection JS (comptant via fetch)
// POST  → form   : redirige directement en 303 (fois4 via <form> natif — compatible Safari iOS)

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  
})

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

async function createFois4Session(formule: string, nbEleves: number) {
  const priceId = PRIX_FOIS4[formule]?.[nbEleves]
  if (!priceId) throw new Error(`Price ID introuvable : ${formule} / ${nbEleves}`)

  const base       = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
  const successUrl = `${base}/inscription?paiement=confirme`
  const cancelUrl  = `${base}/inscription`

  // cancel_at = maintenant + 4 mois (arrêt automatique garanti)
  const cancelAt = new Date()
  cancelAt.setMonth(cancelAt.getMonth() + 4)

  const session = await stripe.checkout.sessions.create({
    mode:                 'subscription',
    line_items:           [{ price: priceId, quantity: 1 }],
    subscription_data: {
      metadata: {
        formule,
        nb_eleves:    String(nbEleves),
        mode:         'fois4',
        cancel_after: '4',
        institut:     'Al-Itqan',
      },
    },
    success_url:          successUrl,
    cancel_url:           cancelUrl,
    locale:               'fr',
    payment_method_types: ['card'],
    metadata: { formule, nb_eleves: String(nbEleves), mode: 'fois4' },
  })

  return session.url!
}

export async function POST(req: NextRequest) {
  try {
    // Détecter si l'appel vient d'un <form> (Content-Type: application/x-www-form-urlencoded)
    // ou d'un fetch JSON
    const contentType = req.headers.get('content-type') ?? ''
    const isForm = contentType.includes('application/x-www-form-urlencoded')

    let formule: string, nbEleves: number, mode: string

    if (isForm) {
      const body = await req.text()
      const p    = new URLSearchParams(body)
      formule   = p.get('formule')   ?? ''
      nbEleves  = Number(p.get('nbEleves') ?? 0)
      mode      = p.get('mode')      ?? ''
    } else {
      const body = await req.json()
      formule   = String(body.formule   ?? '')
      nbEleves  = Number(body.nbEleves  ?? 0)
      mode      = String(body.mode      ?? '')
    }

    // Validation
    const FORMULES = ['coran', 'arabe-religion', 'arabe-adultes']
    if (!FORMULES.includes(formule))             return err(isForm, 'Formule invalide.')
    if (![1,2,3,4,5].includes(nbEleves))         return err(isForm, "Nombre d'élèves invalide.")
    if (!['comptant','fois4'].includes(mode))     return err(isForm, 'Mode invalide.')

    // Seul fois4 passe par cette route (comptant utilise Payment Links directs)
    if (mode !== 'fois4') {
      return err(isForm, 'Le paiement comptant utilise des liens directs.')
    }

    const url = await createFois4Session(formule, nbEleves)

    // Réponse selon le type d'appel
    if (isForm) {
      // Redirection 303 native — compatible Safari iOS sans aucun JS
      return NextResponse.redirect(url, { status: 303 })
    }

    return NextResponse.json({ url })

  } catch (e) {
    console.error('[/api/checkout]', e)
    const msg = e instanceof Error ? e.message : 'Erreur serveur.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function err(isForm: boolean, message: string) {
  if (isForm) {
    const base = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'
    return NextResponse.redirect(`${base}/inscription?erreur=${encodeURIComponent(message)}`, { status: 303 })
  }
  return NextResponse.json({ error: message }, { status: 400 })
}
