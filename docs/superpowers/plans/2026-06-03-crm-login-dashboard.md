# CRM Login + Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um CRM de vendas com autenticação por vendedor e dashboard de métricas (total de vendas, negócios abertos, meta do mês, gráfico e tabela) usando Next.js 14 + Supabase self-hosted.

**Architecture:** Next.js 14 App Router com Server Components; autenticação via @supabase/ssr com cookies seguros; PostgreSQL com RLS garantindo isolamento de dados por usuário; force-dynamic no dashboard garante dados frescos por request sem risco de cache compartilhado entre usuários; React.cache() deduplica queries dentro do mesmo render.

> **Nota sobre cache:** O spec recomenda `unstable_cache` com user_id na key, mas essa abordagem requer passar o JWT como parâmetro (o token rotaciona a cada request com @supabase/ssr, tornando o cache ineficaz) ou usar service role (proibido pelo spec). A implementação usa `force-dynamic` + `React.cache()` — correto, seguro, e sem vazamento entre usuários.

**Tech Stack:** Next.js 14, TypeScript, @supabase/ssr, @supabase/supabase-js, Tailwind CSS, shadcn/ui, Recharts, Jest, @testing-library/react

---

## Estrutura de Arquivos

```
/                                    ← raiz do projeto Next.js
├── app/
│   ├── layout.tsx                   # Root layout (fonte Inter, metadata)
│   ├── login/
│   │   ├── page.tsx                 # Login page (Server Component)
│   │   ├── LoginForm.tsx            # Formulário de login (Client Component)
│   │   └── actions.ts               # signIn, signOut Server Actions
│   └── dashboard/
│       ├── page.tsx                 # Dashboard (Server Component, force-dynamic)
│       ├── queries.ts               # 5 queries com React.cache()
│       └── components/
│           ├── Header.tsx           # Header com email + logout
│           ├── MetricCards.tsx      # 3 cards de métricas
│           ├── SalesChart.tsx       # Gráfico Recharts (Client Component)
│           └── DealsTable.tsx       # Tabela de deals recentes
├── lib/
│   ├── supabase/
│   │   ├── server.ts               # createSupabaseServerClient
│   │   └── middleware.ts            # updateSession
│   └── utils/
│       └── dates.ts                 # getMonthBoundariesUTC, formatCurrency
├── middleware.ts                    # Middleware raiz com matcher
├── supabase/
│   └── migrations/
│       ├── 001_create_deals.sql
│       ├── 002_create_monthly_goals.sql
│       ├── 003_create_trigger.sql
│       ├── 004_create_indexes.sql
│       └── 005_rls_policies.sql
├── __tests__/
│   ├── lib/utils/dates.test.ts
│   ├── app/dashboard/queries.test.ts
│   └── app/dashboard/components/
│       ├── MetricCards.test.tsx
│       ├── SalesChart.test.tsx
│       └── DealsTable.test.tsx
├── .env.local.example
├── jest.config.ts
├── jest.setup.ts
└── Dockerfile
```

---

## Task 1: Inicialização do Projeto

**Files:**
- Create: `package.json` (gerado pelo create-next-app)
- Create: `.env.local.example`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Criar o projeto Next.js 14 com TypeScript e Tailwind**

```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir no --import-alias "@/*"
```

Responder ao prompt:
- Would you like to use Turbopack? → No

- [ ] **Step 2: Instalar dependências**

