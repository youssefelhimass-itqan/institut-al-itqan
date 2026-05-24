/**
 * app/admin/page.tsx — Server Component
 * Vérifie la session et le rôle admin côté serveur,
 * puis passe les données initiales au Client Component.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminDashboard from '@/components/AdminDashboard'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/parent')

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
    <AdminDashboard
      annoncesInit={annonces ?? []}
      horairesInit={horaires ?? []}
      documentsInit={documents ?? []}
    />
  )
}
