// app/(crm)/dashboard/page.tsx
export const dynamic = 'force-dynamic'

import { MetricCards } from './components/MetricCards'
import { SalesChart } from './components/SalesChart'
import { DealsTable } from './components/DealsTable'
import { PageHeader } from '../components/PageHeader'
import {
  getTotalSales, getOpenDealsCount, getMonthlyGoal, getChartData, getRecentDeals
} from './queries'

const QUERY_NAMES = ['totalSales', 'openDeals', 'monthlyGoal', 'chartData', 'recentDeals']

export default async function DashboardPage() {
  const results = await Promise.allSettled([
    getTotalSales(), getOpenDealsCount(), getMonthlyGoal(), getChartData(), getRecentDeals()
  ])

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(`[dashboard] query "${QUERY_NAMES[i]}" failed:`, result.reason)
    }
  })

  const hasDataError = results.some(r => r.status === 'rejected')
  const totalSales  = results[0].status === 'fulfilled' ? results[0].value : 0
  const openDeals   = results[1].status === 'fulfilled' ? results[1].value : 0
  const goal        = results[2].status === 'fulfilled' ? results[2].value : null
  const chartData   = results[3].status === 'fulfilled' ? results[3].value : []
  const recentDeals = results[4].status === 'fulfilled' ? results[4].value : []

  return (
    <div>
      <PageHeader title="Visão Geral" />
      <div className="px-6 py-6 space-y-6">
        {hasDataError && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            Alguns dados não puderam ser carregados. Tente recarregar a página.
          </div>
        )}
        <MetricCards totalSales={totalSales} openDeals={openDeals} goal={goal} />
        <SalesChart data={chartData} />
        <DealsTable deals={recentDeals} />
      </div>
    </div>
  )
}
