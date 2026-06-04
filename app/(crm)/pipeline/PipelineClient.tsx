'use client'

import { useState, useMemo } from 'react'
import type { DealWithClient } from '../shared/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils/dates'

type Filter = 'all' | 'open' | 'won' | 'lost'
const STATUS_LABELS = { open: 'Aberto', won: 'Ganho', lost: 'Perdido' } as const
const STATUS_VARIANTS = { open: 'secondary', won: 'default', lost: 'destructive' } as const

export function PipelineClient({ deals }: { deals: DealWithClient[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const open = useMemo(() => deals.filter((d) => d.status === 'open'), [deals])
  const won  = useMemo(() => deals.filter((d) => d.status === 'won'),  [deals])
  const lost = useMemo(() => deals.filter((d) => d.status === 'lost'), [deals])

  const totalOpen = open.reduce((s, d) => s + Number(d.value), 0)
  const totalWon  = won.reduce((s, d)  => s + Number(d.value), 0)
  const totalLost = lost.reduce((s, d) => s + Number(d.value), 0)
  const convRate  =
    won.length + lost.length > 0
      ? Math.round((won.length / (won.length + lost.length)) * 100)
      : 0

  const filtered = filter === 'all' ? deals : deals.filter((d) => d.status === filter)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Abertos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalOpen)}</p>
            <p className="text-xs text-gray-400 mt-1">{open.length} deal(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Ganhos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalWon)}</p>
            <p className="text-xs text-gray-400 mt-1">{won.length} deal(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Perdidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalLost)}</p>
            <p className="text-xs text-gray-400 mt-1">{lost.length} deal(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Taxa de Conversão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-800">{convRate}%</p>
            <Progress value={convRate} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', 'open', 'won', 'lost'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'Todos' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Cliente', 'Valor', 'Status', 'Data de Fechamento'].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Nenhum negócio encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((d) => (
                <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{d.displayName}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(Number(d.value))}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[d.status as keyof typeof STATUS_VARIANTS]}>
                      {STATUS_LABELS[d.status as keyof typeof STATUS_LABELS]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {d.closed_date
                      ? new Date(d.closed_date).toLocaleDateString('pt-BR')
                      : '–'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
