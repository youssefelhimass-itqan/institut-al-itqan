// app/api/webhook/route.ts
//
// Webhook Stripe — deux responsabilités :
//  1. customer.subscription.created → applique cancel_at (arrêt après 4 mois)
//  2. checkout.session.completed    → envoie l'email de confirmation au client
//                                     + notification à l'administration
//
// Variables d'environnement requises :
//   STRIPE_SECRET_KEY=sk_live_...
//   STRIPE_WEBHOOK_SECRET=whsec_...
//   RESEND_API_KEY=re_...              (service email gratuit — resend.com)
//   ADMIN_EMAIL=admin@votre-domaine.com
//   NEXT_PUBLIC_URL=https://votre-domaine.netlify.app

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

const FORMULE_LABEL: Record<string, string> = {
  coran:            'Classe Coran (Enfants & Adultes)',
  'arabe-religion': 'Classe Arabe et Religion (Enfants)',
  'arabe-adultes':  'Classe Arabe Adultes',
}

// ── Formatage date en français ────────────────────────────────────────────────
function dateFR(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Génération de l'échéancier pour le 4 fois ─────────────────────────────────
function echeancier(startTs: number, montantMensuel: number): string {
  const lignes: string[] = []
  for (let i = 0; i < 4; i++) {
    const d = new Date(startTs * 1000)
    d.setMonth(d.getMonth() + i)
    const label = i === 0 ? 'Aujourd\'hui (1ᵉʳ prélèvement)' : dateFR(Math.floor(d.getTime() / 1000))
    lignes.push(`• ${label} : ${montantMensuel.toFixed(2).replace('.', ',')} €`)
  }
  const fin = new Date(startTs * 1000)
  fin.setMonth(fin.getMonth() + 4)
  lignes.push(``)
  lignes.push(`L'abonnement sera automatiquement résilié le ${fin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`)
  return lignes.join('\n')
}

// ── Envoi d'email via Resend (API simple, gratuit jusqu'à 3 000/mois) ─────────
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) { console.warn('[webhook] RESEND_API_KEY manquant — email non envoyé.'); return }

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Institut Al-Itqan <noreply@institutalalitqan.fr>',
      to:      [to],
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('[webhook] Erreur Resend :', err)
  }
}

