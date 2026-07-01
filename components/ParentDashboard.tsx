'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

// ─── Types ─────────────────────────────────────────────────────────────────
type Annonce  = { id: string; titre: string; contenu: string; priorite: string; created_at: string }
type Horaire  = { id: string; cours: string; horaire: string; jour: string; niveau: string }
type Document = { id: string; nom: string; storage_path: string; taille: string; created_at: string }
type Groupe   = {
  id: string
  categorie: string
  jour: string
  horaire: string
  ordre: number
  zoom_link: string | null
  devoirs: string | null
}
type GDoc = { id: string; groupe_id: string; nom: string; storage_path: string; taille: string; type_doc: string; created_at: string }

type Props = {
  user:      { email: string }
  annonces:  Annonce[]
  horaires:  Horaire[]
  documents: Document[]
}

// ─── Constantes ────────────────────────────────────────────────────────────
const INSCRIPTION_URL = 'https://forms.gle/22KxDezaptLUqKPE7'

const CLASSES_MENU = [
  { id: 'coran',              label: 'Coran',                  full: 'Coran',                     sub: 'Enfants & Adultes', icon: 'book'   },
  { id: 'al-itqan',           label: 'Arabe et Religion',     full: 'Arabe et Religion',          sub: 'Enfants',           icon: 'arch'   },
  { id: 'arabe',              label: 'Lecture Arabe',         full: 'Lecture Arabe',              sub: 'Adultes',           icon: 'pen'    },
  { id: 'sciences-islamiques',           label: 'Sciences Islamiques',                      full: 'Sciences Islamiques',                     sub: 'Adultes · Mixte',  icon: 'star'   },
  { id: 'arabe-debutant',               label: 'Arabe débutant',                           full: 'Arabe débutant',                          sub: 'Adultes · Mixte',  icon: 'pen'    },
  { id: 'sciences-islamiques-debutant', label: 'Sciences Islamiques et Arabe débutant',    full: 'Sciences Islamiques et Arabe débutant',    sub: 'Adultes · Mixte',  icon: 'star'   },
  { id: 'cours-tajwid',                 label: 'Cours de Tajwid',                          full: 'Cours de Tajwid',                         sub: 'Adultes',          icon: 'book'   },
  { id: 'cours-religion',               label: 'Cours de religion',                        full: 'Cours de religion (Enfants / Ados)',       sub: 'Enfants / Ados',   icon: 'arch'   },
]

// ── Icônes élégantes (trait fin, cohérentes) ───────────────────────────────────
const ClassIcon = ({ type, className = 'w-5 h-5' }: { type: string; className?: string }) => {
  const common = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.6 }
  switch (type) {
    case 'book':   return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5c-1.5-1-4-1.5-7-1.5v13c3 0 5.5.5 7 1.5 1.5-1 4-1.5 7-1.5V5c-3 0-5.5.5-7 1.5Z"/><path strokeLinecap="round" d="M12 6.5v13"/></svg>
    case 'arch':   return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M4 20V11a8 8 0 0 1 16 0v9"/><path strokeLinecap="round" d="M4 20h16M9 20v-5a3 3 0 0 1 6 0v5"/></svg>
    case 'pen':    return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M4 20l4-1 11-11-3-3L5 16l-1 4Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l3 3"/></svg>
    case 'star':   return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.2l5.9-.9L12 3Z"/></svg>
    case 'speech': return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.5 8.5 0 1 1-3.8-7.1"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 4l-9 9-3 1 1-3 9-9Z"/></svg>
    default:       return <svg {...common}><circle cx="12" cy="12" r="9"/></svg>
  }
}

const CAT_COLOR: Record<string, string> = {
  coran:                '#8C5A3C',
  'al-itqan':           '#B89B6A',
  arabe:                '#B89B6A',
  'sciences-islamiques':'#B89B6A',
  'arabe-debutant':                '#B89B6A',
  'sciences-islamiques-debutant':    '#B89B6A',
  'cours-tajwid':       '#B89B6A',
  'cours-religion':     '#B89B6A',
}

