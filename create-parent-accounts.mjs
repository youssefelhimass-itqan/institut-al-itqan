#!/usr/bin/env node
/**
 * create-parent-accounts.mjs
 * ─────────────────────────────────────────────────────────────────
 * Crée les comptes parents dans Supabase Auth (service role).
 * - Génère un mot de passe sécurisé par compte
 * - Confirme l'email automatiquement (email_confirm: true)
 * - Si le compte existe déjà, le signale sans recréer
 * - Génère un tableau récapitulatif email / mot de passe
 *
 * Usage :
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... \
 *   node create-parent-accounts.mjs
 *
 * ⚠️  N'exécuter qu'une seule fois, côté serveur, jamais dans le frontend.
 * ⚠️  Supprimer ce fichier après utilisation ou ne pas le committer.
 */

import crypto from 'crypto'

// ── Configuration ─────────────────────────────────────────────────────────────
const SUPABASE_URL             = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n❌  Variables manquantes.')
  console.error('    Usage :')
  console.error('    SUPABASE_URL=https://xxx.supabase.co \\')
  console.error('    SUPABASE_SERVICE_ROLE_KEY=eyJhbGci... \\')
  console.error('    node create-parent-accounts.mjs\n')
  process.exit(1)
}

// ── Liste des emails ──────────────────────────────────────────────────────────
const EMAILS = [
  'imane.oumoussa72@gmail.com',
  'siriman92@gmail.com',
  'azizlakhal072@gmail.com',
  'soumia.lakhel@yahoo.fr',
  'l.mounia@hotmail.fr',
  'Azedine72@hotmail.fr',
  'zinedinezaazoui.pro@gmail.com',
  'jouhri.electricite@gmail.com',
  'Fayrouz.lakhal@hotmail.fr',
  'Taza-salima@hotmail.com',
  'ayoub72610@hotmail.fr',
]

// ── Générateur de mot de passe sécurisé ──────────────────────────────────────
// Garantit : ≥1 majuscule, ≥1 minuscule, ≥1 chiffre, ≥1 spécial, longueur 12
function generatePassword() {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'   // sans I, O (ambigus)
  const lower   = 'abcdefghjkmnpqrstuvwxyz'    // sans i, l, o
  const digits  = '23456789'                    // sans 0, 1
  const special = '!@#$%^&*-+'
  const all     = upper + lower + digits + special

  const rand = (str) => str[crypto.randomInt(str.length)]

  // 1 de chaque catégorie obligatoire
  const required = [
    rand(upper),
    rand(upper),
    rand(lower),
    rand(lower),
    rand(digits),
    rand(digits),
    rand(special),
  ]

  // Compléter jusqu'à 12 caractères
  while (required.length < 12) required.push(rand(all))

  // Mélanger pour que les caractères obligatoires ne soient pas toujours en début
  for (let i = required.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[required[i], required[j]] = [required[j], required[i]]
  }

  return required.join('')
}

// ── Appel API Supabase Admin ──────────────────────────────────────────────────
async function createUser(email, password) {
  const url = `${SUPABASE_URL}/auth/v1/admin/users`
  const res  = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':         SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,      // email confirmé immédiatement, sans envoi de lien
      user_metadata: { role: 'parent' },
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    // Supabase renvoie 422 si l'email existe déjà
    const msg = data?.msg || data?.message || data?.error_description || JSON.stringify(data)
    if (res.status === 422 && msg.toLowerCase().includes('already')) {
      return { status: 'exists' }
    }
    return { status: 'error', message: msg }
  }

  return { status: 'created', userId: data.id }
}

// ── Insérer dans la table profiles (role = 'parent') ─────────────────────────
async function upsertProfile(userId, email) {
  const url = `${SUPABASE_URL}/rest/v1/profiles`
  const res  = await fetch(url, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':         SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer':        'resolution=ignore-duplicates',  // ne pas écraser si existe
    },
    body: JSON.stringify({ id: userId, email: email.toLowerCase(), role: 'parent' }),
  })
  return res.ok
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n⏳  Création des comptes parents…\n')

  const results = []

  for (const rawEmail of EMAILS) {
    const email    = rawEmail.trim()
    const password = generatePassword()

    const result = await createUser(email, password)

    if (result.status === 'created') {
      await upsertProfile(result.userId, email)
      results.push({ email, password, statut: '✅ Créé' })
      console.log(`✅  ${email}`)
    } else if (result.status === 'exists') {
      results.push({ email, password: '(compte existant)', statut: '⚠️  Existe déjà' })
      console.log(`⚠️  ${email} — compte déjà existant, ignoré`)
    } else {
      results.push({ email, password: '(erreur)', statut: `❌ ${result.message}` })
      console.log(`❌  ${email} — ${result.message}`)
    }

    // Pause courte pour ne pas saturer l'API
    await new Promise(r => setTimeout(r, 200))
  }

  // ── Tableau récapitulatif ──────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(75))
  console.log(' RÉCAPITULATIF — À CONSERVER EN LIEU SÛR')
  console.log(' ⚠️  Ces mots de passe ne sont visibles qu\'une seule fois.')
  console.log('═'.repeat(75))

  const colW = [38, 18, 20]
  const pad  = (s, n) => String(s).padEnd(n)

  console.log(pad('Email', colW[0]) + pad('Mot de passe', colW[1]) + 'Statut')
  console.log('─'.repeat(75))

  for (const r of results) {
    console.log(pad(r.email, colW[0]) + pad(r.password, colW[1]) + r.statut)
  }

  console.log('═'.repeat(75))

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const { writeFileSync } = await import('fs')
  const csv = ['email,mot_de_passe,statut', ...results.map(r =>
    `"${r.email}","${r.password}","${r.statut.replace(/"/g, "'")}"`
  )].join('\n')

  const outFile = 'parents-comptes.csv'
  writeFileSync(outFile, csv, 'utf8')
  console.log(`\n✅  Fichier sauvegardé : ${outFile}`)
  console.log('    → Conservez ce fichier en lieu sûr, puis supprimez-le.')
  console.log('    → Ne jamais committer ce fichier dans Git.\n')
}

main().catch(err => {
  console.error('\n❌  Erreur :', err.message)
  process.exit(1)
})
