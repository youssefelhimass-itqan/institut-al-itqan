'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  { id: 'coran',     label: 'Coran',    full: 'Classes Coran',    sub: 'Enfants & Adultes' },
  { id: 'al-itqan', label: 'Al-Itqan', full: 'Classes Al-Itqan', sub: 'Enfants'           },
  { id: 'arabe',    label: 'Arabe',    full: 'Classes Arabe',    sub: 'Adultes'           },
]

const CAT_COLOR: Record<string, string> = {
  coran:      '#C4365A',
  'al-itqan': '#3A8C62',
  arabe:      '#3A6E9C',
}

const CAT_BG: Record<string, string> = {
  coran:      'rgba(196,54,90,0.14)',
  'al-itqan': 'rgba(58,140,98,0.14)',
  arabe:      'rgba(58,110,156,0.14)',
}

const TYPE_ICON: Record<string, string> = {
  devoir: '📝', cours: '📖', rappel: '🔔', document: '📄',
}

const JOURS_ORDRE = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche']

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

  const [tab,         setTab]         = useState<string>('annonces')
  const [classeTab,   setClasseTab]   = useState<string>('coran')
  const [menuOpen,    setMenuOpen]    = useState<boolean>(false)
  const [groupes,     setGroupes]     = useState<Groupe[]>([])
  const [groupeDocs,  setGroupeDocs]  = useState<Record<string, GDoc[]>>({})
  const [openGroupe,  setOpenGroupe]  = useState<string | null>(null)
  const [loadingG,    setLoadingG]    = useState<boolean>(false)
  const [downloading, setDownloading] = useState<string | null>(null)
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

  const handleDownload = async (path: string, bucket: string, id: string) => {
    setDownloading(id)
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60)
      if (error || !data?.signedUrl) { alert('Impossible de générer le lien. Réessayez.'); return }
      window.open(data.signedUrl, '_blank')
    } finally { setDownloading(null) }
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
    <div className="min-h-screen">

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      <header
        className="sticky top-0 z-50"
        style={{
          background: 'rgba(44,26,6,0.92)',
          backdropFilter: 'blur(20px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
          borderBottom: '1px solid rgba(44,26,6,0.18)',
        }}>

        {/* Desktop */}
        <div className="hidden md:flex items-center h-[60px] px-8 gap-6">

          <div className="shrink-0">
            <p className="text-[15px] font-semibold leading-none tracking-tight" style={{ color: '#F5E7D3' }}>
              Institut Al-Itqan
            </p>
            <p className="text-[11px] font-medium leading-none mt-[5px] tracking-widest uppercase" style={{ color: 'var(--gold)' }}>
              Espace parents
            </p>
          </div>

          <div className="w-px h-6 shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }} />

          <nav className="flex items-center gap-0.5" ref={menuRef}>
            {([
              { id: 'annonces',    label: 'Annonces'    },
              { id: 'calendrier',  label: 'Calendrier'  },
              { id: 'reglement',   label: 'Règlement'   },
              { id: 'inscription', label: 'Inscription' },
            ] as const).map(item => (
              <button
                key={item.id}
                onClick={() => goTo(item.id)}
                className={`px-4 py-2 rounded-xl text-[13.5px] font-medium transition-all duration-200 ${tab === item.id ? 'nav-tab-active' : ''}`}
                style={{ color: tab === item.id ? '#6B4810' : 'rgba(245,231,211,0.65)' }}>
                {item.label}
              </button>
            ))}

            {/* Dropdown Classes */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className={`px-4 py-2 rounded-xl text-[13.5px] font-medium transition-all duration-200 flex items-center gap-1.5 ${tab === 'classes' ? 'nav-tab-active' : ''}`}
                style={{ color: tab === 'classes' ? '#6B4810' : 'rgba(245,231,211,0.65)' }}>
                Classes
                <svg
                  className="w-3.5 h-3.5 transition-transform duration-200"
                  style={{ transform: menuOpen ? 'rotate(180deg)' : 'none' }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div
                  className="absolute top-full left-0 mt-2 w-60 rounded-2xl overflow-hidden z-50 animate-fade-up"
                  style={{ background: '#EDE0C4', border: '1px solid rgba(139,96,32,0.18)', boxShadow: '0 16px 48px rgba(44,26,6,0.20)' }}>
                  {CLASSES_MENU.map(cl => (
                    <button
                      key={cl.id}
                      onClick={() => { setClasseTab(cl.id); goTo('classes') }}
                      className="w-full px-5 py-4 text-left transition-all duration-150"
                      style={{ borderBottom: '1px solid rgba(139,96,32,0.12)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(139,96,32,0.08)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <p className="text-sm font-semibold" style={{ color: '#3A2110' }}>{cl.full}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#6B4A2B' }}>{cl.sub}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold uppercase text-white"
                style={{ background: 'linear-gradient(135deg, #8B6020 0%, #6B4810 100%)' }}>
                {user.email[0]}
              </div>
              <div
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                style={{ background: '#34D399', borderColor: 'var(--bg-base)' }} />
            </div>
            <button
              onClick={logout}
              className="text-[13px] font-medium transition-all duration-200 px-3 py-1.5 rounded-lg"
              style={{ color: 'rgba(245,231,211,0.65)' }}
              onMouseEnter={e => { const b = e.currentTarget as HTMLElement; b.style.color = '#F5E7D3'; b.style.background = 'rgba(255,255,255,0.10)' }}
              onMouseLeave={e => { const b = e.currentTarget as HTMLElement; b.style.color = 'rgba(245,231,211,0.65)'; b.style.background = 'transparent' }}>
              Déconnexion
            </button>
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <div className="flex items-center justify-between px-5 h-[56px]">
            <div>
              <p className="text-[14px] font-semibold leading-none" style={{ color: '#F5E7D3' }}>
                Institut Al-Itqan
              </p>
              <p className="text-[10px] font-medium leading-none mt-1 tracking-widest uppercase" style={{ color: 'var(--gold)' }}>
                Espace parents
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold uppercase text-white"
                style={{ background: 'linear-gradient(135deg, #8B6020 0%, #6B4810 100%)' }}>
                {user.email[0]}
              </div>
              <button onClick={logout} className="text-xs font-medium" style={{ color: 'rgba(245,231,211,0.55)' }}>
                Déco.
              </button>
            </div>
          </div>
          <div className="overflow-x-auto hide-scrollbar" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="flex items-center px-4 pb-3 pt-2 gap-1.5 min-w-max">
              {[
                { id: 'annonces',    label: 'Annonces'    },
                { id: 'calendrier',  label: 'Calendrier'  },
                { id: 'reglement',   label: 'Règlement'   },
                { id: 'inscription', label: 'Inscription' },
                { id: 'classes',     label: 'Classes'     },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => goTo(item.id)}
                  className={`px-4 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all duration-200 ${tab === item.id ? 'nav-tab-active' : ''}`}
                  style={{ color: tab === item.id ? '#6B4810' : 'rgba(245,231,211,0.55)' }}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ══ CONTENU ══════════════════════════════════════════════════════════ */}
      <main className="max-w-3xl mx-auto px-5 py-10">

        {/* ── ANNONCES ────────────────────────────────────────────────────── */}
        {tab === 'annonces' && (
          <div className="animate-fade-up">
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
                    <button
                      onClick={() => handleDownload(doc.storage_path, 'documents', doc.id)}
                      disabled={downloading === doc.id}
                      className="btn-primary text-xs px-4 py-2 rounded-xl disabled:opacity-40">
                      {downloading === doc.id ? '…' : '↓'}
                    </button>
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
                      style={{ background: 'var(--gold-soft)', color: 'var(--gold)' }}>PDF</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>{doc.nom}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{doc.taille}</p>
                    </div>
                    <button
                      onClick={() => handleDownload(doc.storage_path, 'documents', doc.id)}
                      disabled={downloading === doc.id}
                      className="btn-primary text-xs px-4 py-2 rounded-xl disabled:opacity-40">
                      {downloading === doc.id ? '…' : '↓'}
                    </button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── INSCRIPTION ─────────────────────────────────────────────────── */}
        {tab === 'inscription' && (
          <div className="animate-fade-up">
            <div className="mb-8">
              <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                Inscription
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Année 2026-2027 · Places limitées</p>
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
                    style={{ background: copied ? '#3A8C62' : undefined }}>
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
            <div className="flex gap-2 overflow-x-auto pb-1 mb-7">
              {CLASSES_MENU.map(cl => (
                <button
                  key={cl.id}
                  onClick={() => setClasseTab(cl.id)}
                  className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                  style={classeTab === cl.id
                    ? { background: CAT_COLOR[cl.id], color: '#fff', boxShadow: `0 4px 20px ${CAT_COLOR[cl.id]}40` }
                    : { background: 'var(--bg-surface)', color: 'var(--text-2)', border: '1px solid var(--border)' }
                  }>
                  {cl.label}
                </button>
              ))}
            </div>

            {/* Titre catégorie */}
            {CLASSES_MENU.filter(cl => cl.id === classeTab).map(cl => (
              <div key={cl.id} className="mb-7">
                <h1 className="text-[28px] font-bold tracking-tight" style={{ color: 'var(--text-1)' }}>
                  {cl.full}
                </h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>{cl.sub}</p>
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
                    <div className="w-1.5 h-4 rounded-full" style={{ background: CAT_COLOR[classeTab] }} />
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: CAT_COLOR[classeTab] }}>
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
                            style={{ background: `linear-gradient(135deg, ${CAT_COLOR[g.categorie]} 0%, ${CAT_COLOR[g.categorie]}99 100%)` }}>
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
                                style={{ background: CAT_BG[g.categorie], color: CAT_COLOR[g.categorie] }}>
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
                            style={{ borderTop: '1px solid rgba(139,96,32,0.12)' }}>

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
                                style={{ background: CAT_BG[g.categorie] }}>
                                <span className="text-xl shrink-0">{TYPE_ICON[gd.type_doc] ?? '📄'}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>
                                    {gd.nom}
                                  </p>
                                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                                    {gd.taille} · {fmtDate(gd.created_at)}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleDownload(gd.storage_path, 'groupe-docs', gd.id)}
                                  disabled={downloading === gd.id}
                                  className="btn-primary text-xs px-4 py-2 rounded-xl disabled:opacity-40"
                                  style={{ background: CAT_COLOR[g.categorie] }}>
                                  {downloading === gd.id ? '…' : '↓'}
                                </button>
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
  )
}
