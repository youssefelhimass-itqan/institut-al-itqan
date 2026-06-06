import { redirect } from 'next/navigation'
import { Suspense } from 'react'
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
    // Suspense requis par useSearchParams dans ParentDashboard
    <Suspense>
      <ParentDashboard
        user={{ email: user.email ?? '' }}
        annonces={annonces ?? []}
        horaires={horaires ?? []}
        documents={documents ?? []}
      />
    </Suspense>
  )
}
