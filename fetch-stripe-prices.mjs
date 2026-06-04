#!/usr/bin/env node
/**
 * fetch-stripe-prices.mjs
 * ───────────────────────────────────────────────────────────────────────────
 * Récupère automatiquement tous vos produits et prix Stripe,
 * puis génère les deux constantes prêtes à coller dans route.ts :
 *   - STRIPE_PRICE_IDS_COMPTANT  (prix ponctuels)
 *   - STRIPE_PRICE_IDS_FOIS4     (prix récurrents)
 *
 * Prérequis :
 *   npm install stripe
 *
 * Usage :
 *   node fetch-stripe-prices.mjs sk_live_VOTRE_CLE
 *   — ou —
 *   STRIPE_SECRET_KEY=sk_live_... node fetch-stripe-prices.mjs
 * ───────────────────────────────────────────────────────────────────────────
 */

import Stripe from 'stripe'
import fs     from 'fs'
import path   from 'path'

// ── 1. Clé API ───────────────────────────────────────────────────────────────
const apiKey = process.argv[2] || process.env.STRIPE_SECRET_KEY
if (!apiKey) {
  console.error('\n❌  Clé Stripe manquante.')
  console.error('    Usage : node fetch-stripe-prices.mjs sk_live_VOTRE_CLE\n')
  process.exit(1)
}

const stripe = new Stripe(apiKey, { apiVersion: '2024-06-20' })

// ── 2. Règles de mapping ─────────────────────────────────────────────────────
// Le script cherche ces patterns (regex, insensible à la casse)
// dans le NOM du produit Stripe.
//
// ⚙️  Si vos produits ont un nommage différent, modifiez les patterns ici.
// Exemples de noms qui fonctionnent automatiquement :
//   "Coran 1 élève", "Coran - 1 élève", "Classe Coran 1"
//   "Arabe et Religion 2 élèves", "Arabe Religion 2"
//   "Arabe Adultes 3", "Arabe adulte - 3 élèves"
//
// Structure : [pattern, formule_interne, nb_eleves]
const RULES = [
  [/coran.*(1|un).*(él|eleve|enfant)/i,          'coran',           1],
  [/coran.*(2|deux).*(él|eleve|enfant)/i,         'coran',           2],
  [/coran.*(3|trois).*(él|eleve|enfant)/i,        'coran',           3],
  [/coran.*(4|quatre).*(él|eleve|enfant)/i,       'coran',           4],
  [/coran.*(5|cinq).*(él|eleve|enfant)/i,         'coran',           5],
  [/arabe.*(relig|itqan).*(1|un)/i,               'arabe-religion',  1],
  [/arabe.*(relig|itqan).*(2|deux)/i,             'arabe-religion',  2],
  [/arabe.*(relig|itqan).*(3|trois)/i,            'arabe-religion',  3],
  [/arabe.*(relig|itqan).*(4|quatre)/i,           'arabe-religion',  4],
  [/arabe.*(relig|itqan).*(5|cinq)/i,             'arabe-religion',  5],
  [/arabe.*(adult).*(1|un)/i,                     'arabe-adultes',   1],
  [/arabe.*(adult).*(2|deux)/i,                   'arabe-adultes',   2],
  [/arabe.*(adult).*(3|trois)/i,                  'arabe-adultes',   3],
  [/arabe.*(adult).*(4|quatre)/i,                 'arabe-adultes',   4],
  [/arabe.*(adult).*(5|cinq)/i,                   'arabe-adultes',   5],
  // Fallback : chiffre seul dans le nom (moins précis, utilisé en dernier recours)
  [/coran.*\b1\b/i,                               'coran',           1],
  [/coran.*\b2\b/i,                               'coran',           2],
  [/coran.*\b3\b/i,                               'coran',           3],
  [/coran.*\b4\b/i,                               'coran',           4],
  [/coran.*\b5\b/i,                               'coran',           5],
  [/arabe.*(relig|itqan).*\b1\b/i,                'arabe-religion',  1],
  [/arabe.*(relig|itqan).*\b2\b/i,                'arabe-religion',  2],
  [/arabe.*(relig|itqan).*\b3\b/i,                'arabe-religion',  3],
  [/arabe.*(relig|itqan).*\b4\b/i,                'arabe-religion',  4],
  [/arabe.*(relig|itqan).*\b5\b/i,                'arabe-religion',  5],
  [/arabe.*(adult).*\b1\b/i,                      'arabe-adultes',   1],
  [/arabe.*(adult).*\b2\b/i,                      'arabe-adultes',   2],
  [/arabe.*(adult).*\b3\b/i,                      'arabe-adultes',   3],
  [/arabe.*(adult).*\b4\b/i,                      'arabe-adultes',   4],
  [/arabe.*(adult).*\b5\b/i,                      'arabe-adultes',   5],
]

// ── 3. Structure vide du résultat ────────────────────────────────────────────
function emptyGrid() {
  return {
    coran:            { 1: null, 2: null, 3: null, 4: null, 5: null },
    'arabe-religion': { 1: null, 2: null, 3: null, 4: null, 5: null },
    'arabe-adultes':  { 1: null, 2: null, 3: null, 4: null, 5: null },
  }
}

// ── 4. Mapper un prix à sa combinaison ───────────────────────────────────────
function mapPrice(name) {
  for (const [pattern, formule, n] of RULES) {
    if (pattern.test(name)) return { formule, n }
  }
  return null
}

// ── 5. Paginer les résultats Stripe ─────────────────────────────────────────
async function fetchAll(method, params) {
  const items = []
  let page = await method({ ...params, limit: 100 })
  items.push(...page.data)
  while (page.has_more) {
    page = await method({ ...params, limit: 100, starting_after: items.at(-1).id })
    items.push(...page.data)
  }
  return items
}