```bash
npm install @supabase/supabase-js @supabase/ssr recharts
npm install --save-dev jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

- [ ] **Step 3: Inicializar shadcn/ui**

```bash
npx shadcn@latest init
```

Responder:
- Which style would you like to use? → Default
- Which color would you like to use as base color? → Slate
- Would you like to use CSS variables? → Yes

Depois instalar os componentes necessários:

```bash
npx shadcn@latest add button input card badge progress
```

- [ ] **Step 4: Criar arquivo de variáveis de ambiente de exemplo**

Criar `.env.local.example`:

```
NEXT_PUBLIC_SUPABASE_URL=http://seu-supabase-host:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=seu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=seu-service-role-key-aqui
```

Criar `.env.local` copiando o exemplo e preenchendo com os valores reais do EasyPanel.

- [ ] **Step 5: Criar jest.config.ts**

```typescript
// jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
```

- [ ] **Step 6: Criar jest.setup.ts**

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Adicionar script de teste ao package.json**

Abrir `package.json` e adicionar em `"scripts"`:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 8: Verificar que o projeto compila**

```bash
npm run build
```

Esperado: build sem erros.

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: project setup with Next.js 14, Supabase, shadcn/ui, Jest"
```

---

## Task 2: Migrações do Banco de Dados

**Files:**
- Create: `supabase/migrations/001_create_deals.sql`
- Create: `supabase/migrations/002_create_monthly_goals.sql`
- Create: `supabase/migrations/003_create_trigger.sql`
- Create: `supabase/migrations/004_create_indexes.sql`
- Create: `supabase/migrations/005_rls_policies.sql`

- [ ] **Step 1: Criar migration da tabela deals**

```sql
-- supabase/migrations/001_create_deals.sql
CREATE TABLE IF NOT EXISTS deals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id),
  client_name  text NOT NULL,
  value        numeric(12, 2) NOT NULL,
  status       text NOT NULL CHECK (status IN ('open', 'won', 'lost')),
  created_at   timestamp DEFAULT now(),
  closed_at    timestamp,
  closed_date  date,
  updated_at   timestamp DEFAULT now()
);
```

- [ ] **Step 2: Criar migration da tabela monthly_goals**

```sql
-- supabase/migrations/002_create_monthly_goals.sql
CREATE TABLE IF NOT EXISTS monthly_goals (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  month       date NOT NULL,
  goal_value  numeric(12, 2) NOT NULL,
  CONSTRAINT uq_user_month UNIQUE (user_id, month),
  CONSTRAINT chk_month_first_day CHECK (month = date_trunc('month', month)::date)
);
```

- [ ] **Step 3: Criar migration do trigger**

```sql
-- supabase/migrations/003_create_trigger.sql
CREATE OR REPLACE FUNCTION set_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('won', 'lost') THEN
    IF NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    END IF;
    NEW.closed_date := (NEW.closed_at AT TIME ZONE 'UTC')::date;
    NEW.updated_at  := now();
  ELSIF NEW.status = 'open' THEN
    NEW.closed_at   := NULL;
    NEW.closed_date := NULL;
    NEW.updated_at  := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_closed_at
BEFORE INSERT OR UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION set_closed_at();
```

- [ ] **Step 4: Criar migration dos índices**

```sql
-- supabase/migrations/004_create_indexes.sql
CREATE INDEX IF NOT EXISTS idx_deals_user_status_date
  ON deals (user_id, status, closed_date);

CREATE INDEX IF NOT EXISTS idx_deals_user_created
  ON deals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_goals_user_month
  ON monthly_goals (user_id, month);
```

- [ ] **Step 5: Criar migration das políticas RLS**

```sql
-- supabase/migrations/005_rls_policies.sql

-- Deals
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals: leitura própria"
  ON deals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "deals: escrita própria"
  ON deals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "deals: atualização própria"
  ON deals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Monthly Goals (sem DELETE/INSERT/UPDATE para usuários — admin usa service role)
ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals: leitura própria"
  ON monthly_goals FOR SELECT
  USING (auth.uid() = user_id);
```

- [ ] **Step 6: Executar as migrations no Supabase Studio**

Abrir o Supabase Studio (ex: `http://seu-easypanel-host:3000`), ir em SQL Editor, e executar cada arquivo na ordem: 001 → 002 → 003 → 004 → 005.

Verificar no Table Editor que as tabelas `deals` e `monthly_goals` foram criadas corretamente.

- [ ] **Step 7: Commit**

