// app/api/webhook/route.ts
//
// Webhook Stripe — applique cancel_at sur l'abonnement dès sa création.
//
// Ce webhook écoute l'événement "customer.subscription.created".
// Quand un abonnement est créé avec les métadonnées cancel_after=4,
// il fixe cancel_at = date_de_début + 4 mois.
// Résultat : Stripe prélève exactement 4 fois puis résilie automatiquement.
//
// ── Configuration dans Stripe Dashboard ──────────────────────────────────────
// 1. Developers → Webhooks → Add endpoint
// 2. URL : https://votre-domaine.netlify.app/api/webhook
// 3. Événements à écouter : customer.subscription.created
// 4. Copier le "Signing secret" (whsec_...) → mettre dans STRIPE_WEBHOOK_SECRET
//
// ── Variables d'environnement à ajouter ──────────────────────────────────────
// STRIPE_WEBHOOK_SECRET=whsec_...

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

// Stripe exige le corps brut (non parsé) pour valider la signature
export const config = { api: { bodyParser: false } }

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''
  const secret    = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  if (!secret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET manquant.')
    return NextResponse.json({ error: 'Configuration webhook manquante.' }, { status: 500 })
  }

  // ── Vérifier la signature Stripe ────────────────────────────────────────
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch (err) {
    console.error('[webhook] Signature invalide :', err)
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 })
  }

  // ── Traiter uniquement "customer.subscription.created" ──────────────────
  if (event.type === 'customer.subscription.created') {
    const sub = event.data.object as Stripe.Subscription

    // Vérifier que c'est bien un abonnement Al-Itqan en 4 fois
    const meta = sub.metadata ?? {}
    if (meta.cancel_after !== '4' || meta.institut !== 'Al-Itqan') {
      // Pas notre abonnement — on ignore silencieusement
      return NextResponse.json({ received: true })
    }

    // Calculer cancel_at = date de début de l'abonnement + 4 mois
    const startDate = new Date(sub.start_date * 1000)
    const cancelAt  = new Date(startDate)
    cancelAt.setMonth(cancelAt.getMonth() + 4)
    const cancelAtTimestamp = Math.floor(cancelAt.getTime() / 1000)

    try {
      await stripe.subscriptions.update(sub.id, {
        cancel_at: cancelAtTimestamp,
      })
      console.log(`[webhook] cancel_at appliqué sur ${sub.id} → ${cancelAt.toISOString()}`)
    } catch (err) {
      console.error(`[webhook] Erreur update subscription ${sub.id} :`, err)
      return NextResponse.json({ error: 'Erreur update subscription.' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
