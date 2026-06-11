'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

// ─── Tarifs ────────────────────────────────────────────────────────────────
// Tarif annuel de base par élève : 276 €
// Remises famille :
//   1er élève  : plein tarif (276 €)
//   2e élève   : -10 %  → 248,40 €
//   3e élève+  : -50 %  → 138 €
// Le tarif s'applique identiquement aux 3 formules.

const BASE = 276        // tarif annuel par élève
const P2   = BASE * 0.90  // 2e élève -10%
const P3   = BASE * 0.50  // 3e élève+ -50%

function calcTotal(n: number): number {
  if (n === 1) return BASE
  if (n === 2) return BASE + P2
  return BASE + P2 + P3 * (n - 2)
}

function calcSansRemise(n: number): number {
  return BASE * n
}

// Paiement en 4 fois = total / 4
function calcFois4(n: number): number {
  return Math.round((calcTotal(n) / 4) * 100) / 100
}

// Économie réalisée
function calcEconomie(n: number): number {
  return Math.round((calcSansRemise(n) - calcTotal(n)) * 100) / 100
}

// ─── Icônes SVG inline ───────────────────────────────────────────────────
const IconUser = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const IconCalc = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <line x1="8" y1="10" x2="8" y2="10" /><line x1="12" y1="10" x2="12" y2="10" /><line x1="16" y1="10" x2="16" y2="10" />
    <line x1="8" y1="14" x2="8" y2="14" /><line x1="12" y1="14" x2="12" y2="14" /><line x1="16" y1="14" x2="16" y2="14" />
    <line x1="8" y1="18" x2="12" y2="18" />
  </svg>
)

const IconCheck = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const IconShield = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const FORMULES = [
  { id: 'coran',                titre: 'Coran',                    sous: 'Enfants & Adultes', emoji: 'book', desc: 'Mémorisation du Coran, tajwîd et suivi régulier en petits groupes.', couleur: '#C4365A', bg: 'rgba(196,54,90,0.10)' },
  { id: 'arabe-religion',       titre: 'Arabe et Religion',        sous: 'Enfants',           emoji: 'arch', desc: 'Arabe fondamental, compréhension religieuse et bases solides dès le plus jeune âge.', couleur: '#3A8C62', bg: 'rgba(58,140,98,0.10)' },
  { id: 'arabe-adultes',        titre: 'Lecture Arabe',            sous: 'Adultes débutants', emoji: 'pen',  desc: 'Lecture, écriture et bases de la langue arabe — accompagnement adapté aux adultes.', couleur: '#8B6020', bg: 'rgba(139,96,32,0.10)' },
  { id: 'sciences-islamiques',  titre: 'Sciences Islamiques',      sous: 'Adultes · Mixte',   emoji: 'book', desc: 'Cours de sciences islamiques pour adultes, hommes et femmes. Approfondissement des fondements de la religion.', couleur: '#B89B6A', bg: 'rgba(184,155,106,0.10)' },
  { id: 'arabe-comprehension',  titre: 'Arabe et Compréhension',          sous: 'Adultes · Mixte',   emoji: 'pen',  desc: "Cours d'arabe pour adultes : apprendre la langue arabe en profondeur, la comprendre et la parler.", couleur: '#8B6020', bg: 'rgba(139,96,32,0.10)' },
]

const CLASSES_MENU = [
  { id: 'coran',               full: 'Classes Coran',                 sub: 'Enfants & Adultes' },
  { id: 'al-itqan',            full: 'Classe Arabe et Religion',      sub: 'Enfants'           },
  { id: 'arabe',               full: 'Classes Arabe',                 sub: 'Adultes'           },
  { id: 'sciences-islamiques', full: 'Classe Sciences Islamiques',    sub: 'Adultes · Mixte'   },
  { id: 'arabe-comprehension', full: 'Classe Arabe et Compréhension', sub: 'Adultes · Mixte'   },
]

const NB_ELEVES = [1, 2, 3, 4, 5]
const MODES = [
  { id: 'comptant', label: 'Paiement comptant',  desc: 'Paiement mensuel standard' },
  { id: 'fois4',    label: 'Paiement en 4 fois', desc: 'Tarif par versement × 4'    },
]