// ── 6. Générer une constante TypeScript ──────────────────────────────────────
function generateConst(name, grid, fallbackPrefix) {
  const lines = [`const ${name}: Record<string, Record<number, string>> = {`]
  for (const [formule, eleves] of Object.entries(grid)) {
    lines.push(`  '${formule}': {`)
    for (let n = 1; n <= 5; n++) {
      const id      = eleves[n]
      const val     = id ? `'${id}'` : `'price_MANQUANT_${fallbackPrefix}_${formule}_${n}'`
      const comment = id ? '' : '  // ⚠️  À remplir manuellement'
      lines.push(`    ${n}: ${val},${comment}`)
    }
    lines.push(`  },`)
  }
  lines.push(`}`)
  return lines.join('\n')
}

// ── 7. Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n⏳  Connexion à Stripe…')

  // Récupérer tous les prix avec leur produit
  const prices = await fetchAll(
    (p) => stripe.prices.list({ ...p, active: true, expand: ['data.product'] }),
    { active: true }
  )

  console.log(`✅  ${prices.length} prix actifs récupérés.\n`)

  // Séparer ponctuels et récurrents
  const ponctuels  = prices.filter(p => p.type === 'one_time')
  const recurrents = prices.filter(p => p.type === 'recurring')

  console.log(`   Ponctuels  : ${ponctuels.length}`)
  console.log(`   Récurrents : ${recurrents.length}\n`)

  // ── Affichage complet ──────────────────────────────────────────────────────
  console.log('═'.repeat(70))
  console.log(' TOUS VOS PRIX STRIPE')
  console.log('═'.repeat(70))

  for (const p of prices) {
    const prod    = typeof p.product === 'object' ? p.product : { name: String(p.product) }
    const euros   = ((p.unit_amount ?? 0) / 100).toFixed(2)
    const type    = p.type === 'recurring' ? `récurrent/${p.recurring?.interval}` : 'ponctuel'
    const mapping = mapPrice(prod.name ?? '')
    const mapped  = mapping ? ` → ${mapping.formule} / ${mapping.n} élève(s)` : ' → ❓ non mappé'
    console.log(`  ${p.id.padEnd(30)} ${euros.padStart(8)} € | ${type.padEnd(18)} | ${prod.name}${mapped}`)
  }

  // ── Mapper ─────────────────────────────────────────────────────────────────
  const gridComptant = emptyGrid()
  const gridFois4    = emptyGrid()

  let okComptant = 0
  let okFois4    = 0
  const conflicts = []

  for (const p of prices) {
    const prod = typeof p.product === 'object' ? p.product : { name: '' }
    const m    = mapPrice(prod.name ?? '')
    if (!m) continue

    const { formule, n } = m
    const grid = p.type === 'recurring' ? gridFois4 : gridComptant
    const label = p.type === 'recurring' ? 'récurrent' : 'ponctuel'

    if (grid[formule][n]) {
      conflicts.push(`${label} / ${formule} / ${n} élève(s) : conflit entre ${grid[formule][n]} et ${p.id}`)
    } else {
      grid[formule][n] = p.id
      if (p.type === 'recurring') okFois4++; else okComptant++
    }
  }

  // ── Résultats ──────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log(` RÉSULTAT DU MAPPING`)
  console.log('═'.repeat(70))
  console.log(`  Ponctuels mappés  : ${okComptant}/15`)
  console.log(`  Récurrents mappés : ${okFois4}/15`)

  if (conflicts.length) {
    console.log('\n⚠️  CONFLITS (plusieurs prix correspondent au même slot) :')
    conflicts.forEach(c => console.log('   • ' + c))
    console.log('   → Vérifiez les noms de vos produits dans le dashboard Stripe.')
  }

  // ── Générer le code ────────────────────────────────────────────────────────
  const constComptant = generateConst('STRIPE_PRICE_IDS_COMPTANT', gridComptant, 'CPT')
  const constFois4    = generateConst('STRIPE_PRICE_IDS_FOIS4',    gridFois4,    'F4')

  const outputCode = `// ─── Généré automatiquement par fetch-stripe-prices.mjs ──────────────────────
// Copiez ce bloc dans : app/api/checkout/route.ts
// (remplacez les éventuels 'price_MANQUANT_...' par les vrais Price IDs)

${constComptant}

${constFois4}
`

  // ── Afficher dans le terminal ──────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log(' CODE GÉNÉRÉ — copiez dans app/api/checkout/route.ts')
  console.log('═'.repeat(70))
  console.log('\n' + outputCode)

  // ── Sauvegarder dans un fichier ────────────────────────────────────────────
  const outFile = path.join(process.cwd(), 'stripe-price-ids.generated.ts')
  fs.writeFileSync(outFile, outputCode, 'utf8')
  console.log(`\n✅  Fichier sauvegardé : ${outFile}`)
  console.log('   → Ouvrez ce fichier et copiez son contenu dans route.ts\n')

  if (okComptant < 15 || okFois4 < 15) {
    console.log('⚠️  Certains prix n\'ont pas été trouvés automatiquement.')
    console.log('   Vérifiez que vos produits Stripe sont bien nommés, par exemple :')
    console.log('     "Coran 1 élève"      "Coran 2 élèves"')
    console.log('     "Arabe Religion 1"   "Arabe Religion 2"')
    console.log('     "Arabe Adultes 1"    "Arabe Adultes 2"')
    console.log('   Ou modifiez le tableau RULES en haut de ce script.\n')
  }
}

main().catch(err => {
  console.error('\n❌  Erreur Stripe :', err.message)
  if (err.type === 'StripeAuthenticationError') {
    console.error('   → Vérifiez que votre clé API est correcte (sk_live_... ou sk_test_...).')
  }
  process.exit(1)
})
