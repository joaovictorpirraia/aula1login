'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'

export async function saveMeta(
  _prev: { error: string | null; success: string | null },
  formData: FormData
): Promise<{ error: string | null; success: string | null }> {
  const valueRaw = formData.get('goal_value') as string
  const month    = formData.get('month') as string
  const value    = Number(valueRaw)

  if (!value || value <= 0) return { error: 'Meta deve ser maior que zero.', success: null }
  if (!month) return { error: 'Mês inválido.', success: null }

  // user_id sempre da sessão server-side — nunca do input do usuário
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.', success: null }

  // Admin client necessário pois monthly_goals não tem política RLS de escrita para usuários
  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('monthly_goals').upsert(
    { user_id: user.id, month, goal_value: value },
    { onConflict: 'user_id,month' }
  )

  if (error) return { error: error.message, success: null }
  revalidatePath('/configuracoes')
  return { error: null, success: 'Meta salva com sucesso!' }
}
