'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [resetMode, setResetMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError(authError.message); return }
      router.refresh()
    } catch {
      setError('Erreur inattendue. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) setError(err.message)
      else setResetSent(true)
    } catch {
      setError('Erreur inattendue. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{
        background: 'linear-gradient(145deg, #2D0810 0%, #5C1527 55%, #7A2038 100%)',
      }}
    >
      {/* Halo décoratif */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{ border: '1px solid #C4A05A' }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-[0.06]"
          style={{ border: '1px solid #C4A05A' }} />
      </div>

      {/* ── Carte ── */}
      <div
        className="relative w-full max-w-[400px] rounded-2xl overflow-hidden"
        style={{
          boxShadow: '0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* ── Zone logo (crème) ── */}
        <div
          className="flex flex-col items-center pt-9 pb-7 px-10 gap-2.5"
          style={{ background: '#F9F6F1' }}
        >
          {/*
            Logo seul — le logo contient déjà "Institut AL-ITQAN" + "الإتقان"
            Pas de texte supplémentaire pour éviter la duplication
          */}
          <img
            src="/logo.png"
            alt="Institut Al-Itqan"
            className="h-[88px] w-auto object-contain"
            draggable={false}
          />

          {/* Une seule ligne sous le logo */}
          <p className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#9A7535', letterSpacing: '0.12em' }}>
            Espace familles
          </p>

          {/* Séparateur or */}
          <div className="w-8 h-px rounded-full mt-1" style={{ background: '#C4A05A', opacity: 0.5 }} />
        </div>

        {/* ── Zone formulaire (blanc) ── */}
        <div className="bg-white px-10 py-8">

          {resetMode ? (
            /* ─ Mot de passe oublié ─ */
            <form onSubmit={handleReset} className="flex flex-col gap-5">
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">Réinitialiser le mot de passe</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Entrez votre email pour recevoir un lien de réinitialisation.
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              {resetSent ? (
                <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-center">
                  ✅ Email envoyé — vérifiez votre boîte mail.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    type="email" required value={email} disabled={loading}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full rounded-xl border border-gray-200 bg-[#FAFAF8] px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-[#7a2038] focus:bg-white focus:ring-2 focus:ring-[#7a2038]/10"
                  />
                </div>
              )}

              {!resetSent && (
                <button type="submit" disabled={loading}
                  className="self-center px-10 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #7a2038 0%, #5C1527 100%)',
                    boxShadow: '0 2px 12px rgba(92,21,39,0.35)',
                  }}>
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              )}

              <button type="button"
                onClick={() => { setResetMode(false); setResetSent(false); setError('') }}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors text-center mt-1">
                ← Retour à la connexion
              </button>
            </form>

          ) : (
            /* ─ Connexion ─ */
            <form onSubmit={handleLogin} className="flex flex-col gap-5">

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <span className="font-semibold block mb-0.5">Connexion échouée</span>
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email" required value={email} disabled={loading}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  className="w-full rounded-xl border border-gray-200 bg-[#FAFAF8] px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-[#7a2038] focus:bg-white focus:ring-2 focus:ring-[#7a2038]/10"
                />
              </div>

              {/* Mot de passe */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Mot de passe
                </label>
                <input
                  type="password" required value={password} disabled={loading}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-[#FAFAF8] px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-[#7a2038] focus:bg-white focus:ring-2 focus:ring-[#7a2038]/10"
                />
                <button type="button"
                  onClick={() => { setResetMode(true); setError('') }}
                  className="text-xs font-medium text-left transition-colors hover:opacity-70 mt-0.5"
                  style={{ color: '#7a2038' }}>
                  Mot de passe oublié ?
                </button>
              </div>

              {/* Bouton — centré, pas pleine largeur */}
              <div className="flex justify-center pt-1">
                <button
                  type="submit" disabled={loading}
                  className="px-12 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #7a2038 0%, #5C1527 100%)',
                    boxShadow: '0 2px 14px rgba(92,21,39,0.35)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(92,21,39,0.5)'
                    ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 14px rgba(92,21,39,0.35)'
                    ;(e.currentTarget as HTMLButtonElement).style.transform = 'none'
                  }}>
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Connexion…
                    </>
                  ) : 'Se connecter'}
                </button>
              </div>

            </form>
          )}
        </div>

        {/* ── Pied de carte ── */}
        <div
          className="px-10 py-4 text-center"
          style={{ background: '#F9F6F1', borderTop: '1px solid #EDE5D8' }}
        >
          <p className="text-[11px]" style={{ color: '#C4A05A', opacity: 0.65 }}>
            Accès réservé aux familles de l'Institut Al-Itqan
          </p>
        </div>
      </div>
    </div>
  )
}