```bash
git add supabase/
git commit -m "feat: database migrations for deals, monthly_goals, trigger, indexes, and RLS"
```

---

## Task 3: Utilitários Supabase e Datas

**Files:**
- Create: `lib/supabase/server.ts`
- Create: `lib/supabase/middleware.ts`
- Create: `lib/utils/dates.ts`
- Create: `__tests__/lib/utils/dates.test.ts`

- [ ] **Step 1: Escrever o teste para dates.ts**

```typescript
// __tests__/lib/utils/dates.test.ts
import { getMonthBoundariesUTC, formatCurrency } from '@/lib/utils/dates'

describe('getMonthBoundariesUTC', () => {
  it('returns start as first day of current month at midnight UTC', () => {
    const { start } = getMonthBoundariesUTC()
    expect(start.getUTCDate()).toBe(1)
    expect(start.getUTCHours()).toBe(0)
    expect(start.getUTCMinutes()).toBe(0)
    expect(start.getUTCSeconds()).toBe(0)
  })

  it('returns end as first day of next month at midnight UTC', () => {
    const { start, end } = getMonthBoundariesUTC()
    const expectedEndMonth = (start.getUTCMonth() + 1) % 12
    expect(end.getUTCDate()).toBe(1)
    expect(end.getUTCMonth()).toBe(expectedEndMonth)
    expect(end.getUTCHours()).toBe(0)
  })

  it('end is exactly one month after start', () => {
    const { start, end } = getMonthBoundariesUTC()
    const diffMs = end.getTime() - start.getTime()
    const daysInMonth = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)
    ).getUTCDate()
    expect(diffMs).toBe(daysInMonth * 24 * 60 * 60 * 1000)
  })

  it('start date string format is YYYY-MM-01', () => {
    const { start } = getMonthBoundariesUTC()
    const str = start.toISOString().split('T')[0]
    expect(str).toMatch(/^\d{4}-\d{2}-01$/)
  })
})

describe('formatCurrency', () => {
  it('formats number as BRL currency', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1.234,56')
  })

  it('formats zero correctly', () => {
    const result = formatCurrency(0)
    expect(result).toContain('0,00')
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npm test -- --testPathPattern="dates.test"
```

Esperado: FAIL com "Cannot find module '@/lib/utils/dates'"

- [ ] **Step 3: Implementar dates.ts**

```typescript
// lib/utils/dates.ts
export function getMonthBoundariesUTC(): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { start, end }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
npm test -- --testPathPattern="dates.test"
```

Esperado: PASS (4 testes)

- [ ] **Step 5: Criar o cliente Supabase server-side**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignorado em Server Components (apenas Middleware/Server Actions podem setar cookies)
          }
        },
      },
    }
  )
}
```

- [ ] **Step 6: Criar o cliente Supabase para middleware**

```typescript
// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

- [ ] **Step 7: Commit**

```bash
git add lib/ __tests__/lib/
git commit -m "feat: Supabase clients, date utilities with tests"
```

---

## Task 4: Middleware de Autenticação

**Files:**
- Create: `middleware.ts` (raiz do projeto)

- [ ] **Step 1: Criar o middleware raiz**

```typescript
// middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|login$|login/).*)',
  ],
}
```

- [ ] **Step 2: Verificar o matcher manualmente**

Confirmar que o regex exclui apenas `/login` e não rotas como `/loginpage`:

```bash
node -e "
const pattern = /^\/((?!_next\/static|_next\/image|favicon\.ico|login\$|login\/).*)$/
console.log('/login:', pattern.test('/login'))           // deve ser false (excluído)
console.log('/dashboard:', pattern.test('/dashboard'))   // deve ser true (protegido)
console.log('/loginpage:', pattern.test('/loginpage'))   // deve ser true (protegido)
console.log('/:', pattern.test('/'))                     // deve ser true (protegido)
"
```

