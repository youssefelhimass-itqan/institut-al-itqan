'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Navbar from '@/components/Navbar'

// ─── Types ─────────────────────────────────────────────────────────────────
type Annonce = { id: string; titre: string; contenu: string; priorite: string; created_at: string }
type Horaire = { id: string; cours: string; horaire: string; jour: string; niveau: string }

// groupes : colonnes publiques uniquement — zoom_link/devoirs absents du select
// Même si la colonne existe encore en DB (avant Phase C), on ne la lit JAMAIS ici.
type GroupeVue = {
  id:        string
  categorie: string
  jour:      string
  horaire:   string
  ordre:     number
}

// groupe_acces : données sensibles protégées par RLS
// RLS Supabase : accès global actif ET classe attribuée (ou administrateur).
type GroupeAcces = {
  groupe_id: string
  zoom_link: string | null
  devoirs:   string | null
}

type GDoc = {
  id:           string
  groupe_id:    string
  nom:          string
  storage_path: string
  taille:       string
  type_doc:     string
  created_at:   string
}

type Props = {
  user:       { id: string; email: string }
  annonces:   Annonce[]
  horaires:   Horaire[]
  accesCours: boolean   // calculé côté serveur, fail-secure
}

// ─── Constantes ────────────────────────────────────────────────────────────
const INSCRIPTION_URL = 'https://forms.gle/22KxDezaptLUqKPE7'

const CLASSES_MENU = [
  { id: 'coran',               label: 'Coran',               icon: 'book' },
  { id: 'al-itqan',            label: 'Arabe et Religion',   icon: 'arch' },
  { id: 'sciences-islamiques', label: 'Sciences Islamiques', icon: 'star' },
  { id: 'cours-tajwid',        label: 'Cours de Tajwid',     icon: 'book' },
  { id: 'cours-religion',      label: 'Cours de religion',   icon: 'arch' },
]

const TYPE_ICON: Record<string, string> = {
  devoir: '📝', cours: '📖', rappel: '🔔', document: '📄', audio: '🎧',
}

const JOURS_ORDRE = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']

const CAT_PHOTO: Record<string, string> = {
  coran:                '/images/coran.jpeg',
  'al-itqan':           '/images/arabe-religion.jpeg',
  arabe:               '/images/arabe-debutant.jpeg',
  'sciences-islamiques':'/images/sciences-islamiques-2.jpeg',
  'cours-tajwid':       '/images/cours-tajwid.jpeg',
  'cours-religion':     '/images/cours-religion.jpeg',
}

// ─── Composants UI ─────────────────────────────────────────────────────────
const ClassIcon = ({ type, className = 'w-5 h-5' }: { type: string; className?: string }) => {
  const c = { className, fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 1.6 }
  switch (type) {
    case 'book': return <svg {...c}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5c-1.5-1-4-1.5-7-1.5v13c3 0 5.5.5 7 1.5 1.5-1 4-1.5 7-1.5V5c-3 0-5.5.5-7 1.5Z"/><path strokeLinecap="round" d="M12 6.5v13"/></svg>
    case 'arch': return <svg {...c}><path strokeLinecap="round" strokeLinejoin="round" d="M4 20V11a8 8 0 0 1 16 0v9"/><path strokeLinecap="round" d="M4 20h16M9 20v-5a3 3 0 0 1 6 0v5"/></svg>
    case 'star': return <svg {...c}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.2l5.9-.9L12 3Z"/></svg>
    default:     return <svg {...c}><circle cx="12" cy="12" r="9"/></svg>
  }
}

const IslamicPattern = () => (
  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <pattern id="islamic-star" width="56" height="56" patternUnits="userSpaceOnUse">
        <g fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M28 2 L40 14 L52 2 L52 28 L40 16 L52 28 L40 40 L52 28 M28 2 L16 14 L4 2 L4 28 L16 16 L4 28 L16 40 L4 28 M28 2 L28 28 M28 54 L28 28 M28 54 L16 42 L4 54 L4 28 M28 54 L40 42 L52 54 L52 28"/>
          <circle cx="28" cy="28" r="6"/>
        </g>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#islamic-star)" style={{ color: '#B89B6A', opacity: 0.025 }}/>
  </svg>
)

