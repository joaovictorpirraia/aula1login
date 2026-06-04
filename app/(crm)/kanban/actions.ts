'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['open', 'won', 'lost'] as const
type Status = (typeof VALID_STATUSES)[number]

export async function moveDeal(id: string, newStatus: Status): Promise<void> {
  if (!VALID_STATUSES.includes(newStatus)) throw new Error('Status inválido')
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('deals').update({ status: newStatus }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/kanban')
}

export async function createDeal(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const clientId = formData.get('client_id') as string
  const value = Number(formData.get('value'))

  if (!clientId) return { error: 'Selecione um cliente.' }
  if (!value || value <= 0) return { error: 'Valor deve ser maior que zero.' }

  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase.from('deals').insert({
    user_id: user.id,
    client_id: clientId,
    value,
    status: 'open',
  })

  if (error) return { error: error.message }
  revalidatePath('/kanban')
  return { error: null }
}