Esperado:
```
/login: false
/dashboard: true
/loginpage: true
/: true
```

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: auth middleware protecting all routes except /login"
```

---

## Task 5: Login Page e Server Action

**Files:**
- Create: `app/login/actions.ts`
- Create: `app/login/LoginForm.tsx`
- Create: `app/login/page.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Criar o Server Action de login**

```typescript
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
```

- [ ] **Step 2: Criar o formulário de login (Client Component)**

```tsx
// app/login/LoginForm.tsx
'use client'

import { useActionState } from 'react'
import { signIn } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const initialState = { error: null }

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState)

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
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

> **Nota:** `useActionState` requer React 19. Se o projeto usar React 18, substituir por `useFormState` de `react-dom` com a mesma assinatura.

- [ ] **Step 3: Criar a página de login (Server Component)**

```tsx
// app/login/page.tsx
import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <LoginForm />
    </div>
  )
}
```

- [ ] **Step 4: Atualizar o layout raiz com a fonte Inter**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CRM Vendas',
  description: 'Sistema de gestão de vendas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Testar a tela de login no navegador**

```bash
npm run dev
```

Abrir `http://localhost:3000/login`. Verificar:
- Card centralizado com campos e-mail e senha
- Botão "Entrar" funcional
- Tentativa com credenciais inválidas → mensagem de erro exibida
- Tentativa com credenciais válidas (usuário criado no Supabase Studio) → redireciona para `/dashboard`

- [ ] **Step 6: Commit**

```bash
git add app/login/ app/layout.tsx
git commit -m "feat: login page with server action and error handling"
```

---

## Task 6: Queries do Dashboard

**Files:**
- Create: `app/dashboard/queries.ts`
- Create: `__tests__/app/dashboard/queries.test.ts`

- [ ] **Step 1: Escrever os testes para queries.ts**

```typescript
// __tests__/app/dashboard/queries.test.ts
import { getTotalSales, getOpenDealsCount, getMonthlyGoal, getChartData, getRecentDeals } from '@/app/dashboard/queries'

// Mock do cliente Supabase
const mockFrom = jest.fn()
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockGte = jest.fn()
const mockLt = jest.fn()
const mockOrder = jest.fn()
const mockLimit = jest.fn()
const mockMaybeSingle = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => ({
    from: mockFrom,
  }),
}))

function chainMock(finalReturn: object) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(finalReturn),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.gte.mockReturnValue(chain)
  chain.lt.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.limit.mockReturnValue(chain)
  return chain
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getTotalSales', () => {
  it('returns sum of won deals values', async () => {
    const chain = chainMock({ data: null, error: null })
    chain.lt.mockResolvedValue({ data: [{ value: '1000.00' }, { value: '500.50' }], error: null })
    mockFrom.mockReturnValue(chain)

    const result = await getTotalSales()
    expect(typeof result).toBe('number')
  })

  it('returns 0 when no won deals', async () => {
    const chain = chainMock({ data: null, error: null })
    chain.lt.mockResolvedValue({ data: [], error: null })
    mockFrom.mockReturnValue(chain)

    const result = await getTotalSales()
    expect(result).toBe(0)
  })
})

describe('getOpenDealsCount', () => {
  it('returns count of open deals', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ count: 7, error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const result = await getOpenDealsCount()
    expect(result).toBe(7)
  })

  it('returns 0 when count is null', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ count: null, error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const result = await getOpenDealsCount()
    expect(result).toBe(0)
  })
})

describe('getMonthlyGoal', () => {
  it('returns goal value when row exists', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { goal_value: '10000.00' }, error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const result = await getMonthlyGoal()
    expect(result).toBe(10000)
  })

  it('returns null when no goal defined', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const result = await getMonthlyGoal()
    expect(result).toBeNull()
  })
})

describe('getRecentDeals', () => {
  it('returns array of deals', async () => {
    const deals = [
      { id: '1', client_name: 'Empresa A', value: '5000', status: 'won', created_at: '2026-06-01' },
    ]
    const chain = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: deals, error: null }),
    }
    mockFrom.mockReturnValue(chain)

    const result = await getRecentDeals()
    expect(result).toHaveLength(1)
    expect(result[0].client_name).toBe('Empresa A')
  })
})
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npm test -- --testPathPattern="queries.test"
```