const SectionDivider = () => (
  <div className="flex items-center justify-center gap-3 my-10 select-none" aria-hidden="true">
    <div className="h-px flex-1 max-w-[120px]" style={{ background: 'linear-gradient(to right, transparent, rgba(184,155,106,0.4))' }}/>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: '#B89B6A' }}>
      <path d="M12 2 L15 9 L22 12 L15 15 L12 22 L9 15 L2 12 L9 9 Z" stroke="currentColor" strokeWidth="1.2" fill="rgba(184,155,106,0.12)"/>
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.6"/>
    </svg>
    <div className="h-px flex-1 max-w-[120px]" style={{ background: 'linear-gradient(to left, transparent, rgba(184,155,106,0.4))' }}/>
  </div>
)

const HeroBanner = () => (
  <div className="relative overflow-hidden rounded-3xl mb-10 animate-fade-up w-full aspect-[16/9] flex items-center justify-center"
    style={{ boxShadow: '0 20px 60px rgba(74,53,32,0.22), 0 4px 16px rgba(74,53,32,0.10)', background: '#F4EBDD' }}>
    <img src="/images/hero.jpeg" alt="Institut Al-Itqan"
      className="max-w-full max-h-full w-full h-full object-contain" loading="eager"/>
  </div>
)

const BanniereAccesBloque = () => (
  <div className="rounded-2xl p-5 flex items-start gap-4"
    style={{
      background: 'linear-gradient(135deg, rgba(184,155,106,0.12) 0%, rgba(140,90,60,0.08) 100%)',
      border: '1.5px solid rgba(184,155,106,0.35)',
    }}>
    <span className="text-2xl shrink-0 mt-0.5">🔒</span>
    <div>
      <p className="font-semibold text-sm" style={{ color: '#6B4523' }}>
        Accès en attente d'activation
      </p>
      <p className="text-sm mt-1 leading-relaxed" style={{ color: '#8C6E44' }}>
        Votre accès aux cours sera activé après validation de votre inscription et de votre paiement.
      </p>
    </div>
  </div>
)

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