const CAT_BG: Record<string, string> = {
  coran:                'rgba(140,90,60,0.08)',
  'al-itqan':           'rgba(184,155,106,0.08)',
  arabe:                'rgba(184,155,106,0.08)',
  'sciences-islamiques':'rgba(184,155,106,0.08)',
  'arabe-debutant':                'rgba(184,155,106,0.08)',
  'sciences-islamiques-debutant':    'rgba(184,155,106,0.08)',
  'cours-tajwid':       'rgba(184,155,106,0.08)',
  'cours-religion':     'rgba(184,155,106,0.08)',
}

const TYPE_ICON: Record<string, string> = {
  devoir: '📝', cours: '📖', rappel: '🔔', document: '📄',
}

const JOURS_ORDRE = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']

// ── Motif géométrique islamique discret (SVG, en arrière-plan) ────────────────
const IslamicPattern = ({ opacity = 0.05 }: { opacity?: number }) => (
  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <pattern id="islamic-star" width="56" height="56" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M28 2 L40 14 L52 2 L52 28 L40 16 L52 28 L40 40 L52 28 M28 2 L16 14 L4 2 L4 28 L16 16 L4 28 L16 40 L4 28 M28 2 L28 28 M28 54 L28 28 M28 54 L16 42 L4 54 L4 28 M28 54 L40 42 L52 54 L52 28" />
          <circle cx="28" cy="28" r="6" />
        </g>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#islamic-star)" style={{ color: '#B89B6A', opacity }} />
  </svg>
)


// ── Photographies — institut islamique premium (Unsplash) ─────────────────────
const PHOTOS = {
  hero:               '/images/hero.jpeg',
  mosque:             'https://images.unsplash.com/photo-1564769662533-4f00a87b4056?q=80&w=1200&auto=format&fit=crop',
  books:              'https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=1200&auto=format&fit=crop',
  writing:            'https://images.unsplash.com/photo-1455390582262-044cdead277a?q=80&w=1200&auto=format&fit=crop',
  manuscript:         'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=1200&auto=format&fit=crop',
  classroom:          'https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=1200&auto=format&fit=crop',
  quran:              'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?q=80&w=1200&auto=format&fit=crop',
  invocation:         '/images/invocation.jpeg',
  sincerite:          '/images/sincerite.jpeg',
  assiduite:          '/images/assiduite.jpeg',
} as const

// ── Image de fond par catégorie de classe ──────────────────────────────────────
// Affiches officielles 16:9 (logo + titre + sous-titre déjà intégrés au design)
const CAT_PHOTO: Record<string, string> = {
  coran:                            '/images/coran.jpeg',
  'al-itqan':                       '/images/arabe-religion.jpeg',
  arabe:                            '/images/lecture-arabe.jpeg',
  'sciences-islamiques':            '/images/sciences-islamiques-2.jpeg',
  'arabe-debutant':                 '/images/arabe-debutant.jpeg',
  'sciences-islamiques-debutant':   '/images/sciences-islamiques.jpeg',
  'cours-tajwid':                   '/images/cours-tajwid.jpeg',
  'cours-religion':                 '/images/cours-religion.jpeg',
}

// Fond derrière l'affiche — ton clair assorti au design des affiches (#F4EBDD/crème)
const CAT_IMG_BG: Record<string, string> = {
  coran:                '#F4EBDD',
  'al-itqan':           '#F4EBDD',
  arabe:                '#F4EBDD',
  'sciences-islamiques':'#F4EBDD',
  'arabe-debutant':                '#F4EBDD',
  'sciences-islamiques-debutant':    '#F4EBDD',
  'cours-tajwid':       '#F4EBDD',
  'cours-religion':     '#F4EBDD',
}

const SectionDivider = () => (
  <div className="flex items-center justify-center gap-3 my-10 select-none" aria-hidden="true">
    <div className="h-px flex-1 max-w-[120px]" style={{ background: 'linear-gradient(to right, transparent, rgba(184,155,106,0.4))' }} />
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: '#B89B6A' }}>
      <path d="M12 2 L15 9 L22 12 L15 15 L12 22 L9 15 L2 12 L9 9 Z" stroke="currentColor" strokeWidth="1.2" fill="rgba(184,155,106,0.12)" />
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.6" />
    </svg>
    <div className="h-px flex-1 max-w-[120px]" style={{ background: 'linear-gradient(to left, transparent, rgba(184,155,106,0.4))' }} />
  </div>
)