// ─── Liens Stripe — 30 combinaisons ─────────────────────────────────────────
// Structure : STRIPE_LINKS[formule][nbEleves][mode]
const STRIPE_LINKS: Record<string, Record<number, { comptant: string; fois4: string }>> = {
  coran: {
    1: { comptant: 'https://buy.stripe.com/00w3cv4Scekc5J4bMK3sI05', fois4: 'https://buy.stripe.com/bJe3cv98s2Bu7Rc1863sI06' },
    2: { comptant: 'https://buy.stripe.com/28EaEX2K42BuefA2ca3sI07', fois4: 'https://buy.stripe.com/28E3cv3O8gsk4F0eYW3sI08' },
    3: { comptant: 'https://buy.stripe.com/14A7sL5Wga3WdbwcQO3sI09', fois4: 'https://buy.stripe.com/6oUfZh1G06RKefAcQO3sI0a' },
    4: { comptant: 'https://buy.stripe.com/3cI4gzacw8ZSdbw1863sI0b', fois4: 'https://buy.stripe.com/00wcN55Wgdg8gnI1863sI0c' },
    5: { comptant: 'https://buy.stripe.com/bJe00j2K48ZS0oKdUS3sI0d', fois4: 'https://buy.stripe.com/14AcN5gAU8ZS6N83ge3sI0e' },
  },
  'arabe-religion': {
    1: { comptant: 'https://buy.stripe.com/7sY5kDfwQ5NG3AWbMK3sI0f', fois4: 'https://buy.stripe.com/6oUcN50BW6RKb3o2ca3sI0g' },
    2: { comptant: 'https://buy.stripe.com/5kQ8wPdoI8ZS2wS6sq3sI0h', fois4: 'https://buy.stripe.com/bJe7sL1G06RKgnI9EC3sI0i' },
    3: { comptant: 'https://buy.stripe.com/bJe28r84o2Bu1sOg303sI0j', fois4: 'https://buy.stripe.com/14A8wP3O81xq6N87wu3sI0k' },
    4: { comptant: 'https://buy.stripe.com/3cI7sLgAU1xq0oK5om3sI0l', fois4: 'https://buy.stripe.com/4gMdR9ckE2Bub3o3ge3sI0m' },
    5: { comptant: 'https://buy.stripe.com/aFa9ATacw5NGb3og303sI0n', fois4: 'https://buy.stripe.com/eVq9AT70kgskefAaIG3sI0o' },
  },
  'arabe-adultes': {
    1: { comptant: 'https://buy.stripe.com/5kQ6oH5Wg6RK0oKaIG3sI0p', fois4: 'https://buy.stripe.com/28E9AT1G05NG1sO0423sI0q' },
    2: { comptant: 'https://buy.stripe.com/5kQaEX70kcc48VgeYW3sI0r', fois4: 'https://buy.stripe.com/fZudR9esM0tmb3obMK3sI0s' },
    3: { comptant: 'https://buy.stripe.com/14AfZhckE3Fy8Vg8Ay3sI0t', fois4: 'https://buy.stripe.com/28E14n2K44JC9Zk4ki3sI0u' },
    4: { comptant: 'https://buy.stripe.com/cNicN5acwdg8c7s0423sI0v', fois4: 'https://buy.stripe.com/8x2cN5esMcc4b3o0423sI0w' },
    5: { comptant: 'https://buy.stripe.com/9B64gzesMb80dbw0423sI0x', fois4: 'https://buy.stripe.com/dRm8wP4Scb809Zk4ki3sI0y' },
  },
  'sciences-islamiques': {
    1: { comptant: 'https://buy.stripe.com/eVq3cvbgA5NG3AW1863sI0z', fois4: 'https://buy.stripe.com/14A9AT98s6RK9Zk4ki3sI0A' },
    2: { comptant: 'https://buy.stripe.com/eVq3cvbgA5NG3AW1863sI0z', fois4: 'https://buy.stripe.com/14A9AT98s6RK9Zk4ki3sI0A' },
    3: { comptant: 'https://buy.stripe.com/eVq3cvbgA5NG3AW1863sI0z', fois4: 'https://buy.stripe.com/14A9AT98s6RK9Zk4ki3sI0A' },
    4: { comptant: 'https://buy.stripe.com/eVq3cvbgA5NG3AW1863sI0z', fois4: 'https://buy.stripe.com/14A9AT98s6RK9Zk4ki3sI0A' },
    5: { comptant: 'https://buy.stripe.com/eVq3cvbgA5NG3AW1863sI0z', fois4: 'https://buy.stripe.com/14A9AT98s6RK9Zk4ki3sI0A' },
  },
  'arabe-comprehension': {
    1: { comptant: 'https://buy.stripe.com/dRmfZhckE2Bub3o8Ay3sI0B', fois4: 'https://buy.stripe.com/6oUcN54Sca3W0oKg303sI0C' },
    2: { comptant: 'https://buy.stripe.com/dRmfZhckE2Bub3o8Ay3sI0B', fois4: 'https://buy.stripe.com/6oUcN54Sca3W0oKg303sI0C' },
    3: { comptant: 'https://buy.stripe.com/dRmfZhckE2Bub3o8Ay3sI0B', fois4: 'https://buy.stripe.com/6oUcN54Sca3W0oKg303sI0C' },
    4: { comptant: 'https://buy.stripe.com/dRmfZhckE2Bub3o8Ay3sI0B', fois4: 'https://buy.stripe.com/6oUcN54Sca3W0oKg303sI0C' },
    5: { comptant: 'https://buy.stripe.com/dRmfZhckE2Bub3o8Ay3sI0B', fois4: 'https://buy.stripe.com/6oUcN54Sca3W0oKg303sI0C' },
  },
}

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'

