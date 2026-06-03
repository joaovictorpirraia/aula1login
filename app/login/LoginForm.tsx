// app/login/LoginForm.tsx
'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { signIn } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const initialState = { error: null }

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Entrando...' : 'Entrar'}
    </Button>
  )
}

export function LoginForm() {
  const [state, formAction] = useFormState(signIn, initialState)

  return (
    <Card className="w-full max-w-md shadow-sm border border-gray-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-semibold text-center text-gray-800">
          CRM Vendas
        </CardTitle>
        <p className="text-sm text-center text-gray-500">
          Acesse sua conta para continuar
        </p>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <Input
            type="email"
            name="email"
            placeholder="E-mail"
            required
            autoComplete="email"
            className="w-full"
          />
          <Input
            type="password"
            name="password"
            placeholder="Senha"
            required
            autoComplete="current-password"
            className="w-full"
          />
          {state?.error && (
            <p className="text-sm text-red-600 text-center" role="alert">
              {state.error}
            </p>
          )}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  )
}
