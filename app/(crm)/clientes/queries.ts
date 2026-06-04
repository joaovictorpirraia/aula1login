import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type Client = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export const getClients = cache(async (): Promise<Client[]> => {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, company, email, phone, notes, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
})
