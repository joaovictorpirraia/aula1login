'use client'

import { useState, useMemo } from 'react'
import { useFormState } from 'react-dom'
import type { Client } from './queries'
import { createClient, updateClient, deleteClient } from './actions'
import { Modal } from '../components/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

function ClientForm({
  initial,
  action,
  onSuccess,
}: {
  initial?: Client
  action: (prev: { error: string | null }, fd: FormData) => Promise<{ error: string | null }>
  onSuccess: () => void
}) {
  const [state, formAction] = useFormState(action, { error: null })

  return (
    <form
      action={async (fd: FormData) => {
        const r = await action({ error: null }, fd)
        if (!r.error) onSuccess()
        else formAction(fd)
      }}
      className="space-y-3 mt-2"
    >
      <Input name="name" placeholder="Nome*" defaultValue={initial?.name} required />
      <Input name="company" placeholder="Empresa" defaultValue={initial?.company ?? ''} />
      <Input name="email" type="email" placeholder="E-mail" defaultValue={initial?.email ?? ''} />
      <Input name="phone" placeholder="Telefone" defaultValue={initial?.phone ?? ''} />
      <textarea
        name="notes"
        placeholder="Notas"
        defaultValue={initial?.notes ?? ''}
        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  )
}

export function ClientesClient({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients] = useState(initialClients)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.company ?? '').toLowerCase().includes(search.toLowerCase())
      ),
    [clients, search]
  )

  async function handleDelete(id: string) {
    await deleteClient(id)
    setClients((prev) => prev.filter((c) => c.id !== id))
    setConfirming(null)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Input
          placeholder="Buscar por nome ou empresa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => setCreating(true)}>+ Novo Cliente</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Nome', 'Empresa', 'E-mail', 'Telefone', 'Ações'].map((h) => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.company ?? '–'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email ?? '–'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone ?? '–'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setConfirming(c.id)}>
                        Excluir
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal title="Novo Cliente" isOpen={creating} onClose={() => setCreating(false)}>
        <ClientForm
          action={createClient}
          onSuccess={() => {
            setCreating(false)
            window.location.reload()
          }}
        />
      </Modal>

      <Modal title="Editar Cliente" isOpen={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <ClientForm
            initial={editing}
            action={(prev, fd) => updateClient(editing.id, prev, fd)}
            onSuccess={() => {
              setEditing(null)
              window.location.reload()
            }}
          />
        )}
      </Modal>

      <Modal title="Confirmar exclusão" isOpen={!!confirming} onClose={() => setConfirming(null)}>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-gray-600">
            Tem certeza que deseja excluir este cliente? Os deals vinculados serão mantidos mas
            perderão a associação com este cliente.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirming && handleDelete(confirming)}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
