/**
 * app/parent/page.tsx — Server Component
 *
 * Sécurité :
 *   • accesCours calculé côté serveur avant tout rendu
 *   • Fail-secure : toute erreur ou profil manquant → accesCours = false
 *   • Le contrôle client n'est PAS une barrière de sécurité :
 *     les politiques RLS et les droits Storage doivent bloquer l'API directe.
 */

import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import ParentDashboard from '@/components/ParentDashboard'

export default async function ParentPage() {
  const supabase = await createClient()

  // 1. Vérifier l'authentification
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // 2. Lire le profil — fail-secure explicite
  //    Si erreur réseau, profil manquant ou RLS bloquante → accesCours = false
  //    Jamais de valeur par défaut permissive.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('acces_cours, role')
    .eq('id', user.id)
    .single()

  const accesCours: boolean = !profileError && profile?.acces_cours === true

  // 3. Données publiques — accessibles à tous les parents connectés
  //    Annonces et horaires généraux : aucune donnée pédagogique sensible.
  //    groupes, groupe_acces, groupe_documents : fetched côté client
  //    et conditionnés par accesCours + RLS Supabase.
  const [
    { data: annonces },
    { data: horaires },
  ] = await Promise.all([
    supabase.from('annonces').select('*').order('created_at', { ascending: false }),
    supabase.from('horaires').select('*').order('jour'),
  ])

  return (
    <Suspense>
      <ParentDashboard
        user={{ id: user.id, email: user.email ?? '' }}
        annonces={annonces ?? []}
        horaires={horaires ?? []}
        accesCours={accesCours}
      />
    </Suspense>
  )
}
