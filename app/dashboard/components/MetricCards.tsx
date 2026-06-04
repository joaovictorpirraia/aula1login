import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils/dates'

interface MetricCardsProps {
  totalSales: number
  openDeals: number
  goal: number | null
}

export function MetricCards({ totalSales, openDeals, goal }: MetricCardsProps) {
  const progress = goal != null ? Math.min(Math.round((totalSales / goal) * 100), 100) : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            Total de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-gray-800">
            {formatCurrency(totalSales)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Mês atual</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            Negócios Abertos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-gray-800">{openDeals}</p>
          <p className="text-xs text-gray-400 mt-1">Em andamento</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            Meta do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          {goal === null ? (
            <p className="text-sm text-gray-400">Sem meta definida</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-gray-800">{progress}%</span>
                <span className="text-xs text-gray-400">{formatCurrency(goal)}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