// Classes sans sélection du nombre d'élèves (lien Stripe unique, choix sur Stripe)
const FLAT_PRICE_CLASSES = ['sciences-islamiques', 'arabe-comprehension']

export default function InscriptionClient({ userEmail }: { userEmail: string }) {
  const router   = useRouter()
  const supabase = createClient()

  // ── État navbar ────────────────────────────────────────────────────────
  // ── État formulaire ────────────────────────────────────────────────────
  const [formule,  setFormule]  = useState<string | null>(null)
  const [nbEleves, setNbEleves] = useState(1)
  const [mode,     setMode]     = useState<'comptant' | 'fois4'>('comptant')
  const [paying,   setPaying]   = useState(false)
  const [payError, setPayError] = useState('')
  const [step,     setStep]     = useState<1 | 2 | 3>(1)

  const totalAnnuel  = calcTotal(nbEleves)
  const sansRemise   = calcSansRemise(nbEleves)
  const economie     = calcEconomie(nbEleves)
  const montant     = mode === "fois4" ? calcFois4(nbEleves) : totalAnnuel
  const formuleDef  = FORMULES.find(f => f.id === formule)
  const hasRemise    = nbEleves > 1
  const canNext1    = !!formule
  const canPay      = !!formule

  // ── Styles nav (identiques à ParentDashboard) ──────────────────────────
  const navItemStyle = (active: boolean) => ({
    background:   active ? 'rgba(139,96,32,0.12)' : 'transparent',
    color:        active ? '#6B4810'              : 'rgba(245,231,211,0.65)',
  })

  return (
    <div className="min-h-screen">

      {/* ══════════ HEADER — identique à ParentDashboard ══════════ */}
      {/* ══ HEADER ════════════════════════════════════════════════════════ */}
      <Navbar
        userEmail={userEmail}
        activeTab="sinscrire"
      />

            <main className="max-w-3xl mx-auto px-5 py-10">

        <div className="mb-10 animate-fade-up">
          <h1 className="text-[32px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
            Inscription & Paiement
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-3)' }}>
            Choisissez votre formule, le nombre d'élèves et votre mode de paiement.
          </p>
        </div>

        {/* Indicateur d'étapes */}
        <div className="flex items-center gap-3 mb-10 animate-fade-up delay-1">
          {(formule && FLAT_PRICE_CLASSES.includes(formule)
            ? [{ n: 1, label: 'Formule' }, { n: 3, label: 'Paiement' }]
            : [{ n: 1, label: 'Formule' }, { n: 2, label: 'Élèves' }, { n: 3, label: 'Paiement' }]
          ).map((s, i) => (
            <div key={s.n} className="flex items-center gap-3 flex-1">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300"
                  style={{ background: step >= s.n ? 'var(--accent)' : 'var(--bg-elevated)', color: step >= s.n ? '#fff' : 'var(--text-3)' }}>
                  {step > s.n
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    : s.n}
                </div>
                <p className="text-xs font-semibold hidden sm:block"
                  style={{ color: step >= s.n ? 'var(--text-1)' : 'var(--text-3)' }}>{s.label}</p>
              </div>
              {i < (formule && FLAT_PRICE_CLASSES.includes(formule) ? 1 : 2) && <div className="flex-1 h-px transition-all duration-300"
                style={{ background: step > s.n ? 'var(--accent)' : 'var(--border)' }} />}
            </div>
          ))}
        </div>

        {/* ── Étape 1 — Formule ───────────────────────────────────────── */}
        {step === 1 && (
          <div className="animate-fade-up space-y-4">
            <p className="text-base font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
              Quelle formule vous intéresse ?
            </p>

            {FORMULES.map(f => (
              <button key={f.id} onClick={() => setFormule(f.id)}
                className="w-full text-left rounded-2xl overflow-hidden transition-all duration-200 glass glass-hover"
                style={{
                  border: formule === f.id ? `2px solid ${f.couleur}` : '2px solid transparent',
                  boxShadow: formule === f.id ? `0 0 0 4px ${f.couleur}18, 0 8px 32px rgba(0,0,0,0.15)` : undefined,
                }}>
                <div className="p-5 flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: f.bg }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={f.couleur} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[16px]" style={{ color: 'var(--text-1)' }}>{f.titre}</p>
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: f.bg, color: f.couleur }}>{f.sous}</span>
                    </div>
                    <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>{f.desc}</p>
                    <div className="mt-2">
                      <p className="text-lg font-bold leading-none" style={{ color: f.couleur }}>
                        69,00 € <span className="font-bold">× 4</span>
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>276,00 € en une fois</p>
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all"
                    style={{ borderColor: formule === f.id ? f.couleur : 'var(--border)', background: formule === f.id ? f.couleur : 'transparent' }}>
                    {formule === f.id && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              </button>
            ))}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  if (!canNext1) return
                  // Sauter l'étape élèves pour les classes à tarif unique
                  setStep(formule && FLAT_PRICE_CLASSES.includes(formule) ? 3 : 2)
                }}
                disabled={!canNext1}
                className="btn-primary px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-40">
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 2 — Nombre d'élèves ───────────────────────────────── */}
        {step === 2 && (
          <div className="animate-fade-up space-y-6">
            <p className="text-base font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
              Combien d'élèves souhaitez-vous inscrire ?
            </p>

            <div className="grid grid-cols-5 gap-3">
              {NB_ELEVES.map(n => (
                <button key={n} onClick={() => setNbEleves(n)}
                  className="aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200 font-bold text-xl"
                  style={{
                    background: nbEleves === n ? 'var(--accent)' : 'var(--bg-surface)',
                    color:      nbEleves === n ? '#fff'          : 'var(--text-2)',
                    border:     nbEleves === n ? '2px solid var(--accent)' : '2px solid var(--border)',
                    boxShadow:  nbEleves === n ? '0 4px 20px rgba(139,96,32,0.35)' : undefined,
                  }}>
                  {n}
                  <span className="text-[10px] font-medium opacity-75">{n > 1 ? 'élèves' : 'élève'}</span>
                </button>
              ))}
            </div>

            {formule && (
              <div className="glass rounded-2xl overflow-hidden animate-fade-up" style={{ border: '1px solid var(--border)' }}>

                {/* ── En-tête ── */}
                <div className="px-6 pt-5 pb-1 flex items-center gap-3"
                  style={{ borderBottom: '1px solid var(--border-soft)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg"
                    style={{ background: 'var(--accent-soft)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                  </div>
                  <p className="text-xs font-bold uppercase tracking-widest pb-4" style={{ color: 'var(--text-3)' }}>
                    Détail du tarif annuel
                  </p>
                </div>

                {/* ── Lignes élèves ── */}
                <div className="px-6 pt-4 pb-2 space-y-3">
                  {Array.from({ length: nbEleves }).map((_, idx) => {
                    const prixFinal     = idx === 0 ? BASE : idx === 1 ? P2 : P3
                    const hasDiscount   = idx >= 1
                    const discountLabel = idx === 1 ? '-10 %' : '-50 %'
                    const ordinal       = idx === 0 ? '1er élève' : `${idx + 1}e élève`
                    const iconBg        = idx === 0 ? 'rgba(139,96,32,0.10)' : idx === 1 ? 'rgba(52,168,83,0.12)' : 'rgba(217,119,6,0.12)'
                    const iconColor     = idx === 0 ? 'var(--accent)' : idx === 1 ? '#16A34A' : '#B45309'
                    return (
                      <div key={idx} className="flex items-center justify-between py-3 px-4 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid var(--border-soft)' }}>

                        {/* Gauche : label + sous-texte */}
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                            style={{ background: iconBg }}>
                            <IconUser color={iconColor} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--text-1)' }}>
                              {ordinal}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                              {fmt(BASE)} l'année scolaire
                            </p>
                          </div>
                          {hasDiscount && (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full ml-1"
                              style={{ background: '#E74C3C', color: '#fff' }}>
                              {discountLabel}
                            </span>
                          )}
                        </div>

                        {/* Droite : prix barré + prix remisé */}
                        <div className="text-right shrink-0">
                          {hasDiscount ? (
                            <>
                              <p className="text-xs line-through leading-none" style={{ color: 'var(--text-3)' }}>
                                {fmt(BASE)}
                              </p>
                              <p className="text-base font-bold leading-tight mt-0.5" style={{ color: '#DC2626' }}>
                                {fmt(prixFinal)}
                              </p>
                            </>
                          ) : (
                            <p className="text-base font-bold" style={{ color: 'var(--text-1)' }}>
                              {fmt(prixFinal)}
                            </p>
                          )}
                        </div>

                      </div>
                    )
                  })}
                </div>

                {/* ── Bloc total ── */}
                <div className="mx-6 mb-5 mt-3 rounded-xl px-5 py-4"
                  style={{ background: 'rgba(140,90,60,0.07)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between">

                    {/* Gauche : label + icône calculatrice */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                        style={{ background: 'rgba(52,168,83,0.12)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34A853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
                        </svg>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                          Total annuel
                        </p>
                        {nbEleves >= 2 && (
                          <p className="text-[11px] font-semibold mt-0.5" style={{ color: '#16A34A' }}>
                            Remise famille appliquée
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Droite : total sans remise barré + total après remise */}
                    <div className="text-right">
                      {nbEleves >= 2 && (
                        <p className="text-sm line-through mb-1" style={{ color: '#9CA3AF' }}>
                          {fmt(BASE * nbEleves)}
                        </p>
                      )}
                      <p className="font-bold leading-none" style={{ color: nbEleves >= 2 ? '#DC2626' : 'var(--accent)', fontSize: '1.6rem' }}>
                        {fmt(totalAnnuel)}
                      </p>
                    </div>

                  </div>
                </div>

              </div>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="btn-secondary px-6 py-3 rounded-xl text-sm">← Retour</button>
              <button onClick={() => setStep(3)} className="btn-primary px-8 py-3 rounded-xl text-sm font-semibold">Continuer →</button>
            </div>
          </div>
        )}

        {/* ── Étape 3 — Mode de paiement + récap ──────────────────────── */}
        {step === 3 && (
          <div className="animate-fade-up space-y-6">
            <p className="text-base font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
              Choisissez votre mode de paiement
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              {MODES.map(m => {
                const montantMode = m.id === 'fois4' ? calcFois4(nbEleves) : totalAnnuel
                return (
                  <button key={m.id} onClick={() => setMode(m.id as 'comptant' | 'fois4')}
                    className="text-left rounded-2xl p-5 transition-all duration-200 glass glass-hover"
                    style={{
                      border:     mode === m.id ? '2px solid var(--accent)' : '2px solid transparent',
                      boxShadow:  mode === m.id ? '0 0 0 4px rgba(139,96,32,0.12)' : undefined,
                    }}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: mode === m.id ? 'var(--accent-soft)' : 'var(--bg-elevated)' }}>
                        {m.id === 'fois4' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={mode === m.id ? 'var(--accent)' : 'var(--text-3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={mode === m.id ? 'var(--accent)' : 'var(--text-3)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color: 'var(--text-1)' }}>{m.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{m.desc}</p>
                        {montantMode && m.id === 'fois4' && (
                          <div className="mt-2">
                            <p className="text-2xl font-bold leading-none" style={{ color: 'var(--accent)' }}>
                              {fmt(montantMode)} <span className="text-lg font-bold">× 4</span>
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                              {fmt(totalAnnuel)} en une fois
                            </p>
                          </div>
                        )}
                        {montantMode && m.id === 'comptant' && (
                          <div className="mt-2">
                            <p className="text-xl font-bold leading-none" style={{ color: 'var(--accent)' }}>
                              {fmt(montantMode)}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                              ou {fmt(calcFois4(nbEleves))} × 4 versements
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                        style={{ borderColor: mode === m.id ? 'var(--accent)' : 'var(--border)', background: mode === m.id ? 'var(--accent)' : 'transparent' }}>
                        {mode === m.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Explication paiement en 4 fois */}
            {mode === 'fois4' && (
              <div className="rounded-2xl overflow-hidden animate-fade-up"
                style={{ border: '1px solid rgba(52,168,83,0.25)' }}>
                {/* En-tête vert */}
                <div className="px-5 py-3 flex items-center gap-3"
                  style={{ background: 'rgba(52,168,83,0.10)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: '#34A853' }}>
                    <IconCheck color="#fff" />
                  </div>
                  <p className="font-bold text-sm" style={{ color: '#1E6E34' }}>
                    Paiement en 4 fois, simple et sans frais
                  </p>
                </div>
                {/* Corps */}
                <div className="px-5 py-4 space-y-3" style={{ background: 'rgba(52,168,83,0.04)' }}>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    Le premier paiement sera effectué <span className="font-semibold" style={{ color: 'var(--text-1)' }}>aujourd'hui</span>.
                    Les 3 échéances restantes seront prélevées automatiquement au cours des 3 mois suivants,
                    à raison d'un prélèvement par mois.
                  </p>
                  <p className="font-bold text-sm" style={{ color: '#1E6E34' }}>
                    Soit 4 paiements au total.
                  </p>
                  {/* Timeline */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {[
                      { n: '1', sub1: 'Maintenant', sub2: '1er prélèvement', active: true },
                      { n: '2', sub1: 'Dans 1 mois', sub2: '2e prélèvement',  active: false },
                      { n: '3', sub1: 'Dans 2 mois', sub2: '3e prélèvement',  active: false },
                      { n: '4', sub1: 'Dans 3 mois', sub2: '4e prélèvement',  active: false },
                    ].map(item => (
                      <div key={item.n} className="flex flex-col items-center text-center gap-1">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{
                            background: item.active ? '#34A853' : 'rgba(139,96,32,0.10)',
                            color: item.active ? '#fff' : 'var(--text-3)',
                            border: item.active ? 'none' : '1px solid var(--border)',
                          }}>
                          {item.n}
                        </div>
                        <p className="text-[11px] font-semibold leading-tight" style={{ color: item.active ? '#1E6E34' : 'var(--text-2)' }}>
                          {item.sub1}
                        </p>
                        <p className="text-[10px] leading-tight" style={{ color: 'var(--text-3)' }}>
                          {item.sub2}
                        </p>
                      </div>
                    ))}
                  </div>
                  {/* Badge sécurisé */}
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <IconShield color="#1E6E34" />
                    <p className="text-xs font-semibold" style={{ color: '#1E6E34' }}>Paiement 100 % sécurisé</p>
                  </div>
                </div>
              </div>
            )}

            {formule && montant && (
              <div className="glass rounded-2xl overflow-hidden animate-fade-up" style={{ border: '1px solid var(--border)' }}>
                <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--accent) 0%, var(--gold) 100%)' }} />
                <div className="p-6 space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Récapitulatif</p>
                  {/* Infos formule + mode */}
                  {[
                    { label: 'Formule', val: formuleDef?.titre ?? '' },
                    { label: 'Mode',    val: mode === 'comptant' ? 'Paiement comptant' : 'Paiement en 4 fois' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2"
                      style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-2)' }}>{row.label}</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{row.val}</p>
                    </div>
                  ))}

                  {/* Détail par élève */}
                  <div className="space-y-2 py-2" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-3)' }}>
                      Détail par élève
                    </p>
                    {Array.from({ length: nbEleves }).map((_, idx) => {
                      const prixFinal   = idx === 0 ? BASE : idx === 1 ? P2 : P3
                      const hasDiscount = idx >= 1
                      const discLabel   = idx === 1 ? '-10 %' : '-50 %'
                      const ordinal     = idx === 0 ? '1er élève' : `${idx + 1}e élève`
                      return (
                        <div key={idx} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>{ordinal}</p>
                            {hasDiscount && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: '#E74C3C', color: '#fff' }}>{discLabel}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {hasDiscount && (
                              <p className="text-xs line-through" style={{ color: '#9CA3AF' }}>{fmt(BASE)}</p>
                            )}
                            <p className="text-sm font-bold" style={{ color: hasDiscount && nbEleves >= 2 ? '#E74C3C' : 'var(--text-1)' }}>
                              {fmt(prixFinal)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Montant final */}
                  <div className="pt-3 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                      {mode === 'fois4' ? 'Par versement' : 'Total annuel'}
                    </p>
                    <div className="text-right">
                      {mode === 'fois4' ? (
                        <>
                          <p className="font-bold leading-none" style={{ color: nbEleves >= 2 ? '#E74C3C' : 'var(--accent)', fontSize: '1.6rem' }}>
                            {fmt(calcFois4(nbEleves))}{' '}<span style={{ fontSize: '1.2rem' }}>× 4</span>
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                            {fmt(totalAnnuel)} en une fois
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-2xl font-bold leading-none" style={{ color: 'var(--accent)' }}>
                            {fmt(totalAnnuel)}
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                            ou {fmt(calcFois4(nbEleves))} × 4 versements
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2">
              {/* Formulaire natif POST pour le mode 4 fois (anciennes classes)
                  Soumettre un <form> est synchrone → jamais bloqué par Safari iOS
                  /api/checkout reçoit le POST et retourne une redirection 303 vers Stripe */}
              {mode === 'fois4' && formule && !FLAT_PRICE_CLASSES.includes(formule) && (
                <form id="checkout-form-fois4" method="POST" action="/api/checkout"
                  style={{ display: 'none' }} aria-hidden="true">
                  <input type="hidden" name="formule"  value={formule} />
                  <input type="hidden" name="nbEleves" value={String(nbEleves)} />
                  <input type="hidden" name="mode"     value="fois4" />
                </form>
              )}

              <button disabled={!canPay || paying}
                className="btn-primary w-full py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-3 disabled:opacity-40"
                onClick={() => {
                  if (!formule || paying) return
                  setPaying(true)
                  setPayError('')

                  // Flat classes (SI + AC) : redirection directe — synchrone, compatible Safari
                  if (FLAT_PRICE_CLASSES.includes(formule)) {
                    const lien = STRIPE_LINKS[formule]?.[1]?.[mode] ?? null
                    if (lien) { window.location.href = lien; return }
                    setPayError('Lien de paiement introuvable.')
                    setPaying(false)
                    return
                  }

                  // Comptant (autres classes) : Payment Link direct — synchrone
                  if (mode === 'comptant') {
                    const lien = STRIPE_LINKS[formule]?.[nbEleves]?.comptant ?? null
                    if (lien) { window.location.href = lien; return }
                    setPayError('Lien de paiement introuvable.')
                    setPaying(false)
                    return
                  }

                  // 4 fois (autres classes) : soumettre le formulaire natif POST
                  // → /api/checkout → HTTP 303 → Stripe Checkout
                  // Entièrement synchrone, jamais bloqué par Safari iOS
                  const form = document.getElementById('checkout-form-fois4') as HTMLFormElement | null
                  if (form) {
                    form.submit()
                  } else {
                    setPayError('Erreur technique. Rechargez la page.')
                    setPaying(false)
                  }
                }}>
                {paying ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Redirection vers Stripe…
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Procéder au paiement
                  </>
                )}
              </button>
              {payError && (
                <p className="text-sm text-center font-semibold" style={{ color: '#DC2626' }}>
                  {payError}
                </p>
              )}
              <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
                Paiement sécurisé — vous serez redirigé vers Stripe
              </p>
            </div>

            <div className="flex justify-start">
              <button
                onClick={() => setStep(formule && FLAT_PRICE_CLASSES.includes(formule) ? 1 : 2)}
                className="btn-secondary px-6 py-3 rounded-xl text-sm">← Retour</button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
