import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import InscriptionClient from './InscriptionClient'

export const metadata = {
  title: 'Inscription & Paiement — Institut Al-Itqan',
}

export default async function InscriptionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  return <InscriptionClient userEmail={user.email ?? ''} />
}
