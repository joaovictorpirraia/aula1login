import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/dates'

type DealStatus = 'open' | 'won' | 'lost'

type Deal = {
  id: string
  client_name: string
  value: string | number
  status: DealStatus
  created_at: string
}

interface DealsTableProps {
  deals: Deal[]
}

const STATUS_LABELS: Record<DealStatus, string> = {
  won: 'Ganho',
  open: 'Aberto',
  lost: 'Perdido',
}

const STATUS_VARIANTS: Record<DealStatus, 'default' | 'secondary' | 'destructive'> = {
  won: 'default',
  open: 'secondary',
  lost: 'destructive',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function DealsTable({ deals }: DealsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-700">
          Negócios Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Nenhum negócio encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Cliente</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Valor</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Data</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr
                    key={deal.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-3 text-gray-800">{deal.client_name}</td>
                    <td className="py-3 px-3 text-right text-gray-800 font-medium">
                      {formatCurrency(Number(deal.value))}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={STATUS_VARIANTS[deal.status]}>
                        {STATUS_LABELS[deal.status]}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-500">
                      {formatDate(deal.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