Esperado: FAIL com "Cannot find module '@/app/dashboard/queries'"

- [ ] **Step 3: Implementar queries.ts**

```typescript
// app/dashboard/queries.ts
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMonthBoundariesUTC } from '@/lib/utils/dates'

export const getTotalSales = cache(async (): Promise<number> => {
  const supabase = createSupabaseServerClient()
  const { start, end } = getMonthBoundariesUTC()
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('deals')
    .select('value')
    .eq('status', 'won')
    .gte('closed_date', startStr)
    .lt('closed_date', endStr)

  if (error) throw new Error(error.message)
  return (data ?? []).reduce((sum, d) => sum + Number(d.value), 0)
})

export const getOpenDealsCount = cache(async (): Promise<number> => {
  const supabase = createSupabaseServerClient()

  const { count, error } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open')

  if (error) throw new Error(error.message)
  return count ?? 0
})

export const getMonthlyGoal = cache(async (): Promise<number | null> => {
  const supabase = createSupabaseServerClient()
  const { start } = getMonthBoundariesUTC()
  const monthKey = start.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('monthly_goals')
    .select('goal_value')
    .eq('month', monthKey)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data?.goal_value ? Number(data.goal_value) : null
})

export const getChartData = cache(async (): Promise<{ date: string; total: number }[]> => {
  const supabase = createSupabaseServerClient()
  const { start, end } = getMonthBoundariesUTC()
  const startStr = start.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('deals')
    .select('value, closed_date')
    .eq('status', 'won')
    .gte('closed_date', startStr)
    .lt('closed_date', endStr)
    .order('closed_date', { ascending: true })

  if (error) throw new Error(error.message)

  const grouped: Record<string, number> = {}
  for (const deal of data ?? []) {
    const day = deal.closed_date as string
    grouped[day] = (grouped[day] ?? 0) + Number(deal.value)
  }

  return Object.entries(grouped).map(([date, total]) => ({ date, total }))
})

export const getRecentDeals = cache(async () => {
  const supabase = createSupabaseServerClient()

  const { data, error } = await supabase
    .from('deals')
    .select('id, client_name, value, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw new Error(error.message)
  return data ?? []
})
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npm test -- --testPathPattern="queries.test"
```

Esperado: PASS (6+ testes)

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/queries.ts __tests__/app/dashboard/queries.test.ts
git commit -m "feat: dashboard queries with React.cache and tests"
```

---

## Task 7: Componente Header

**Files:**
- Create: `app/dashboard/components/Header.tsx`

- [ ] **Step 1: Criar o componente Header**

```tsx
// app/dashboard/components/Header.tsx
import { signOut } from '@/app/login/actions'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  userEmail: string
}