// ─── Illustration ablutions ────────────────────────────────────────────────
const IllustrationAblutions = ({ variant = 1 }: { variant?: 1 | 2 }) => {
  const bg1    = variant === 1 ? '#EBF4FD' : '#EDFAF3'
  const bg2    = variant === 1 ? '#C6E2F8' : '#B8EDD4'
  const accent = variant === 1 ? '#4FA8D6' : '#34B87A'
  const accent2 = variant === 1 ? '#2680B5' : '#1D8C5A'
  return (
    <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id={`bg-${variant}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={bg2}/>
          <stop offset="100%" stopColor={bg1}/>
        </radialGradient>
        <linearGradient id={`water-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.9"/>
          <stop offset="100%" stopColor={accent2} stopOpacity="0.6"/>
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill={`url(#bg-${variant})`}/>
      <ellipse cx="60" cy="90" rx="30" ry="8" fill={accent} opacity="0.18"/>
      <rect x="45" y="80" width="30" height="12" rx="4" fill={accent} opacity="0.35"/>
      <rect x="55" y="60" width="10" height="22" rx="3" fill={accent2} opacity="0.5"/>
      <ellipse cx="60" cy="62" rx="22" ry="8" fill={accent} opacity="0.3"/>
      <ellipse cx="48" cy="50" rx="3" ry="4.5" fill={`url(#water-${variant})`}/>
      <ellipse cx="60" cy="45" rx="3" ry="4.5" fill={`url(#water-${variant})`}/>
      <ellipse cx="72" cy="50" rx="3" ry="4.5" fill={`url(#water-${variant})`}/>
      <ellipse cx="54" cy="38" rx="2" ry="3" fill={accent} opacity="0.5"/>
      <ellipse cx="66" cy="38" rx="2" ry="3" fill={accent} opacity="0.5"/>
      <ellipse cx="44" cy="68" rx="10" ry="6" fill="#F5CBA7" transform="rotate(-20 44 68)"/>
      <ellipse cx="76" cy="68" rx="10" ry="6" fill="#F5CBA7" transform="rotate(20 76 68)"/>
      {variant === 1
        ? <><circle cx="22" cy="28" r="2" fill={accent} opacity="0.5"/><circle cx="98" cy="35" r="1.5" fill={accent} opacity="0.4"/><circle cx="30" cy="88" r="1.5" fill={accent} opacity="0.3"/></>
        : <><circle cx="20" cy="40" r="2" fill={accent} opacity="0.5"/><circle cx="100" cy="30" r="1.5" fill={accent} opacity="0.4"/><circle cx="92" cy="85" r="1.5" fill={accent} opacity="0.3"/></>
      }
    </svg>
  )
}

// ─── Carte audio ───────────────────────────────────────────────────────────
const CarteAudio = ({
  gd,
  audioUrl,
  onLoad,
  loading,
}: {
  gd: GDoc
  audioUrl: string | null
  onLoad: () => void
  loading: boolean
}) => {
  const isPartie2   = gd.nom.includes('2') || gd.nom.toLowerCase().includes('partie 2')
  const variant     = isPartie2 ? 2 : 1
  const color       = variant === 1 ? '#4FA8D6' : '#34B87A'
  const colorBg     = variant === 1 ? 'rgba(79,168,214,0.10)' : 'rgba(52,184,122,0.10)'
  const colorBorder = variant === 1 ? 'rgba(79,168,214,0.30)' : 'rgba(52,184,122,0.30)'
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: colorBg, border: `1.5px solid ${colorBorder}` }}>
      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-2xl overflow-hidden" style={{ width: 88, height: 88 }}>
          <IllustrationAblutions variant={variant}/>
        </div>
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full mb-2"
            style={{ background: colorBorder, color }}>
            🎧 Leçon audio
          </span>
          <p className="text-sm font-bold leading-snug" style={{ color: 'var(--text-1)' }}>
            {gd.nom}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
            {gd.taille} · {fmtDate(gd.created_at)}
          </p>
        </div>
      </div>
      {audioUrl ? (
        <audio
          controls
          preload="none"
          className="w-full"
          style={{ accentColor: color, borderRadius: '12px' }}>
          <source src={audioUrl} type="audio/mp4"/>
          Votre navigateur ne supporte pas la lecture audio.
        </audio>
      ) : (
        <button
          onClick={onLoad}
          disabled={loading}
          className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: color,
            color: '#FFFFFF',
            opacity: loading ? 0.6 : 1,
            boxShadow: `0 4px 14px ${colorBorder}`,
          }}>
          {loading
            ? <><span className="animate-spin inline-block">⟳</span> Chargement…</>
            : <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>Écouter</>
          }
        </button>
      )}
    </div>
  )
}

const priorityStyle = (p: string) => {
  if (p === 'haute')   return { color: '#F87171', bg: 'rgba(248,113,113,0.12)', label: 'Urgent'    }
  if (p === 'moyenne') return { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  label: 'Important' }
  return                      { color: '#34D399', bg: 'rgba(52,211,153,0.12)',   label: 'Info'      }
}

