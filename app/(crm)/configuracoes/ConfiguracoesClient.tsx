'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { saveMeta } from './actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils/dates'

type HistoryEntry = { month: string; goal: number; won: number }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando...' : 'Salvar Meta'}
    </Button>
  )
}

function formatMonth(dateStr: string) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function ConfiguracoesClient({
  history,
  currentGoal,
  currentMonth,
}: {
  history: HistoryEntry[]
  currentGoal: number | null
  currentMonth: string
}) {
  const [state, formAction] = useFormState(saveMeta, { error: null, success: null })

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-700">
            Meta do Mês Atual — {formatMonth(currentMonth)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentGoal != null ? (
            <p className="text-sm text-gray-600 mb-4">
              Meta atual:{' '}
              <span className="font-semibold">{formatCurrency(currentGoal)}</span>
            </p>
          ) : (
            <p className="text-sm text-gray-400 mb-4">Nenhuma meta definida para este mês.</p>
          )}
          <form action={formAction} className="flex gap-3 items-start">
            <input type="hidden" name="month" value={currentMonth} />
            <Input
              name="goal_value"
              type="number"
              placeholder="Ex: 50000"
              min="0.01"
              step="0.01"
              defaultValue={currentGoal ?? ''}
              className="max-w-xs"
            />
            <SubmitButton />
          </form>
          {state.error   && <p className="text-sm text-red-600 mt-2">{state.error}</p>}
          {state.success && <p className="text-sm text-green-600 mt-2">{state.success}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-700">
            Histórico (últimos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum histórico disponível.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Mês', 'Meta', 'Total Ganho', '% Atingido'].map((h) => (
                    <th key={h} className="text-left py-2 font-medium text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const pct =
                    h.goal > 0 ? Math.min(Math.round((h.won / h.goal) * 100), 100) : 0
                  return (
                    <tr key={h.month} className="border-b border-gray-50">
                      <td className="py-3 text-gray-700">{formatMonth(h.month)}</td>
                      <td className="py-3 text-gray-700">{formatCurrency(h.goal)}</td>
                      <td className="py-3 text-gray-700">{formatCurrency(h.won)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 w-16" />
                          <span className="text-gray-700 w-10">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
