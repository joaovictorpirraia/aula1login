// app/(crm)/dashboard/queries.ts
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMonthBoundariesUTC } from '@/lib/utils/dates'

export const getTotalSales = cache(async (): Promise<number> => {
  const supabase = createSupabaseServerClient()
  const { start, end } = getMonthBoundariesUTC()
  const { data, error } = await supabase
    .from('deals')
    .select('value')
    .eq('status', 'won')
    .gte('closed_date', start.toISOString().split('T')[0])
    .lt('closed_date', end.toISOString().split('T')[0])
  if (error) throw new Error(error.message)
  return (data ?? []).reduce((sum, d) => sum + Number(d.value), 0)
})

export const getOpenDealsCount = cache(async (): Promise<number> => {
  const supabase = createSupabaseServerClient()
  const { count, error } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')
  if (error) throw new Error(error.message)
  return count ?? 0
})

export const getMonthlyGoal = cache(async (): Promise<number | null> => {
  const supabase = createSupabaseServerClient()
  const { start } = getMonthBoundariesUTC()
  const { data, error } = await supabase
    .from('monthly_goals')
    .select('goal_value')
    .eq('month', start.toISOString().split('T')[0])
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.goal_value != null ? Number(data.goal_value) : null
})

export const getChartData = cache(async (): Promise<{ date: string; total: number }[]> => {
  const supabase = createSupabaseServerClient()
  const { start, end } = getMonthBoundariesUTC()
  const { data, error } = await supabase
    .from('deals')
    .select('value, closed_date')
    .eq('status', 'won')
    .gte('closed_date', start.toISOString().split('T')[0])
    .lt('closed_date', end.toISOString().split('T')[0])
    .order('closed_date', { ascending: true })
  if (error) throw new Error(error.message)
  const grouped: Record<string, number> = {}
  for (const deal of data ?? []) {
    const day = deal.closed_date as string
    grouped[day] = (grouped[day] ?? 0) + Number(deal.value)
  }
  return Object.entries(grouped).map(([date, total]) => ({ date, total }))
})

export const getRecentDeals = cache(async () => {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('deals')
    .select('id, client_name, client_id, value, status, created_at, clients(name)')
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((d: any) => ({
    ...d,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    displayName: (d.clients as any)?.name ?? d.client_name ?? '–',
  }))
})
