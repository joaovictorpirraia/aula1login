export const dynamic = 'force-dynamic'

import { PageHeader } from '../components/PageHeader'
import { ConfiguracoesClient } from './ConfiguracoesClient'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getMonthBoundariesUTC, getSixMonthsAgoUTC } from '@/lib/utils/dates'

async function getGoalData() {
  const supabase = createSupabaseServerClient()
  const admin = createSupabaseAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { currentGoal: null, history: [], currentMonth: '' }

  const { start } = getMonthBoundariesUTC()
  const currentMonth = start.toISOString().split('T')[0]

  const [goalsResult, wonResult, currentResult] = await Promise.allSettled([
    admin
      .from('monthly_goals')
      .select('month, goal_value')
      .eq('user_id', user.id)
      .order('month', { ascending: false })
      .limit(6),
    supabase
      .from('deals')
      .select('closed_date, value')
      .eq('status', 'won')
      .gte('closed_date', getSixMonthsAgoUTC().startStr),
    admin
      .from('monthly_goals')
      .select('goal_value')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle(),
  ])

  const goals   = goalsResult.status   === 'fulfilled' ? (goalsResult.value.data   ?? []) : []
  const wonDeals= wonResult.status     === 'fulfilled' ? (wonResult.value.data     ?? []) : []
  const current = currentResult.status === 'fulfilled' ? currentResult.value.data : null

  const sumByMonth: Record<string, number> = {}
  for (const d of wonDeals) {
    const key = (d.closed_date as string).slice(0, 7)
    sumByMonth[key] = (sumByMonth[key] ?? 0) + Number(d.value)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history = (goals as any[]).map((g) => ({
    month: g.month as string,
    goal:  Number(g.goal_value),
    won:   sumByMonth[(g.month as string).slice(0, 7)] ?? 0,
  }))

  return {
    currentGoal: current?.goal_value ? Number(current.goal_value) : null,
    history,
    currentMonth,
  }
}

export default async function ConfiguracoesPage() {
  const { currentGoal, history, currentMonth } = await getGoalData()
  return (
    <div>
      <PageHeader title="Configurações" />
      <div className="px-6 py-6">
        <ConfiguracoesClient
          history={history}
          currentGoal={currentGoal}
          currentMonth={currentMonth}
        />
      </div>
    </div>
  )
}