export function Header({ userEmail }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-semibold text-gray-800">CRM Vendas</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:block">{userEmail}</span>
          <form action={signOut}>
            <Button variant="outline" size="sm" type="submit">
              Sair
            </Button>
          </form>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/components/Header.tsx
git commit -m "feat: dashboard Header component with logout"
```

---

## Task 8: Componente MetricCards

**Files:**
- Create: `app/dashboard/components/MetricCards.tsx`
- Create: `__tests__/app/dashboard/components/MetricCards.test.tsx`

- [ ] **Step 1: Escrever os testes**

```tsx
// __tests__/app/dashboard/components/MetricCards.test.tsx
import { render, screen } from '@testing-library/react'
import { MetricCards } from '@/app/dashboard/components/MetricCards'

describe('MetricCards', () => {
  it('renders total sales formatted as BRL', () => {
    render(<MetricCards totalSales={48200} openDeals={7} goal={60000} />)
    expect(screen.getByText(/48\.200/)).toBeInTheDocument()
  })

  it('renders open deals count', () => {
    render(<MetricCards totalSales={0} openDeals={7} goal={null} />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders "Sem meta definida" when goal is null', () => {
    render(<MetricCards totalSales={0} openDeals={0} goal={null} />)
    expect(screen.getByText('Sem meta definida')).toBeInTheDocument()
  })

  it('renders progress bar when goal is set', () => {
    render(<MetricCards totalSales={30000} openDeals={0} goal={60000} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('caps progress at 100% when sales exceed goal', () => {
    render(<MetricCards totalSales={80000} openDeals={0} goal={60000} />)
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npm test -- --testPathPattern="MetricCards.test"
```

Esperado: FAIL com "Cannot find module"

- [ ] **Step 3: Implementar MetricCards.tsx**

```tsx
// app/dashboard/components/MetricCards.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils/dates'

interface MetricCardsProps {
  totalSales: number
  openDeals: number
  goal: number | null
}

export function MetricCards({ totalSales, openDeals, goal }: MetricCardsProps) {
  const progress = goal ? Math.min(Math.round((totalSales / goal) * 100), 100) : 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            Total de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-gray-800">
            {formatCurrency(totalSales)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Mês atual</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            Negócios Abertos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-gray-800">{openDeals}</p>
          <p className="text-xs text-gray-400 mt-1">Em andamento</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-500">
            Meta do Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          {goal === null ? (
            <p className="text-sm text-gray-400">Sem meta definida</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl font-bold text-gray-800">{progress}%</span>
                <span className="text-xs text-gray-400">{formatCurrency(goal)}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npm test -- --testPathPattern="MetricCards.test"
```

Esperado: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/components/MetricCards.tsx __tests__/app/dashboard/components/MetricCards.test.tsx
git commit -m "feat: MetricCards component with tests"
```

---

## Task 9: Componente SalesChart

**Files:**
- Create: `app/dashboard/components/SalesChart.tsx`
- Create: `__tests__/app/dashboard/components/SalesChart.test.tsx`

- [ ] **Step 1: Escrever os testes**

```tsx
// __tests__/app/dashboard/components/SalesChart.test.tsx
import { render, screen } from '@testing-library/react'
import { SalesChart } from '@/app/dashboard/components/SalesChart'

// Recharts usa ResizeObserver que não existe no jsdom
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

const mockData = [
  { date: '2026-06-01', total: 5000 },
  { date: '2026-06-05', total: 3200 },
  { date: '2026-06-10', total: 8000 },
]

describe('SalesChart', () => {
  it('renders chart title', () => {
    render(<SalesChart data={mockData} />)
    expect(screen.getByText('Vendas do Mês')).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    render(<SalesChart data={[]} />)
    expect(screen.getByText('Nenhuma venda fechada este mês.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npm test -- --testPathPattern="SalesChart.test"
```

Esperado: FAIL com "Cannot find module"

- [ ] **Step 3: Implementar SalesChart.tsx**

```tsx
// app/dashboard/components/SalesChart.tsx
'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/dates'

interface SalesChartProps {
  data: { date: string; total: number }[]
}

function formatDate(dateStr: string): string {
  const [, , day] = dateStr.split('-')
  return `${parseInt(day)}`
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded p-2 shadow-sm text-sm">
      <p className="text-gray-500">Dia {label}</p>
      <p className="font-semibold text-gray-800">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function SalesChart({ data }: SalesChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-700">
          Vendas do Mês
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Nenhuma venda fechada este mês.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npm test -- --testPathPattern="SalesChart.test"
```

Esperado: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/components/SalesChart.tsx __tests__/app/dashboard/components/SalesChart.test.tsx
git commit -m "feat: SalesChart component with Recharts and tests"
```

---

## Task 10: Componente DealsTable

**Files:**
- Create: `app/dashboard/components/DealsTable.tsx`
- Create: `__tests__/app/dashboard/components/DealsTable.test.tsx`

- [ ] **Step 1: Escrever os testes**

```tsx
// __tests__/app/dashboard/components/DealsTable.test.tsx
import { render, screen } from '@testing-library/react'
import { DealsTable } from '@/app/dashboard/components/DealsTable'

const mockDeals = [
  { id: '1', client_name: 'Empresa Alpha', value: '12000.00', status: 'won', created_at: '2026-06-01T10:00:00' },
  { id: '2', client_name: 'Empresa Beta', value: '8500.50', status: 'open', created_at: '2026-05-28T14:30:00' },
  { id: '3', client_name: 'Empresa Gama', value: '3000.00', status: 'lost', created_at: '2026-05-20T09:00:00' },
]

describe('DealsTable', () => {
  it('renders client names', () => {
    render(<DealsTable deals={mockDeals} />)
    expect(screen.getByText('Empresa Alpha')).toBeInTheDocument()
    expect(screen.getByText('Empresa Beta')).toBeInTheDocument()
  })

  it('renders won badge with green style', () => {
    render(<DealsTable deals={mockDeals} />)
    const badge = screen.getByText('Ganho')
    expect(badge).toBeInTheDocument()
  })

  it('renders open badge', () => {
    render(<DealsTable deals={mockDeals} />)
    expect(screen.getByText('Aberto')).toBeInTheDocument()
  })

  it('renders lost badge', () => {
    render(<DealsTable deals={mockDeals} />)
    expect(screen.getByText('Perdido')).toBeInTheDocument()
  })

  it('renders empty state when no deals', () => {
    render(<DealsTable deals={[]} />)
    expect(screen.getByText('Nenhum negócio encontrado.')).toBeInTheDocument()
  })

  it('renders formatted currency values', () => {
    render(<DealsTable deals={mockDeals} />)
    expect(screen.getByText(/12\.000/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar testes para confirmar que falham**

```bash
npm test -- --testPathPattern="DealsTable.test"
```

Esperado: FAIL com "Cannot find module"

- [ ] **Step 3: Implementar DealsTable.tsx**

```tsx
// app/dashboard/components/DealsTable.tsx
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/dates'

type Deal = {
  id: string
  client_name: string
  value: string | number
  status: 'open' | 'won' | 'lost'
  created_at: string
}

interface DealsTableProps {
  deals: Deal[]
}

const STATUS_LABELS: Record<string, string> = {
  won: 'Ganho',
  open: 'Aberto',
  lost: 'Perdido',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive'> = {
  won: 'default',
  open: 'secondary',
  lost: 'destructive',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function DealsTable({ deals }: DealsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-700">
          Negócios Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Nenhum negócio encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 font-medium text-gray-500">Cliente</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Valor</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-500">Status</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-500">Data</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr
                    key={deal.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-3 text-gray-800">{deal.client_name}</td>
                    <td className="py-3 px-3 text-right text-gray-800 font-medium">
                      {formatCurrency(Number(deal.value))}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={STATUS_VARIANTS[deal.status]}>
                        {STATUS_LABELS[deal.status]}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-500">
                      {formatDate(deal.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: Rodar testes para confirmar que passam**

```bash
npm test -- --testPathPattern="DealsTable.test"
```

Esperado: PASS (6 testes)

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/components/DealsTable.tsx __tests__/app/dashboard/components/DealsTable.test.tsx
git commit -m "feat: DealsTable component with status badges and tests"
```

---

## Task 11: Página do Dashboard (Montagem Final)

**Files:**
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Criar a página do dashboard**

```tsx
// app/dashboard/page.tsx
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Header } from './components/Header'
import { MetricCards } from './components/MetricCards'
import { SalesChart } from './components/SalesChart'
import { DealsTable } from './components/DealsTable'
import {
  getTotalSales,
  getOpenDealsCount,
  getMonthlyGoal,
  getChartData,
  getRecentDeals,
} from './queries'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [totalSales, openDeals, goal, chartData, recentDeals] = await Promise.all([
    getTotalSales(),
    getOpenDealsCount(),
    getMonthlyGoal(),
    getChartData(),
    getRecentDeals(),
  ])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userEmail={user.email ?? ''} />
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <MetricCards
          totalSales={totalSales}
          openDeals={openDeals}
          goal={goal}
        />
        <SalesChart data={chartData} />
        <DealsTable deals={recentDeals} />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Rodar todos os testes**

```bash
npm test
```

Esperado: todos PASS, zero falhas.

- [ ] **Step 3: Verificar o dashboard no navegador**

```bash
npm run dev
```

1. Acessar `http://localhost:3000` — deve redirecionar para `/login`
2. Fazer login com um usuário existente no Supabase Studio
3. Verificar no dashboard:
   - 3 cards de métricas visíveis
   - Gráfico com dados do mês (ou estado vazio se não há deals)
   - Tabela de negócios recentes
   - Botão "Sair" funciona e redireciona para `/login`
4. Inserir um deal diretamente no Supabase Studio com `status='won'` e verificar que `closed_date` foi preenchido pelo trigger

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: dashboard page assembly with parallel queries"
```

---

## Task 12: Dockerfile para Deploy no EasyPanel

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Criar o .dockerignore**

```
# .dockerignore
node_modules
.next
.git
.env.local
*.md
__tests__
```

- [ ] **Step 2: Criar o Dockerfile multi-stage**

```dockerfile
# Dockerfile

# Stage 1: Dependências
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Produção
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

- [ ] **Step 3: Habilitar output standalone no next.config.js**

Abrir `next.config.js` (ou `next.config.ts`) e adicionar:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

module.exports = nextConfig
```

- [ ] **Step 4: Verificar o build Docker localmente**

```bash
docker build -t crm-vendas .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=http://seu-supabase-host:8000 \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=seu-anon-key \
  crm-vendas
```

Abrir `http://localhost:3000` e verificar que o login funciona.

- [ ] **Step 5: Commit final**

```bash
git add Dockerfile .dockerignore next.config.js
git commit -m "feat: multi-stage Dockerfile for EasyPanel deployment"
```

---

## Self-Review: Cobertura do Spec

| Requisito do Spec | Task que implementa |
|---|---|
| Login com e-mail + senha | Task 5 |
| Erro em credenciais inválidas | Task 5 (actions.ts retorna error) |
| Redirect para /dashboard após login | Task 5 (actions.ts redirect) |
| Sem cadastro público | Task 5 (nenhum endpoint de signup) |
| Middleware protege /dashboard | Task 4 |
| Matcher exclui apenas /login exato | Task 4 (verificado com node -e) |
| Header com email + logout | Task 7 |
| Card Total de Vendas (closed_date, mês UTC) | Tasks 6 + 8 |
| Card Negócios Abertos | Tasks 6 + 8 |
| Card Meta do Mês com fallback | Tasks 6 + 8 |
| Gráfico de barras por dia (closed_date) | Tasks 6 + 9 |
| Tabela 10 deals recentes (created_at DESC) | Tasks 6 + 10 |
| Badges de status coloridos | Task 10 |
| 5 queries em paralelo (Promise.all) | Task 11 |
| force-dynamic (sem cache compartilhado) | Task 11 |
| Tabela deals com closed_date | Task 2 |
| Trigger BEFORE INSERT OR UPDATE | Task 2 |
| Guard IF status não mudou | Task 2 |
| Tabela monthly_goals com UNIQUE + CHECK | Task 2 |
| Índices (user_status_date, user_created, goals) | Task 2 |
| RLS deals (SELECT, INSERT, UPDATE) | Task 2 |
| DELETE deals intencionalmente ausente | Task 2 (comentado na migration) |
| RLS monthly_goals (SELECT apenas) | Task 2 |
| PGTZ=UTC | Configurar no EasyPanel (fora do código) |
| Dockerfile multi-stage | Task 12 |
| output: standalone | Task 12 |
