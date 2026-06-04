'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import type { DealWithClient } from '../shared/queries'
import type { Client } from '../clientes/queries'
import { moveDeal, createDeal } from './actions'
import { Modal } from '../components/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils/dates'

type Status = 'open' | 'won' | 'lost'

const COLUMNS: { status: Status; label: string; bg: string }[] = [
  { status: 'open',  label: 'Abertos',  bg: 'bg-blue-50 border-blue-200'  },
  { status: 'won',   label: 'Ganhos',   bg: 'bg-green-50 border-green-200' },
  { status: 'lost',  label: 'Perdidos', bg: 'bg-red-50 border-red-200'     },
]

function DealCard({
  deal,
  onMove,
}: {
  deal: DealWithClient
  onMove: (id: string, status: Status) => void
}) {
  const actions: { label: string; status: Status; variant: 'default' | 'outline' | 'destructive' }[] =
    deal.status === 'open'
      ? [
          { label: 'Marcar Ganho',   status: 'won',  variant: 'default'     },
          { label: 'Marcar Perdido', status: 'lost', variant: 'destructive' },
        ]
      : [{ label: 'Reabrir', status: 'open', variant: 'outline' }]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2 shadow-sm">
      <p className="font-medium text-gray-800 text-sm">{deal.displayName}</p>
      <p className="text-sm text-gray-600">{formatCurrency(Number(deal.value))}</p>
      <div className="flex gap-1 flex-wrap pt-1">
        {actions.map((a) => (
          <Button
            key={a.status}
            size="sm"
            variant={a.variant}
            className="text-xs h-7"
            onClick={() => onMove(deal.id, a.status)}
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function KanbanClient({
  deals,
  clients,
}: {
  deals: DealWithClient[]
  clients: Client[]
}) {
  const [localDeals, setLocalDeals] = useState(deals)
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [newDealState, newDealAction] = useFormState(createDeal, { error: null })
  const [, startTransition] = useTransition()

  function handleMove(id: string, newStatus: Status) {
    startTransition(async () => {
      await moveDeal(id, newStatus)
      setLocalDeals((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: newStatus } : d))
      )
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNewDealOpen(true)}>+ Novo Deal</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const colDeals = localDeals.filter((d) => d.status === col.status)
          const colTotal = colDeals.reduce((s, d) => s + Number(d.value), 0)
          return (
            <div key={col.status} className={`rounded-lg border p-3 space-y-3 ${col.bg}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">{col.label}</h3>
                <span className="text-xs text-gray-500">
                  {colDeals.length} · {formatCurrency(colTotal)}
                </span>
              </div>
              {colDeals.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Nenhum deal</p>
              ) : (
                colDeals.map((d) => <DealCard key={d.id} deal={d} onMove={handleMove} />)
              )}
            </div>
          )
        })}
      </div>

      <Modal title="Novo Deal" isOpen={newDealOpen} onClose={() => setNewDealOpen(false)}>
        <form
          action={async (fd: FormData) => {
            const r = await createDeal({ error: null }, fd)
            if (!r.error) {
              setNewDealOpen(false)
              window.location.reload()
            } else {
              newDealAction(fd)
            }
          }}
          className="space-y-3 mt-2"
        >
          <select
            name="client_id"
            required
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecionar cliente...</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` — ${c.company}` : ''}
              </option>
            ))}
          </select>
          <Input name="value" type="number" placeholder="Valor (R$)" min="0.01" step="0.01" required />
          {newDealState.error && (
            <p className="text-sm text-red-600">{newDealState.error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewDealOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Criar Deal</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
