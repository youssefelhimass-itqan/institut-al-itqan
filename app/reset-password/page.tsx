'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState(false)
  const [tokenReady, setTokenReady] = useState(false)
  const [tokenError, setTokenError] = useState(false)

  // ── Lire les tokens directement dans le hash de l'URL ────────────────────
  // Supabase envoie : /reset-password#access_token=xxx&refresh_token=yyy&type=recovery
  useEffect(() => {
    const hash   = window.location.hash.slice(1)          // retire le "#"
    const params = new URLSearchParams(hash)

    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type         = params.get('type')

    // Vérifier qu'on est bien dans un flux de récupération de mot de passe
    if (type !== 'recovery' || !accessToken || !refreshToken) {
      setTokenError(true)
      return
    }

    // Établir la session avec les tokens reçus
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: err }) => {
        if (err) {
          console.error('[reset-password] setSession error:', err.message)
          setTokenError(true)
        } else {
          // Nettoyer le hash de l'URL (sécurité : ne pas garder les tokens visibles)
          window.history.replaceState(null, '', window.location.pathname)
          setTokenReady(true)
        }
      })
  }, []) // eslint-disable-line

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
      } else {
        setSuccess(true)
        setTimeout(() => router.replace('/'), 3000)
      }
    } catch {
      setError('Erreur inattendue. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: 'linear-gradient(145deg, #2D0810 0%, #5C1527 55%, #7A2038 100%)' }}>

      {/* Halos décoratifs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.07]"
          style={{ border: '1px solid #C4A05A' }} />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full opacity-[0.06]"
          style={{ border: '1px solid #C4A05A' }} />
      </div>

      <div className="relative w-full max-w-[400px] rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)' }}>

        {/* Zone logo */}
        <div className="flex flex-col items-center pt-9 pb-7 px-10 gap-2.5"
          style={{ background: '#F9F6F1' }}>
          <img src="/logo.png" alt="Institut Al-Itqan"
            className="h-[88px] w-auto object-contain" draggable={false} />
          <p className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: '#9A7535', letterSpacing: '0.12em' }}>
            Réinitialisation
          </p>
          <div className="w-8 h-px rounded-full mt-1"
            style={{ background: '#C4A05A', opacity: 0.5 }} />
        </div>

        {/* Zone contenu */}
        <div className="bg-white px-10 py-8">

          {/* ── Succès ── */}
          {success && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(52,168,83,0.10)' }}>
                <svg className="w-7 h-7" style={{ color: '#34A853' }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Mot de passe mis à jour !</p>
                <p className="text-xs text-gray-400 mt-1">
                  Vous allez être redirigé vers la page de connexion…
                </p>
              </div>
            </div>
          )}

          {/* ── Lien invalide / expiré ── */}
          {!success && tokenError && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(220,38,38,0.08)' }}>
                <svg className="w-7 h-7 text-red-500" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Lien invalide ou expiré</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Ce lien n'est valable qu'une seule fois et expire après 1 heure.
                  Veuillez refaire une demande depuis la page de connexion.
                </p>
              </div>
              <button onClick={() => router.replace('/')}
                className="text-xs font-semibold px-6 py-2.5 rounded-xl text-white transition-all"
                style={{ background: 'linear-gradient(135deg, #7a2038 0%, #5C1527 100%)' }}>
                Retour à la connexion
              </button>
            </div>
          )}

          {/* ── Chargement (lecture hash en cours) ── */}
          {!success && !tokenError && !tokenReady && (
            <div className="flex flex-col items-center gap-3 py-6">
              <svg className="animate-spin h-7 w-7" style={{ color: '#7a2038' }}
                fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-xs text-gray-400">Vérification du lien…</p>
            </div>
          )}

          {/* ── Formulaire ── */}
          {!success && tokenReady && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">Nouveau mot de passe</p>
                <p className="text-xs text-gray-400 mt-1">
                  Choisissez un mot de passe d'au moins 8 caractères.
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Nouveau mot de passe
                </label>
                <input
                  type="password" required value={password} disabled={loading}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-[#FAFAF8] px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-[#7a2038] focus:bg-white focus:ring-2 focus:ring-[#7a2038]/10"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password" required value={confirm} disabled={loading}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-gray-200 bg-[#FAFAF8] px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-all focus:border-[#7a2038] focus:bg-white focus:ring-2 focus:ring-[#7a2038]/10"
                />
              </div>

              <div className="flex justify-center pt-1">
                <button type="submit" disabled={loading}
                  className="px-12 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #7a2038 0%, #5C1527 100%)',
                    boxShadow: '0 2px 14px rgba(92,21,39,0.35)',
                  }}>
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Mise à jour…
                    </>
                  ) : 'Enregistrer'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Pied */}
        <div className="px-10 py-4 text-center"
          style={{ background: '#F9F6F1', borderTop: '1px solid #EDE5D8' }}>
          <p className="text-[11px]" style={{ color: '#C4A05A', opacity: 0.65 }}>
            Accès réservé aux familles de l'Institut Al-Itqan
          </p>
        </div>
      </div>
    </div>
  )
}