// ─── Composant principal ───────────────────────────────────────────────────
export default function ParentDashboard({ user, annonces, horaires, accesCours }: Props) {
  const router   = useRouter()
  const supabase = createClient()

  const searchParams = useSearchParams()
  const [tab,         setTab]        = useState<string>(searchParams.get('tab') ?? 'annonces')
  const [classeTab,   setClasseTab]  = useState<string>('coran')
  const [groupes,     setGroupes]    = useState<GroupeVue[]>([])
  const [groupeAcces, setGroupeAcces]= useState<Record<string, GroupeAcces>>({})
  const [groupeDocs,  setGroupeDocs] = useState<Record<string, GDoc[]>>({})
  const [openGroupe,  setOpenGroupe] = useState<string | null>(null)
  const [loadingG,    setLoadingG]   = useState<boolean>(false)
  const [downloading, setDownloading]= useState<string | null>(null)
  const [docUrls,     setDocUrls]    = useState<Record<string, string>>({})
  const [copied,      setCopied]     = useState<boolean>(false)
  const [audioUrls,    setAudioUrls]   = useState<Record<string, string>>({})
  const [audioLoading, setAudioLoading]= useState<Record<string, boolean>>({})

  useEffect(() => {
    if (tab === 'classes') fetchGroupes()
  }, [tab, accesCours, user.id])

  // La vue et les tables sont filtrées côté PostgreSQL par les attributions.
  const [groupesError, setGroupesError] = useState('')
  const fetchGroupes = async () => {
    setLoadingG(true)
    setGroupes([])
    setGroupeAcces({})
    setGroupeDocs({})
    setDocUrls({})
    setOpenGroupe(null)
    setGroupesError('')
    try {
      if (!accesCours) return
      const { data: attributions, error: attributionError } = await supabase
        .from('classe_attributions').select('groupe_id').eq('profile_id', user.id)
      if (attributionError) throw attributionError
      const ids = (attributions ?? []).map(a => a.groupe_id)
      if (!ids.length) return
      const { data, error } = await supabase.from('groupes_public')
        .select('id,categorie,jour,horaire,ordre').in('id', ids).order('ordre')
      if (error) throw error
      if (!data?.length) return
      const { data: accesData, error: accesError } = await supabase
        .from('groupe_acces').select('groupe_id,zoom_link,devoirs')
        .in('groupe_id', data.map(g => g.id))
      if (accesError) throw accesError
      setGroupes(data)
      setClasseTab(data[0].categorie)
      const map: Record<string, GroupeAcces> = {}
      for (const a of accesData ?? []) map[a.groupe_id] = a
      setGroupeAcces(map)
    } catch {
      setGroupesError('Impossible de charger vos classes. Veuillez réessayer ou contacter l’institut.')
    } finally {
      setLoadingG(false)
    }
  }

  // ── Fetch documents d'un groupe ──────────────────────────────────────
  // Double défense :
  //   1. if (!accesCours) return  → la requête n'est jamais envoyée
  //   2. RLS groupe_documents_parent_select → bloque côté Supabase
  const fetchGroupeDocs = useCallback(async (gid: string) => {
    if (!accesCours || !groupes.some(g => g.id === gid)) return
    if (groupeDocs[gid] !== undefined) return

    const { data, error } = await supabase
      .from('groupe_documents')
      .select('*')
      .eq('groupe_id', gid)
      .order('created_at', { ascending: true })

    if (error) console.error('[groupe_docs] erreur:', error.message)
    setGroupeDocs(prev => ({ ...prev, [gid]: data ?? [] }))
  }, [groupeDocs, groupes, supabase, accesCours])

  const toggleGroupe = async (id: string) => {
    if (openGroupe === id) { setOpenGroupe(null); return }
    setOpenGroupe(id)
    if (accesCours) await fetchGroupeDocs(id)
  }

  // ── Résolution d'URL de téléchargement ──────────────────────────────
  // Triple défense :
  //   1. if (!accesCours) → retourne null, aucune URL émise
  //   2. createSignedUrl → refusée par la RLS Storage si acces_cours=false
  //   3. Bucket privé (Phase C) → les URL /object/public/... ne fonctionnent plus
  const resolveUrl = async (path: string, bucket: string, id: string): Promise<string | null> => {
    if (!accesCours) return null

    // Lien externe (YouTube, etc.)
    if (path.startsWith('http://') || path.startsWith('https://')) return path

    // URL signée — expire après 5 minutes, respecte les politiques Storage RLS
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300)
    if (!error && data?.signedUrl) return data.signedUrl

    console.warn(`[dl] URL signée échouée pour "${path}": ${error?.message}`)

    console.error(`[dl] Fichier introuvable — bucket:${bucket} path:${path}`)
    return null
  }

  const handleDownload = async (path: string, bucket: string, id: string, nom?: string) => {
    if (!accesCours) return
    if (docUrls[id]) return
    setDownloading(id)
    try {
      const url = await resolveUrl(path, bucket, id)
      if (url) {
        setDocUrls(prev => ({ ...prev, [id]: url }))
        // Renouveler le lien après quatre minutes, avant son expiration.
        setTimeout(() => setDocUrls(prev => {
          if (prev[id] !== url) return prev
          const next = { ...prev }; delete next[id]; return next
        }), 240000)
        setTimeout(() => {
          const el = document.getElementById(`dl-link-${id}`) as HTMLAnchorElement | null
          el?.click()
        }, 80)
      } else {
        alert(`Fichier introuvable. Chemin : "${path}" dans le bucket "${bucket}".`)
      }
    } finally {
      setDownloading(null)
    }
  }

  const loadAudioUrl = async (gd: GDoc) => {
    if (!accesCours) return
    if (audioUrls[gd.id]) return
    setAudioLoading(prev => ({ ...prev, [gd.id]: true }))
    try {
      const url = await resolveUrl(gd.storage_path, 'groupe-docs', gd.id)
      if (url) setAudioUrls(prev => ({ ...prev, [gd.id]: url }))
      else console.warn('[audio] URL introuvable pour', gd.nom)
    } finally {
      setAudioLoading(prev => ({ ...prev, [gd.id]: false }))
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(INSCRIPTION_URL)
      setCopied(true); setTimeout(() => setCopied(false), 2500)
    } catch { alert('Impossible de copier. Lien : ' + INSCRIPTION_URL) }
  }

  const goTo = (t: string) => setTab(t)

  const heureEnMinutes = (horaire: string) => {
    const part = horaire.split('–')[0]?.trim() ?? '0h'
    const [h, m] = part.replace('h', ':').split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }

  const classesMenu = Array.from(new Set(groupes.map(g => g.categorie))).map(id =>
    CLASSES_MENU.find(cl => cl.id === id) ?? { id, label: id === 'arabe' ? 'Arabe' : id, icon: 'book' }
  )

  const groupesByCategorie = (cat: string) =>
    groupes
      .filter(g => g.categorie === cat)
      .sort((a, b) => heureEnMinutes(a.horaire) - heureEnMinutes(b.horaire))

  // ─── Rendu ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 pointer-events-none z-0" style={{ color: '#B89B6A' }}>
        <IslamicPattern/>
      </div>

      <Navbar
        userEmail={user.email}
        activeTab={tab}
        onTabChange={goTo}
        onClasseChange={setClasseTab}
      />

      <div className="relative z-10">
        <main className="max-w-3xl mx-auto px-5 py-10">

          {/* ── ANNONCES ──────────────────────────────────────────────── */}
          {tab === 'annonces' && (
            <div className="animate-fade-up">
              <HeroBanner/>
              <SectionDivider/>

              {!accesCours && (
                <div className="mb-6">
                  <BanniereAccesBloque/>
                </div>
              )}

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
                    <div key={a.id}
                      className={`glass glass-hover rounded-2xl overflow-hidden animate-fade-up delay-${Math.min(i + 1, 5)}`}>
                      <div className="flex items-center gap-5 px-6 py-5">
                        <div className="w-1 h-12 rounded-full shrink-0" style={{ background: ps.color, opacity: 0.8 }}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="badge" style={{ background: ps.bg, color: ps.color }}>{ps.label}</span>
                            <span className="text-xs" style={{ color: 'var(--text-3)' }}>{fmtDate(a.created_at)}</span>
                          </div>
                          <p className="font-bold text-[15px] leading-snug" style={{ color: 'var(--text-1)' }}>
                            {a.titre}
                          </p>
                          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'var(--text-2)' }}>
                            {a.contenu}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── CALENDRIER ────────────────────────────────────────────── */}
          {tab === 'calendrier' && (
            <div className="animate-fade-up">
              <div className="mb-8">
                <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                  Calendrier scolaire
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Année 2026-2027</p>
              </div>
              {/* Fichier statique /public/ — accessible à tous, sans authentification */}
              <div className="glass glass-hover rounded-2xl overflow-hidden mb-4 animate-fade-up delay-1">
                <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, var(--accent) 0%, var(--gold) 100%)' }}/>
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
            </div>
          )}

          {/* ── RÈGLEMENT ─────────────────────────────────────────────── */}
          {tab === 'reglement' && (
            <div className="animate-fade-up">
              <div className="mb-8">
                <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                  Règlement intérieur
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Année 2026-2027</p>
              </div>
              {/* Fichier statique /public/ — accessible à tous, sans authentification */}
              <div className="glass glass-hover rounded-2xl overflow-hidden mb-4 animate-fade-up delay-1">
                <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, var(--gold) 0%, var(--accent) 100%)' }}/>
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
            </div>
          )}

          {/* ── INVITATION ────────────────────────────────────────────── */}
          {tab === 'invitation' && (
            <div className="animate-fade-up">
              <div className="mb-8">
                <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                  Inviter un proche
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
                  Partagez le lien d'inscription
                </p>
              </div>
              <div className="glass rounded-2xl overflow-hidden animate-fade-up delay-1">
                <div className="h-2" style={{ background: 'var(--gold-soft)' }}/>
                <div className="p-8 flex flex-col items-center text-center gap-6">
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
                    style={{ background: 'var(--accent-soft)' }}>✍️</div>
                  <div>
                    <p className="text-[22px] font-bold tracking-tight" style={{ color: '#6B4523' }}>
                      Envoie ce lien à un(e) ami(e) et sois la cause d'un grand bien.
                    </p>
                    <p className="text-sm mt-3 max-w-md leading-relaxed mx-auto" style={{ color: 'var(--text-2)' }}>
                      Le Prophète ﷺ a dit :<br/>
                      « Celui qui guide vers un bien obtient la même récompense que celui qui l'accomplit. »<br/>
                      (Sahih Muslim)
                    </p>
                  </div>
                  <div className="w-full max-w-sm space-y-3">
                    <button onClick={copyLink}
                      className="btn-primary w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl text-sm"
                      style={{ background: copied ? '#8C6E44' : undefined }}>
                      {copied
                        ? <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>Lien copié !</>
                        : <><span className="text-base">⧉</span>Copier le lien d'inscription</>
                      }
                    </button>
                    <a href={INSCRIPTION_URL} target="_blank" rel="noopener noreferrer"
                      className="btn-secondary block w-full text-center py-3.5 px-6 rounded-xl text-sm">
                      Accéder au formulaire →
                    </a>
                  </div>
                  <p className="text-[11px] break-all" style={{ color: 'var(--text-3)' }}>{INSCRIPTION_URL}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── CLASSES ───────────────────────────────────────────────── */}
          {tab === 'classes' && (
            <div className="animate-fade-up">

              {!accesCours && <BanniereAccesBloque />}
              {groupesError && <p role="alert">{groupesError} <button onClick={fetchGroupes}>Réessayer</button></p>}
              <div className="flex flex-wrap gap-2 pb-1 mb-7">
                {classesMenu.map(cl => (
                  <button key={cl.id} onClick={() => setClasseTab(cl.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                    style={classeTab === cl.id
                      ? { background: '#B89B6A', color: '#FFFFFF', boxShadow: '0 4px 16px rgba(184,155,106,0.40)', border: '2px solid transparent' }
                      : { background: '#F7F3EC', color: '#5C4033', border: '2px solid rgba(184,155,106,0.25)' }
                    }>
                    <ClassIcon type={cl.icon} className="w-4 h-4 shrink-0"/>
                    {cl.label}
                  </button>
                ))}
              </div>

              {classesMenu.filter(cl => cl.id === classeTab).map(cl => (
                <div key={cl.id} className="relative overflow-hidden rounded-2xl mb-7 w-full aspect-[16/9]"
                  style={{ boxShadow: '0 8px 28px rgba(140,90,60,0.10)' }}>
                  <img src={CAT_PHOTO[cl.id] ?? '/images/hero.jpeg'} alt={cl.label}
                    className="absolute inset-0 w-full h-full object-cover" loading="lazy"/>
                </div>
              ))}

              {loadingG && (
                <div className="glass rounded-2xl p-12 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>Chargement des groupes…</p>
                </div>
              )}

              {!loadingG && !groupesError && accesCours && groupesByCategorie(classeTab).length === 0 && (
                <div className="glass rounded-2xl p-12 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>Aucune classe attribuée. Contactez l’institut si nécessaire.</p>
                </div>
              )}

              {JOURS_ORDRE.map(jour => {
                const gs = groupesByCategorie(classeTab).filter(g => g.jour === jour)
                if (!gs.length) return null
                return (
                  <div key={jour} className="mb-7">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-1.5 h-4 rounded-full" style={{ background: '#B89B6A' }}/>
                      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#8C6E44' }}>
                        {jour}
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      {gs.map((g, i) => (
                        <div key={g.id}
                          className={`glass glass-hover rounded-2xl overflow-hidden animate-fade-up delay-${Math.min(i + 1, 5)}`}>

                          <button onClick={() => toggleGroupe(g.id)}
                            className="w-full p-5 flex items-center gap-4 text-left">

                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-sm shrink-0"
                              style={{ background: 'linear-gradient(135deg, #B89B6A 0%, #9A7D52 100%)' }}>
                              {g.horaire.split('–')[0]?.trim() ?? '—'}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>
                                Groupe {g.horaire}
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{g.jour}</p>

                              {/* Lien Zoom — depuis groupe_acces uniquement, jamais depuis groupes */}
                              {accesCours && groupeAcces[g.id]?.zoom_link && (
                                <a href={groupeAcces[g.id].zoom_link!}
                                  target="_blank" rel="noopener noreferrer"
                                  className="btn-primary inline-flex items-center justify-center px-4 py-2 mt-3 rounded-xl text-sm"
                                  onClick={e => e.stopPropagation()}>
                                  Rejoindre le cours Zoom
                                </a>
                              )}

                              {/* Devoirs — depuis groupe_acces uniquement */}
                              {accesCours && groupeAcces[g.id]?.devoirs && (
                                <div className="mt-4 rounded-2xl p-4"
                                  style={{ background: '#F8E7D8', border: '1px solid #EBCFB5' }}>
                                  <p className="font-semibold text-sm" style={{ color: '#7A3419' }}>📚 Devoirs</p>
                                  <p className="mt-2 text-sm leading-relaxed" style={{ color: '#5B4636' }}>
                                    {groupeAcces[g.id].devoirs}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {accesCours && groupeDocs[g.id]?.length > 0 && (
                                <span className="badge" style={{ background: 'rgba(184,155,106,0.14)', color: '#8C6E44' }}>
                                  {groupeDocs[g.id].length} doc{groupeDocs[g.id].length > 1 ? 's' : ''}
                                </span>
                              )}
                              <svg className="w-4 h-4 transition-transform duration-200"
                                style={{ color: 'var(--text-3)', transform: openGroupe === g.id ? 'rotate(180deg)' : 'none' }}
                                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                              </svg>
                            </div>
                          </button>

                          {/* Zone documents — ouverte par l'accordéon */}
                          {openGroupe === g.id && (
                            <div className="px-5 pb-5 space-y-2.5 animate-fade-up"
                              style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>

                              {/* Accès bloqué → bannière */}
                              {!accesCours && (
                                <div className="pt-3">
                                  <BanniereAccesBloque/>
                                </div>
                              )}

                              {/* Accès autorisé → documents */}
                              {accesCours && (
                                <>
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
                                  {(groupeDocs[g.id] ?? []).map(gd =>
                                    gd.type_doc === 'audio' ? (
                                      <CarteAudio
                                        key={gd.id}
                                        gd={gd}
                                        audioUrl={audioUrls[gd.id] ?? null}
                                        onLoad={() => loadAudioUrl(gd)}
                                        loading={audioLoading[gd.id] ?? false}
                                      />
                                    ) : (
                                      <div key={gd.id}
                                        className="flex items-center gap-4 p-4 rounded-xl"
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
                                        {/* Lien caché déclenché programmatiquement après résolution URL */}
                                        {docUrls[gd.id] && (
                                          <a id={`dl-link-${gd.id}`}
                                            href={docUrls[gd.id]}
                                            target="_blank" rel="noopener noreferrer"
                                            className="btn-primary text-xs px-4 py-2 rounded-xl text-center inline-block"
                                            style={{ background: '#B89B6A', color: '#FFFFFF' }}>
                                            ↓
                                          </a>
                                        )}
                                        {!docUrls[gd.id] && (
                                          <button
                                            onClick={() => handleDownload(gd.storage_path, 'groupe-docs', gd.id, gd.nom)}
                                            disabled={downloading === gd.id}
                                            className="btn-primary text-xs px-4 py-2 rounded-xl disabled:opacity-40"
                                            style={{ background: '#B89B6A', color: '#FFFFFF' }}>
                                            {downloading === gd.id ? '…' : '↓'}
                                          </button>
                                        )}
                                      </div>
                                    )
                                  )}
                                </>
                              )}
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
