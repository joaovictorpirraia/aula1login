// app/dashboard/page.tsx
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Header } from './components/Header'
import { MetricCards } from './components/MetricCards'
import { SalesChart } from './components/SalesChart'
import { DealsTable } from './components/DealsTable'
import {
  getTotalSales,
  getOpenDealsCount,
  getMonthlyGoal,
  getChartData,
  getRecentDeals,
} from './queries'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const results = await Promise.allSettled([
    getTotalSales(),
    getOpenDealsCount(),
    getMonthlyGoal(),
    getChartData(),
    getRecentDeals(),
  ])

  const totalSales = results[0].status === 'fulfilled' ? results[0].value : 0
  const openDeals  = results[1].status === 'fulfilled' ? results[1].value : 0
  const goal       = results[2].status === 'fulfilled' ? results[2].value : null
  const chartData  = results[3].status === 'fulfilled' ? results[3].value : []
  const recentDeals = results[4].status === 'fulfilled' ? results[4].value : []

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userEmail={user.email ?? ''} />
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <MetricCards
          totalSales={totalSales}
          openDeals={openDeals}
          goal={goal}
        />
        <SalesChart data={chartData} />
        <DealsTable deals={recentDeals} />
      </main>
    </div>
  )
}