// ── Bannière hero — photo institutionnelle plein cadre ──────────────────────────
// ── Bannière hero — affiche officielle, affichée intégralement (sans recadrage) ──
const HeroBanner = () => (
  <div className="relative overflow-hidden rounded-3xl mb-10 animate-fade-up w-full aspect-[16/9] flex items-center justify-center"
    style={{ boxShadow: '0 20px 60px rgba(74,53,32,0.22), 0 4px 16px rgba(74,53,32,0.10)', background: '#F4EBDD' }}>
    <img src={PHOTOS.hero} alt="Et dis : Ô mon Seigneur, accroît mes connaissances — Institut Al-Itqan"
      className="max-w-full max-h-full w-full h-full object-contain" loading="eager" />
  </div>
)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const priorityStyle = (p: string) => {
  if (p === 'haute')   return { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Urgent'    }
  if (p === 'moyenne') return { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  label: 'Important' }
  return                      { color: '#34D399', bg: 'rgba(52,211,153,0.12)',   label: 'Info'      }
}

// ─── Composant ─────────────────────────────────────────────────────────────
export default function ParentDashboard({ user, annonces, horaires, documents }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const searchParams = useSearchParams()
  const [tab,         setTab]         = useState<string>(
    searchParams.get('tab') ?? 'annonces'
  )
  const [classeTab,   setClasseTab]   = useState<string>('coran')
  const [menuOpen,    setMenuOpen]    = useState<boolean>(false)
  const [groupes,     setGroupes]     = useState<Groupe[]>([])
  const [groupeDocs,  setGroupeDocs]  = useState<Record<string, GDoc[]>>({})
  const [openGroupe,  setOpenGroupe]  = useState<string | null>(null)
  const [loadingG,    setLoadingG]    = useState<boolean>(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [docUrls,     setDocUrls]     = useState<Record<string, string>>({})
  const [copied,      setCopied]      = useState<boolean>(false)

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  useEffect(() => {
    if (tab === 'classes' && groupes.length === 0) fetchGroupes()
  }, [tab])

  // ─── Logique (inchangée) ────────────────────────────────────────────────
  const fetchGroupes = async () => {
    setLoadingG(true)
    const { data } = await supabase.from('groupes').select('*').order('ordre')
    if (data) setGroupes(data)
    setLoadingG(false)
  }

  const fetchGroupeDocs = useCallback(async (gid: string) => {
    if (groupeDocs[gid] !== undefined) return
    const { data } = await supabase
      .from('groupe_documents')
      .select('*')
      .eq('groupe_id', gid)
      .order('created_at', { ascending: false })
    setGroupeDocs(prev => ({ ...prev, [gid]: data ?? [] }))
  }, [groupeDocs, supabase])

  const toggleGroupe = async (id: string) => {
    if (openGroupe === id) { setOpenGroupe(null); return }
    setOpenGroupe(id)
    await fetchGroupeDocs(id)
  }

  // Résout l'URL du fichier (3 tentatives) et la stocke dans docUrls.
  // Le JSX rend ensuite un <a href> natif — compatible Safari/Chrome mobile.
  const resolveUrl = async (path: string, bucket: string, id: string, nom?: string): Promise<string | null> => {
    console.log(`[dl] nom:"${nom ?? ''}" bucket:"${bucket}" path:"${path}"`)

    // Tentative 1 — URL signée (chemin exact)
    const { data: d1, error: e1 } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
    if (!e1 && d1?.signedUrl) {
      console.log(`[dl] ✅ URL signée: ${d1.signedUrl}`)
      return d1.signedUrl
    }
    console.warn(`[dl] ⚠️ chemin exact échoué: ${e1?.message}`)

    // Tentative 2 — URL publique
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
    if (publicUrl) {
      const check = await fetch(publicUrl, { method: 'HEAD' }).catch(() => null)
      if (check?.ok) { console.log(`[dl] ✅ URL publique`); return publicUrl }
      console.warn(`[dl] ⚠️ URL publique inaccessible (${check?.status})`)
    }

    // Tentative 3 — nom de fichier seul
    const nomFichier = path.includes('/') ? path.split('/').pop()! : null
    if (nomFichier && nomFichier !== path) {
      const { data: d3, error: e3 } = await supabase.storage.from(bucket).createSignedUrl(nomFichier, 3600)
      if (!e3 && d3?.signedUrl) { console.log(`[dl] ✅ nom seul`); return d3.signedUrl }
      console.warn(`[dl] ⚠️ nom seul échoué: ${e3?.message}`)
    }

    console.error(`[dl] ❌ introuvable — bucket:${bucket} path:${path}`)
    return null
  }

  const handleDownload = async (path: string, bucket: string, id: string, nom?: string) => {
    // Si l'URL est déjà résolue, rien à faire (le <a> s'en charge)
    if (docUrls[id]) return
    setDownloading(id)
    try {
      const url = await resolveUrl(path, bucket, id, nom)
      if (url) {
        setDocUrls(prev => ({ ...prev, [id]: url }))
        // Déclencher le clic sur le <a> après que React a rendu le href
        setTimeout(() => {
          const el = document.getElementById(`dl-link-${id}`) as HTMLAnchorElement | null
          el?.click()
        }, 80)
      } else {
        alert(`Fichier introuvable.\nVérifiez que "${path}" existe dans le bucket "${bucket}".`)
      }
    } finally {
      setDownloading(null)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(INSCRIPTION_URL)
      setCopied(true); setTimeout(() => setCopied(false), 2500)
    } catch { alert('Impossible de copier. Lien : ' + INSCRIPTION_URL) }
  }

  const logout = async () => {
    await supabase.auth.signOut(); router.push('/'); router.refresh()
  }

  const goTo = (t: string) => { setTab(t); setMenuOpen(false) }

  const groupesByCategorie = (cat: string) =>
    groupes.filter(g => g.categorie === cat).sort((a, b) => a.ordre - b.ordre)

  // ─── Rendu ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative">

      {/* Motif géométrique islamique très subtil, fixe en arrière-plan */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ color: '#B89B6A' }}>
        <IslamicPattern opacity={0.025} />
      </div>

      {/* ══ HEADER ════════════════════════════════════════════════════════ */}
      <div className="relative z-[100]">
      <Navbar
        userEmail={user.email}
        activeTab={tab}
        onTabChange={goTo}
        onClasseChange={setClasseTab}
      />
      </div>
      <div className="relative z-10">

            {/* ══ CONTENU ══════════════════════════════════════════════════════════ */}
      <main className="max-w-3xl mx-auto px-5 py-10">

        {/* ── ANNONCES ────────────────────────────────────────────────────── */}
        {tab === 'annonces' && (
          <div className="animate-fade-up">
            <HeroBanner />
            <SectionDivider />

            <div className="mb-8">
              <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                Annonces
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                {annonces.length > 0
                  ? `${annonces.length} annonce${annonces.length > 1 ? 's' : ''}`
                  : 'Aucune annonce'}
              </p>
            </div>

            {annonces.length === 0 && (
              <div className="glass rounded-2xl p-16 text-center">
                <div className="text-5xl mb-4">📭</div>
                <p className="text-base font-medium" style={{ color: 'var(--text-2)' }}>
                  Aucune annonce pour le moment.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {annonces.map((a, i) => {
                const ps = priorityStyle(a.priorite)
                return (
                  <div
                    key={a.id}
                    className={`glass glass-hover rounded-2xl overflow-hidden animate-fade-up delay-${Math.min(i + 1, 5)}`}>
                    <div className="flex items-center gap-5 px-6 py-5">
                      <div className="w-1 h-12 rounded-full shrink-0" style={{ background: ps.color, opacity: 0.8 }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="badge" style={{ background: ps.bg, color: ps.color }}>
                            {ps.label}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                            {fmtDate(a.created_at)}
                          </span>
                        </div>
                        <p className="font-bold text-[15px] leading-snug" style={{ color: 'var(--text-1)' }}>
                          {a.titre}
                        </p>
                        <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>
                          {a.contenu}
                        </p>
                      </div>
                      <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--text-3)' }}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── CALENDRIER ──────────────────────────────────────────────────── */}
        {tab === 'calendrier' && (
          <div className="animate-fade-up">
            <div className="mb-8">
              <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                Calendrier scolaire
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Année 2026-2027</p>
            </div>

            <div className="glass glass-hover rounded-2xl overflow-hidden mb-4 animate-fade-up delay-1">
              <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, var(--accent) 0%, var(--gold) 100%)' }} />
              <div className="p-6 flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                  style={{ background: 'var(--accent-soft)' }}>📅</div>
                <div className="flex-1">
                  <p className="font-bold text-[16px]" style={{ color: 'var(--text-1)' }}>
                    Calendrier des cours 2026-2027
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
                    Dates de cours, vacances et événements
                  </p>
                </div>
              </div>
              <div className="px-6 pb-6 flex gap-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
                <a href="/calendrier-al-itqan-2026-2027.pdf" target="_blank" rel="noopener noreferrer"
                  className="btn-primary flex-1 text-center py-3 px-5 rounded-xl">
                  Ouvrir le calendrier
                </a>
                <a href="/calendrier-al-itqan-2026-2027.pdf" download
                  className="btn-secondary flex items-center gap-2 px-5 py-3 rounded-xl">
                  ↓ Télécharger
                </a>
              </div>
            </div>

            {documents
              .filter(d => d.nom.toLowerCase().includes('calendrier'))
              .map((doc, i) => (
                <div key={doc.id} className={`glass glass-hover rounded-2xl animate-fade-up delay-${i + 2}`}>
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>PDF</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>{doc.nom}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{doc.taille}</p>
                    </div>
                    {docUrls[doc.id] ? (
                      <a id={`dl-link-${doc.id}`}
                        href={docUrls[doc.id]} target="_blank" rel="noopener noreferrer"
                        className="btn-primary text-xs px-4 py-2 rounded-xl text-center inline-block">
                        ↓
                      </a>
                    ) : (
                      <button
                        onClick={() => handleDownload(doc.storage_path, 'documents', doc.id, doc.nom)}
                        disabled={downloading === doc.id}
                        className="btn-primary text-xs px-4 py-2 rounded-xl disabled:opacity-40">
                        {downloading === doc.id ? '…' : '↓'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── RÈGLEMENT ───────────────────────────────────────────────────── */}
        {tab === 'reglement' && (
          <div className="animate-fade-up">
            <div className="mb-8">
              <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                Règlement intérieur
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Année 2026-2027</p>
            </div>

            <div className="glass glass-hover rounded-2xl overflow-hidden mb-4 animate-fade-up delay-1">
              <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, var(--gold) 0%, var(--accent) 100%)' }} />
              <div className="p-6 flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                  style={{ background: 'var(--gold-soft)' }}>📋</div>
                <div className="flex-1">
                  <p className="font-bold text-[16px]" style={{ color: 'var(--text-1)' }}>
                    Règlement intérieur 2026-2027
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-2)' }}>
                    Cadre de vie et engagement commun
                  </p>
                </div>
              </div>
              <div className="px-6 pb-6 flex gap-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
                <a href="/reglement-interieur.pdf" target="_blank" rel="noopener noreferrer"
                  className="btn-primary flex-1 text-center py-3 px-5 rounded-xl">
                  Ouvrir le règlement
                </a>
                <a href="/reglement-interieur.pdf" download
                  className="btn-secondary flex items-center gap-2 px-5 py-3 rounded-xl">
                  ↓ Télécharger
                </a>
              </div>
            </div>

            {documents
              .filter(d => d.nom.toLowerCase().includes('règlement') || d.nom.toLowerCase().includes('reglement'))
              .map((doc, i) => (
                <div key={doc.id} className={`glass glass-hover rounded-2xl animate-fade-up delay-${i + 2}`}>
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ background: 'var(--gold-soft)', color: '#C9A96E' }}>PDF</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>{doc.nom}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{doc.taille}</p>
                    </div>
                    {docUrls[doc.id] ? (
                      <a id={`dl-link-${doc.id}`}
                        href={docUrls[doc.id]} target="_blank" rel="noopener noreferrer"
                        className="btn-primary text-xs px-4 py-2 rounded-xl text-center inline-block">
                        ↓
                      </a>
                    ) : (
                      <button
                        onClick={() => handleDownload(doc.storage_path, 'documents', doc.id, doc.nom)}
                        disabled={downloading === doc.id}
                        className="btn-primary text-xs px-4 py-2 rounded-xl disabled:opacity-40">
                        {downloading === doc.id ? '…' : '↓'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── INSCRIPTION ─────────────────────────────────────────────────── */}
        {tab === 'invitation' && (
          <div className="animate-fade-up">
            <div className="mb-8">
              <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                Inviter un proche
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Partagez le lien d'inscription à une personne intéressée</p>
            </div>

            <div className="glass rounded-2xl overflow-hidden animate-fade-up delay-1">
              <div className="h-2" style={{ background: 'var(--gold-soft)' }} />

              <div className="p-8 flex flex-col items-center text-center gap-6">
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl animate-pulse-glow"
                  style={{ background: 'var(--accent-soft)' }}>✍️</div>

                <div>
                  <p className="text-[22px] font-bold tracking-tight" style={{ color: '#6B4523' }}>
                    Envoie ce lien à un(e) ami(e) et sois la cause d'un grand bien.
                  </p>
                  <p className="text-sm mt-3 max-w-md leading-relaxed mx-auto" style={{ color: 'var(--text-2)' }}>
                    Le Prophète ﷺ a dit :<br />
                    « Celui qui guide vers un bien obtient la même récompense que celui qui l'accomplit. »<br />
                    (Sahih Muslim)
                  </p>
                </div>

                <div className="w-full max-w-sm space-y-3">
                  <button
                    onClick={copyLink}
                    className="btn-primary w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl text-sm"
                    style={{ background: copied ? '#8C6E44' : undefined }}>
                    {copied ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        Lien copié !
                      </>
                    ) : (
                      <>
                        <span className="text-base">⧉</span>
                        Copier le lien d'inscription
                      </>
                    )}
                  </button>
                  <a
                    href={INSCRIPTION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary block w-full text-center py-3.5 px-6 rounded-xl text-sm">
                    Accéder au formulaire →
                  </a>
                </div>

                <p className="text-[11px] break-all" style={{ color: 'var(--text-3)' }}>{INSCRIPTION_URL}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── CLASSES ─────────────────────────────────────────────────────── */}
        {tab === 'classes' && (
          <div className="animate-fade-up">

            {/* Sélecteur catégorie */}
            <div className="flex flex-wrap gap-2 pb-1 mb-7">
              {CLASSES_MENU.map(cl => (
                <button
                  key={cl.id}
                  onClick={() => setClasseTab(cl.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={classeTab === cl.id
                    ? { background: '#B89B6A', color: '#FFFFFF', boxShadow: '0 4px 16px rgba(184,155,106,0.40)', border: '2px solid transparent' }
                    : { background: '#F7F3EC', color: '#5C4033', border: '2px solid rgba(184,155,106,0.25)' }
                  }>
                  <ClassIcon type={cl.icon} className="w-4 h-4 shrink-0" />
                  {cl.label}
                </button>
              ))}
            </div>

            {/* Affiche officielle de la catégorie active — remplit toute la bannière */}
            {CLASSES_MENU.filter(cl => cl.id === classeTab).map(cl => (
              <div key={cl.id} className="relative overflow-hidden rounded-2xl mb-7 animate-fade-up w-full aspect-[16/9]"
                style={{ boxShadow: '0 8px 28px rgba(140,90,60,0.10), 0 1px 3px rgba(140,90,60,0.06)' }}>
                <img src={CAT_PHOTO[cl.id]} alt={cl.full}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy" />
              </div>
            ))}

            {loadingG && (
              <div className="glass rounded-2xl p-12 text-center">
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>Chargement des groupes…</p>
              </div>
            )}

            {!loadingG && groupesByCategorie(classeTab).length === 0 && (
              <div className="glass rounded-2xl p-12 text-center">
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>Aucun groupe disponible pour l'instant.</p>
              </div>
            )}

            {/* Groupes par jour */}
            {JOURS_ORDRE.map(jour => {
              const gs = groupesByCategorie(classeTab).filter(g => g.jour === jour)
              if (!gs.length) return null
              return (
                <div key={jour} className="mb-7">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-1.5 h-4 rounded-full" style={{ background: '#B89B6A' }} />
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#8C6E44' }}>
                      {jour}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {gs.map((g, i) => (
                      <div
                        key={g.id}
                        className={`glass glass-hover rounded-2xl overflow-hidden animate-fade-up delay-${Math.min(i + 1, 5)}`}>

                        {/* ── Bouton accordéon ── */}
                        <button
                          onClick={() => toggleGroupe(g.id)}
                          className="w-full p-5 flex items-center gap-4 text-left">
                          {/* Icône horaire */}
                          <div
                            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                            style={{ background: 'linear-gradient(135deg, #B89B6A 0%, #9A7D52 100%)' }}>
                            {g.horaire.split('–')[0]?.trim() ?? '—'}
                          </div>

                          {/* Infos groupe */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>
                              Groupe {g.horaire}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{g.jour}</p>

                            {/* Lien Zoom */}
                            {g.zoom_link && (
                              <a
                                href={g.zoom_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary inline-flex items-center justify-center px-4 py-2 mt-3 rounded-xl text-sm"
                                onClick={e => e.stopPropagation()}>
                                Rejoindre le cours Zoom
                              </a>
                            )}

                            {/* Devoirs */}
                            {g.devoirs && (
                              <div
                                className="mt-4 rounded-2xl p-4"
                                style={{ background: '#F8E7D8', border: '1px solid #EBCFB5' }}>
                                <p className="font-semibold text-sm" style={{ color: '#7A3419' }}>
                                  📚 Devoirs
                                </p>
                                <p className="mt-2 text-sm leading-relaxed" style={{ color: '#5B4636' }}>
                                  {g.devoirs}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Badge docs + chevron */}
                          <div className="flex items-center gap-2 shrink-0">
                            {groupeDocs[g.id]?.length > 0 && (
                              <span
                                className="badge"
                                style={{ background: 'rgba(184,155,106,0.14)', color: '#8C6E44' }}>
                                {groupeDocs[g.id].length} doc{groupeDocs[g.id].length > 1 ? 's' : ''}
                              </span>
                            )}
                            <svg
                              className="w-4 h-4 transition-transform duration-200"
                              style={{
                                color: 'var(--text-3)',
                                transform: openGroupe === g.id ? 'rotate(180deg)' : 'none',
                              }}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </button>

                        {/* ── Documents du groupe ── */}
                        {openGroupe === g.id && (
                          <div
                            className="px-5 pb-5 space-y-2.5 animate-fade-up"
                            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>

                            {groupeDocs[g.id] === undefined && (
                              <p className="text-xs text-center py-4" style={{ color: 'var(--text-3)' }}>
                                Chargement…
                              </p>
                            )}

                            {groupeDocs[g.id]?.length === 0 && (
                              <p className="text-xs text-center py-4" style={{ color: 'var(--text-3)' }}>
                                Aucun document pour ce groupe.
                              </p>
                            )}

                            {(groupeDocs[g.id] ?? []).map(gd => (
                              <div
                                key={gd.id}
                                className="flex items-center gap-4 p-4 rounded-xl transition-all duration-150"
                                style={{ background: '#F7F3EC' }}>
                                <span className="text-xl shrink-0">{TYPE_ICON[gd.type_doc] ?? '📄'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                                    {gd.nom}
                                  </p>
                                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                                    {gd.taille} · {fmtDate(gd.created_at)}
                                  </p>
                                </div>
                                {docUrls[gd.id] ? (
                                  <a id={`dl-link-${gd.id}`}
                                    href={docUrls[gd.id]} target="_blank" rel="noopener noreferrer"
                                    className="btn-primary text-xs px-4 py-2 rounded-xl text-center inline-block"
                                    style={{ background: '#B89B6A', color: '#FFFFFF' }}>
                                    ↓
                                  </a>
                                ) : (
                                  <button
                                    onClick={() => handleDownload(gd.storage_path, 'groupe-docs', gd.id, gd.nom)}
                                    disabled={downloading === gd.id}
                                    className="btn-primary text-xs px-4 py-2 rounded-xl disabled:opacity-40"
                                    style={{ background: '#B89B6A', color: '#FFFFFF' }}>
                                    {downloading === gd.id ? '…' : '↓'}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

          </div>
        )}

      </main>
      </div>
    </div>
  )
}
