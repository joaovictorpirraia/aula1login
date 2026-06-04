// app/login/LoginForm.tsx
'use client'

import { useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { signIn, signUp } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function SubmitButton({ label, loadingLabel }: { label: string; loadingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? loadingLabel : label}
    </Button>
  )
}

const loginInitial = { error: null }
const signUpInitial = { error: null, success: null }

export function LoginForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loginState, loginAction] = useFormState(signIn, loginInitial)
  const [signUpState, signUpAction] = useFormState(signUp, signUpInitial)

  return (
    <Card className="w-full max-w-md shadow-sm border border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-semibold text-center text-gray-800">
          CRM Vendas
        </CardTitle>
        <p className="text-sm text-center text-gray-500">
          {mode === 'login' ? 'Acesse sua conta para continuar' : 'Crie sua conta'}
        </p>
      </CardHeader>
      <CardContent>

        {mode === 'login' ? (
          <form action={loginAction} className="space-y-4">
            <Input type="email" name="email" placeholder="E-mail" required autoComplete="email" />
            <Input type="password" name="password" placeholder="Senha" required autoComplete="current-password" />
            {loginState?.error && (
              <p className="text-sm text-red-600 text-center" role="alert">{loginState.error}</p>
            )}
            <SubmitButton label="Entrar" loadingLabel="Entrando..." />
            <p className="text-sm text-center text-gray-500">
              Não tem conta?{' '}
              <button type="button" onClick={() => setMode('signup')} className="text-blue-600 hover:underline font-medium">
                Criar conta
              </button>
            </p>
          </form>
        ) : (
          <form action={signUpAction} className="space-y-4">
            <Input type="email" name="email" placeholder="E-mail" required autoComplete="email" />
            <Input type="password" name="password" placeholder="Senha (mín. 6 caracteres)" required autoComplete="new-password" />
            {signUpState?.error && (
              <p className="text-sm text-red-600 text-center" role="alert">{signUpState.error}</p>
            )}
            {signUpState?.success && (
              <p className="text-sm text-green-600 text-center" role="status">{signUpState.success}</p>
            )}
            <SubmitButton label="Criar conta" loadingLabel="Criando..." />
            <p className="text-sm text-center text-gray-500">
              Já tem conta?{' '}
              <button type="button" onClick={() => setMode('login')} className="text-blue-600 hover:underline font-medium">
                Fazer login
              </button>
            </p>
          </form>
        )}

      </CardContent>
    </Card>
  )
}
