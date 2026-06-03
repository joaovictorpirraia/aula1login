// app/login/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function signIn(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Preencha e-mail e senha.' }
  }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'E-mail ou senha inválidos.' }
  }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = createSupabaseServerClient()
  await supabase.auth.signOut()
  redirect('/login')
}
