'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CLASSES_MENU = [
  { id: 'coran',               full: 'Coran',                 sub: 'Enfants & Adultes' },
  { id: 'al-itqan',            full: 'Arabe et Religion',      sub: 'Enfants'           },
  { id: 'arabe',               full: 'Lecture Arabe',                 sub: 'Adultes'           },
  { id: 'sciences-islamiques', full: 'Sciences Islamiques et Arabe débutant',    sub: 'Adultes · Mixte'   },
  { id: 'arabe-comprehension', full: 'Sciences Islamiques et Arabe intermédiaire', sub: 'Adultes · Mixte'   },
]

type Props = {
  userEmail:       string
  activeTab?:      string
  onTabChange?:    (tab: string) => void
  onClasseChange?: (classe: string) => void
}

export default function Navbar({ userEmail, activeTab, onTabChange, onClasseChange }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isActive = (id: string) => {
    if (id === 'sinscrire') return pathname === '/inscription'
    return activeTab === id
  }

  const handleTab = (id: string) => {
    setMenuOpen(false)
    if (pathname === '/parent' && onTabChange) {
      onTabChange(id)
    } else {
      router.push(`/parent?tab=${id}`)
    }
  }

  // Onglets : texte blanc à 80%, blanc pur quand actif
  const tabCls = (id: string) =>
    `px-4 py-2 rounded-xl text-[13.5px] font-medium transition-all duration-200 ${isActive(id) ? 'nav-tab-active' : ''}`

  const tabColor = (id: string): React.CSSProperties => ({
    color: isActive(id) ? '#3D2B1F' : '#6B4C35',
  })

  // Header : brun chaud profond — chaleureux et premium, pas bleu
  const HEADER_BG = '#EADFC8'

  return (
    <header className="sticky top-0 z-[100]"
      style={{
        background:           '#EADFC8',
        backdropFilter:       'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        borderBottom:         '1px solid rgba(74,53,32,0.14)',
      }}>

      {/* ── Desktop ─────────────────────────────────────────── */}
      <div className="hidden md:flex items-center h-[60px] px-8 gap-6">

        {/* Identité */}
        <div className="shrink-0">
          <p className="text-[15px] font-semibold leading-none tracking-tight" style={{ color: '#4A3520' }}>
            Institut Al-Itqan
          </p>
          <p className="text-[11px] font-medium leading-none mt-[5px] tracking-widest uppercase"
            style={{ color: '#8C5A3C' }}>
            Espace parents
          </p>
        </div>

        <div className="w-px h-5 shrink-0" style={{ background: 'rgba(74,53,32,0.18)' }} />

        {/* Navigation */}
        <nav className="flex items-center gap-0.5" ref={menuRef}>

          {/* 1. Annonces */}
          <button onClick={() => handleTab('annonces')}
            className={tabCls('annonces')} style={tabColor('annonces')}>
            Annonces
          </button>

          {/* 2. Classes — dropdown */}
          <div className="relative">
            <button onClick={() => setMenuOpen(v => !v)}
              className={tabCls('classes')}
              style={{ ...tabColor('classes'), display: 'flex', alignItems: 'center', gap: '5px' }}>
              Classes
              <svg className="w-3.5 h-3.5 transition-transform duration-200"
                style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', opacity: 0.65 }}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute top-full left-0 mt-2 w-[22rem] rounded-2xl overflow-hidden z-[200] animate-fade-up"
                style={{
                  background: '#F4EBDD',
                  border:     '1px solid rgba(184,155,106,0.35)',
                  boxShadow:  '0 8px 40px rgba(44,26,14,0.16)',
                }}>
                {CLASSES_MENU.map((cl, i) => (
                  <button key={cl.id}
                    onClick={() => { if (onClasseChange) onClasseChange(cl.id); handleTab('classes') }}
                    className="w-full px-5 py-4 text-left transition-all duration-150"
                    style={{ borderBottom: i < CLASSES_MENU.length - 1 ? '1px solid rgba(184,155,106,0.22)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(184,155,106,0.18)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <p className="text-[13.5px] font-semibold whitespace-nowrap" style={{ color: '#3D2B1F' }}>
                      {cl.full}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#8C6E44' }}>{cl.sub}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. S'inscrire — identique aux autres onglets */}
          <Link href="/inscription"
            className={tabCls('sinscrire')}
            style={tabColor('sinscrire')}>
            S'inscrire
          </Link>

          {/* 4. Calendrier */}
          <button onClick={() => handleTab('calendrier')}
            className={tabCls('calendrier')} style={tabColor('calendrier')}>
            Calendrier
          </button>

          {/* 5. Inviter un proche */}
          <button onClick={() => handleTab('invitation')}
            className={tabCls('invitation')} style={tabColor('invitation')}>
            Inviter un proche
          </button>

          {/* 6. Règlement */}
          <button onClick={() => handleTab('reglement')}
            className={tabCls('reglement')} style={tabColor('reglement')}>
            Règlement
          </button>

        </nav>

        <div className="flex-1" />

        {/* Avatar + déconnexion */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold uppercase text-white"
              style={{ background: 'linear-gradient(135deg, #8C5A3C 0%, #6E4228 100%)' }}>
              {userEmail[0]}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
              style={{ background: '#5CB97B', borderColor: '#EADFC8' }} />
          </div>
          <button onClick={logout}
            className="text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{ color: 'rgba(74,53,32,0.55)' }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLElement; b.style.color = '#4A3520'; b.style.background = 'rgba(74,53,32,0.08)' }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLElement; b.style.color = 'rgba(74,53,32,0.55)'; b.style.background = 'transparent' }}>
            Déconnexion
          </button>
        </div>
      </div>

      {/* ── Mobile ──────────────────────────────────────────── */}
      <div className="md:hidden">
        <div className="flex items-center justify-between px-5 h-[56px]">
          <div>
            <p className="text-[14px] font-semibold leading-none" style={{ color: '#4A3520' }}>Institut Al-Itqan</p>
            <p className="text-[10px] font-medium leading-none mt-1 tracking-widest uppercase"
              style={{ color: '#8C5A3C' }}>Espace parents</p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold uppercase text-white"
              style={{ background: 'linear-gradient(135deg, #8C5A3C 0%, #6E4228 100%)' }}>
              {userEmail[0]}
            </div>
            <button onClick={logout} className="text-xs font-medium"
              style={{ color: 'rgba(74,53,32,0.55)' }}>Déco.</button>
          </div>
        </div>

        <div className="overflow-x-auto hide-scrollbar"
          style={{ borderTop: '1px solid rgba(74,53,32,0.12)' }}>
          <div className="flex items-center px-4 pb-3 pt-2 gap-1 min-w-max">
            {[
              { id: 'annonces',   label: 'Annonces'          },
              { id: 'classes',    label: 'Classes'           },
              { id: 'calendrier', label: 'Calendrier'        },
              { id: 'invitation', label: 'Inviter un proche' },
              { id: 'reglement',  label: 'Règlement'         },
            ].map(item => (
              <button key={item.id} onClick={() => handleTab(item.id)}
                className={`px-3.5 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${isActive(item.id) ? 'nav-tab-active' : ''}`}
                style={{ color: isActive(item.id) ? '#3D2B1F' : '#6B4C35' }}>
                {item.label}
              </button>
            ))}
            <Link href="/inscription"
              className={`px-3.5 py-2 rounded-xl text-[13px] font-medium whitespace-nowrap transition-all duration-200 ${isActive('sinscrire') ? 'nav-tab-active' : ''}`}
              style={{ color: isActive('sinscrire') ? '#3D2B1F' : '#6B4C35' }}>
              S'inscrire
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
