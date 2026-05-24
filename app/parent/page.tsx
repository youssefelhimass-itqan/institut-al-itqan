/**
 * app/parent/page.tsx — Server Component
 * Vérifie la session côté serveur,
 * puis passe les données initiales au Client Component.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ParentDashboard from '@/components/ParentDashboard'

export default async function ParentPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [
    { data: annonces },
    { data: horaires },
    { data: documents },
  ] = await Promise.all([
    supabase.from('annonces').select('*').order('created_at', { ascending: false }),
    supabase.from('horaires').select('*').order('jour'),
    supabase.from('documents').select('*').order('created_at', { ascending: false }),
  ])

  return (
    <ParentDashboard
      user={{ email: user.email ?? '' }}
      annonces={annonces ?? []}
      horaires={horaires ?? []}
      documents={documents ?? []}
    />
  )
}
