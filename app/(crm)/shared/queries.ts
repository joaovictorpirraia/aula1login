import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSixMonthsAgoUTC } from '@/lib/utils/dates'

export type DealWithClient = {
  id: string
  user_id: string
  client_id: string | null
  client_name: string | null
  value: string
  status: 'open' | 'won' | 'lost'
  created_at: string
  closed_at: string | null
  closed_date: string | null
  updated_at: string
  clients: { name: string } | null
  displayName: string
}

export const getDealsWithClients = cache(async (): Promise<DealWithClient[]> => {
  const supabase = createSupabaseServerClient()
  const { startStr } = getSixMonthsAgoUTC()

  const { data, error } = await supabase
    .from('deals')
    .select('*, clients(name)')
    .gte('created_at', startStr)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((deal: any) => ({
    ...deal,
    displayName: deal.clients?.name ?? deal.client_name ?? '–',
  }))
})
