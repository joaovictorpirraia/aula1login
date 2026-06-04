'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function createClient(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Nome é obrigatório.' }

  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const { error } = await supabase.from('clients').insert({
    user_id: user.id,
    name,
    company: (formData.get('company') as string) || null,
    email:   (formData.get('email')   as string) || null,
    phone:   (formData.get('phone')   as string) || null,
    notes:   (formData.get('notes')   as string) || null,
  }).select()

  if (error) return { error: error.message }
  revalidatePath('/clientes')
  return { error: null }
}

export async function updateClient(
  id: string,
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Nome é obrigatório.' }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('clients').update({
    name,
    company: (formData.get('company') as string) || null,
    email:   (formData.get('email')   as string) || null,
    phone:   (formData.get('phone')   as string) || null,
    notes:   (formData.get('notes')   as string) || null,
  }).eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/clientes')
  return { error: null }
}

export async function deleteClient(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/clientes')
}