// ── Template HTML email client ────────────────────────────────────────────────
function emailClient(params: {
  nom: string
  formule: string
  nbEleves: string
  montant: string
  mode: string
  date: string
  echeances: string
}): string {
  const { nom, formule, nbEleves, montant, mode, date, echeances } = params
  const isPaiement4 = mode === 'fois4'

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><style>
  body { font-family: Georgia, serif; background: #F9F6F1; margin: 0; padding: 20px; }
  .card { background: white; max-width: 580px; margin: 0 auto; border-radius: 16px;
          box-shadow: 0 4px 24px rgba(44,26,6,0.12); overflow: hidden; }
  .header { background: #3A0D18; padding: 32px; text-align: center; }
  .header h1 { color: #F5E7D3; font-size: 20px; margin: 0 0 4px; }
  .header p { color: #C4A05A; font-size: 13px; margin: 0; letter-spacing: 0.1em; }
  .body { padding: 32px; }
  .body h2 { color: #2C1A06; font-size: 18px; margin: 0 0 16px; }
  .body p { color: #4A3520; font-size: 15px; line-height: 1.6; margin: 0 0 12px; }
  .row { display: flex; justify-content: space-between; padding: 10px 0;
         border-bottom: 1px solid #EDE0C4; }
  .row:last-child { border-bottom: none; }
  .lbl { color: #8A7060; font-size: 13px; }
  .val { color: #2C1A06; font-size: 14px; font-weight: bold; }
  .echeancier { background: #F9F6F1; border-radius: 10px; padding: 16px 20px;
                margin: 20px 0; font-size: 13px; color: #4A3520; line-height: 1.8; white-space: pre-line; }
  .green { background: rgba(52,168,83,0.08); border-radius: 10px; padding: 14px 20px;
           color: #1E6E34; font-size: 13px; margin: 20px 0; }
  .footer { background: #F9F6F1; padding: 20px 32px; text-align: center;
            font-size: 12px; color: #8A7060; border-top: 1px solid #EDE0C4; }
</style></head>
<body>
<div class="card">
  <div class="header">
    <h1>Institut Al-Itqan</h1>
    <p>CONFIRMATION D'INSCRIPTION</p>
  </div>
  <div class="body">
    <h2>Assalamu alaykum${nom ? `, ${nom}` : ''} 🤍</h2>
    <p>Votre inscription à l'Institut Al-Itqan a bien été enregistrée. Nous avons reçu votre paiement et sommes ravis de vous accueillir parmi nous.</p>

    <div style="margin: 24px 0;">
      <div class="row"><span class="lbl">Formule</span><span class="val">${formule}</span></div>
      <div class="row"><span class="lbl">Nombre d'élèves</span><span class="val">${nbEleves}</span></div>
      <div class="row"><span class="lbl">Mode de paiement</span><span class="val">${isPaiement4 ? 'Paiement en 4 fois' : 'Paiement comptant'}</span></div>
      <div class="row"><span class="lbl">Montant</span><span class="val">${montant}</span></div>
      <div class="row"><span class="lbl">Date</span><span class="val">${date}</span></div>
    </div>

    ${isPaiement4 ? `
    <p style="font-weight: bold; color: #2C1A06; margin-bottom: 8px;">Échéancier des prélèvements :</p>
    <div class="echeancier">${echeances}</div>
    ` : ''}

    <div class="green">
      ✅ <strong>Votre place est confirmée.</strong><br>
      Vous recevrez prochainement les informations de connexion à la plateforme et les détails de votre groupe.
    </div>

    <p>Pour toute question, contactez-nous via la plateforme parents.</p>
    <p>Que Allah vous bénisse et facilite l'apprentissage de vos enfants.</p>
  </div>
  <div class="footer">
    Institut Al-Itqan · Institut islamique en ligne<br>
    Cet email est une confirmation automatique, merci de ne pas y répondre.
  </div>
</div>
</body></html>`
}

// ── Template notification admin ───────────────────────────────────────────────
function emailAdmin(params: {
  email: string; formule: string; nbEleves: string
  montant: string; mode: string; date: string
}): string {
  const { email, formule, nbEleves, montant, mode, date } = params
  return `<p><strong>Nouvelle inscription — Institut Al-Itqan</strong></p>
<ul>
  <li><strong>Email client :</strong> ${email}</li>
  <li><strong>Formule :</strong> ${formule}</li>
  <li><strong>Élèves :</strong> ${nbEleves}</li>
  <li><strong>Mode :</strong> ${mode === 'fois4' ? '4 fois' : 'Comptant'}</li>
  <li><strong>Montant :</strong> ${montant}</li>
  <li><strong>Date :</strong> ${date}</li>
</ul>`
}

export async function POST(req: NextRequest) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''
  const secret    = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  if (!secret) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET manquant.')
    return NextResponse.json({ error: 'Configuration manquante.' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch {
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 })
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 1. Abonnement créé → appliquer cancel_at (arrêt automatique 4 mois)
  // ════════════════════════════════════════════════════════════════════════════
  if (event.type === 'customer.subscription.created') {
    const sub  = event.data.object as Stripe.Subscription
    const meta = sub.metadata ?? {}

    if (meta.cancel_after === '4' && meta.institut === 'Al-Itqan') {
      const cancelAt = new Date(sub.start_date * 1000)
      cancelAt.setMonth(cancelAt.getMonth() + 4)

      try {
        await stripe.subscriptions.update(sub.id, {
          cancel_at: Math.floor(cancelAt.getTime() / 1000),
        })
        console.log(`[webhook] cancel_at appliqué → ${sub.id} se termine le ${cancelAt.toISOString()}`)
      } catch (err) {
        console.error('[webhook] Erreur cancel_at :', err)
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // 2. Paiement finalisé → envoyer emails de confirmation
  // ════════════════════════════════════════════════════════════════════════════
  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object as Stripe.Checkout.Session
    const meta     = (session.metadata ?? {}) as Record<string, string>
    const subMeta  = (session as any)?.subscription_data?.metadata as Record<string, string> ?? meta

    const formule  = meta.formule  || subMeta.formule  || ''
    const nbEleves = meta.nb_eleves || subMeta.nb_eleves || '?'
    const mode     = meta.mode     || subMeta.mode     || 'comptant'

    const email    = session.customer_details?.email ?? ''
    const nom      = session.customer_details?.name  ?? ''
    const dateStr  = dateFR(session.created)

    // Montant affiché
    const montantCents = session.amount_total ?? 0
    const montantStr   = `${(montantCents / 100).toFixed(2).replace('.', ',')} €`

    // Échéancier pour le 4 fois
    let echeances = ''
    if (mode === 'fois4' && montantCents > 0) {
      const mensuel = montantCents / 100
      echeances = echeancier(session.created, mensuel)
    }

    const formuleLabel = FORMULE_LABEL[formule] ?? formule
    const nbLabel      = `${nbEleves} élève${Number(nbEleves) > 1 ? 's' : ''}`

    // Email au client
    if (email) {
      await sendEmail(
        email,
        `✅ Confirmation d'inscription — Institut Al-Itqan`,
        emailClient({ nom, formule: formuleLabel, nbEleves: nbLabel, montant: montantStr, mode, date: dateStr, echeances })
      )
    }

    // Email à l'admin
    const adminEmail = process.env.ADMIN_EMAIL
    if (adminEmail) {
      await sendEmail(
        adminEmail,
        `📩 Nouvelle inscription — ${formuleLabel} · ${nbLabel}`,
        emailAdmin({ email, formule: formuleLabel, nbEleves: nbLabel, montant: montantStr, mode, date: dateStr })
      )
    }
  }

  return NextResponse.json({ received: true })
}
