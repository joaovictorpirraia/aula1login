# CRM Completo — Sidebar + 5 Seções — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar sidebar de navegação e 5 seções completas ao CRM (Clientes, Pipeline, Kanban, Configurações + migração do Dashboard), com nova tabela `clients` vinculada a `deals`.

**Architecture:** Route group `(crm)` com layout compartilhado contendo o Sidebar. Nova tabela `clients` com CRUD completo. `deals` recebe `client_id` nullable. Query compartilhada `getDealsWithClients()` serve Pipeline e Kanban com janela de 6 meses.

**Tech Stack:** Next.js 14 App Router, TypeScript, @supabase/ssr, Tailwind CSS, shadcn/ui, Jest

---

## Estrutura de Arquivos

```
app/
├── (crm)/
│   ├── layout.tsx                          ← CRIAR
│   ├── components/
│   │   ├── Sidebar.tsx                     ← CRIAR
│   │   ├── Modal.tsx                       ← CRIAR
│   │   └── PageHeader.tsx                  ← CRIAR
│   ├── dashboard/
│   │   ├── page.tsx                        ← MOVER de app/dashboard/page.tsx
│   │   ├── error.tsx                       ← MOVER de app/dashboard/error.tsx
│   │   ├── queries.ts                      ← MOVER + ATUALIZAR getRecentDeals
│   │   └── components/
│   │       ├── MetricCards.tsx             ← MOVER
│   │       ├── SalesChart.tsx              ← MOVER
│   │       └── DealsTable.tsx              ← MOVER
│   ├── clientes/
│   │   ├── page.tsx                        ← CRIAR
│   │   ├── actions.ts                      ← CRIAR
│   │   └── queries.ts                      ← CRIAR
│   ├── pipeline/
│   │   └── page.tsx                        ← CRIAR
│   ├── kanban/
│   │   ├── page.tsx                        ← CRIAR
│   │   └── actions.ts                      ← CRIAR
│   └── configuracoes/
│       ├── page.tsx                        ← CRIAR
│       └── actions.ts                      ← CRIAR
├── dashboard/ → DELETAR após migração
lib/
└── utils/
    └── dates.ts                            ← ADICIONAR getSixMonthsAgoUTC
supabase/
└── migrations/
    ├── 007_create_clients.sql              ← CRIAR
    ├── 008_update_deals_client_id.sql      ← CRIAR
    └── 009_monthly_goals_ownership_trigger.sql ← CRIAR
__tests__/
├── lib/utils/dates.test.ts                 ← ADICIONAR getSixMonthsAgoUTC
├── app/(crm)/clientes/actions.test.ts      ← CRIAR
├── app/(crm)/kanban/actions.test.ts        ← CRIAR
└── app/(crm)/dashboard/queries.test.ts     ← ATUALIZAR getRecentDeals
```

---

## Task 1: Migrations no Supabase via MCP

**Files:**
- Create: `supabase/migrations/007_create_clients.sql`
- Create: `supabase/migrations/008_update_deals_client_id.sql`
- Create: `supabase/migrations/009_monthly_goals_ownership_trigger.sql`

- [ ] **Step 1: Criar arquivo de migration 007**

```sql
-- supabase/migrations/007_create_clients.sql
CREATE TABLE IF NOT EXISTS clients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  name        text NOT NULL,
  company     text,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients: leitura própria"
  ON clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clients: escrita própria"
  ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients: atualização própria"
  ON clients FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients: deleção própria"
  ON clients FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_clients_user ON clients (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_user_email
  ON clients (user_id, email) WHERE email IS NOT NULL;

CREATE OR REPLACE FUNCTION set_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION set_clients_updated_at();
```

- [ ] **Step 2: Criar arquivo de migration 008**

```sql
-- supabase/migrations/008_update_deals_client_id.sql
ALTER TABLE deals ALTER COLUMN client_name DROP NOT NULL;

ALTER TABLE deals ADD COLUMN IF NOT EXISTS
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_deals_client ON deals (client_id);

CREATE OR REPLACE FUNCTION check_deal_client_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM clients WHERE id = NEW.client_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'client_id must reference a client owned by the same user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_deal_client_ownership
BEFORE INSERT OR UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION check_deal_client_ownership();
```

- [ ] **Step 3: Criar arquivo de migration 009**

```sql
-- supabase/migrations/009_monthly_goals_ownership_trigger.sql
-- Nenhuma alteração de RLS em monthly_goals — mantida como admin-only.
-- saveMeta usa admin client com user_id extraído da sessão server-side.
-- Este arquivo documenta a decisão e não executa DDL.
SELECT 'monthly_goals mantido admin-only conforme spec 2026-06-04' AS status;
```

- [ ] **Step 4: Aplicar migrations via Supabase MCP**

Usar `mcp__plugin_supabase_supabase__apply_migration` com project_id `xuzsaeafrzjigugftdnz` para cada migration em ordem: 007 → 008 → 009.

- [ ] **Step 5: Verificar tabelas**

Usar `mcp__plugin_supabase_supabase__list_tables` com `verbose: true` e confirmar que `clients` existe com todas as colunas e `deals` tem coluna `client_id`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: migrations 007-009 - clients table, deals client_id, ownership trigger"
```

---

## Task 2: Utilitário getSixMonthsAgoUTC

**Files:**
- Modify: `lib/utils/dates.ts`
- Modify: `__tests__/lib/utils/dates.test.ts`

- [ ] **Step 1: Escrever o teste primeiro**

Adicionar ao final de `__tests__/lib/utils/dates.test.ts`:

```typescript
import { getMonthBoundariesUTC, formatCurrency, getSixMonthsAgoUTC } from '@/lib/utils/dates'

describe('getSixMonthsAgoUTC', () => {
  it('returns a date exactly 6 months before the start of current month', () => {
    const { start } = getSixMonthsAgoUTC()
    const now = new Date()
    const expectedMonth = ((now.getUTCMonth() - 6) + 12) % 12
    expect(start.getUTCDate()).toBe(1)
    expect(start.getUTCHours()).toBe(0)
    expect(start.getUTCMonth()).toBe(expectedMonth)
  })

  it('returns ISO date string in YYYY-MM-DD format starting with day 01', () => {
    const { startStr } = getSixMonthsAgoUTC()
    expect(startStr).toMatch(/^\d{4}-\d{2}-01$/)
  })
})
```

- [ ] **Step 2: Rodar para confirmar FAIL**

```bash
npm test -- --testPathPattern="dates.test" --passWithNoTests
```
Esperado: FAIL com "getSixMonthsAgoUTC is not a function"

- [ ] **Step 3: Implementar getSixMonthsAgoUTC**

Adicionar ao final de `lib/utils/dates.ts`:

```typescript
export function getSixMonthsAgoUTC(): { start: Date; startStr: string } {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, 1))
  return { start, startStr: start.toISOString().split('T')[0] }
}
```

- [ ] **Step 4: Rodar para confirmar PASS**

```bash
npm test -- --testPathPattern="dates.test"
```
Esperado: todos os testes passando

- [ ] **Step 5: Commit**

```bash
git add lib/utils/dates.ts __tests__/lib/utils/dates.test.ts
git commit -m "feat: add getSixMonthsAgoUTC utility"
```

---

## Task 3: Route Group (crm) — Layout, Sidebar, Modal, PageHeader

**Files:**
- Create: `app/(crm)/layout.tsx`
- Create: `app/(crm)/components/Sidebar.tsx`
- Create: `app/(crm)/components/Modal.tsx`
- Create: `app/(crm)/components/PageHeader.tsx`

- [ ] **Step 1: Criar o layout do grupo (crm)**

```tsx
// app/(crm)/layout.tsx
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { Sidebar } from './components/Sidebar'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userEmail={user.email ?? ''} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Criar o Sidebar**

```tsx
// app/(crm)/components/Sidebar.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, TrendingUp, Kanban, Settings } from 'lucide-react'
import { signOut } from '@/app/login/actions'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { href: '/dashboard',      label: 'Visão Geral',    icon: LayoutDashboard },
  { href: '/clientes',       label: 'Clientes',        icon: Users },
  { href: '/pipeline',       label: 'Pipeline',        icon: TrendingUp },
  { href: '/kanban',         label: 'Kanban',          icon: Kanban },
  { href: '/configuracoes',  label: 'Configurações',   icon: Settings },
]

interface SidebarProps {
  userEmail: string
}

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="px-4 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="font-semibold text-gray-800">CRM Vendas</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100 space-y-2">
        <p className="text-xs text-gray-400 truncate">{userEmail}</p>
        <form action={signOut}>
          <Button variant="outline" size="sm" type="submit" className="w-full">
            Sair
          </Button>
        </form>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Criar Modal**

```tsx
// app/(crm)/components/Modal.tsx
'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ModalProps {
  title: string
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ title, isOpen, onClose, children }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Criar PageHeader**

```tsx
// app/(crm)/components/PageHeader.tsx
interface PageHeaderProps {
  title: string
  action?: React.ReactNode
}

export function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 bg-white">
      <h1 className="text-xl font-semibold text-gray-800">{title}</h1>
      {action}
    </div>
  )
}
```

- [ ] **Step 5: Instalar componente Dialog do shadcn**

```bash
npx shadcn@latest add dialog
```

- [ ] **Step 6: Verificar build**

```bash
npm run build
```
Esperado: build sem erros. O route group `(crm)` não tem nenhuma page ainda, mas o layout deve compilar.

- [ ] **Step 7: Commit**

```bash
git add app/\(crm\)/
git commit -m "feat: (crm) route group with layout, Sidebar, Modal, PageHeader"
```

---

## Task 4: Migrar Dashboard para (crm)/dashboard

**Files:**
- Create: `app/(crm)/dashboard/page.tsx` (conteúdo de app/dashboard/page.tsx sem Header)
- Create: `app/(crm)/dashboard/error.tsx` (cópia de app/dashboard/error.tsx)
- Create: `app/(crm)/dashboard/queries.ts` (queries atualizadas)
- Create: `app/(crm)/dashboard/components/MetricCards.tsx`
- Create: `app/(crm)/dashboard/components/SalesChart.tsx`
- Create: `app/(crm)/dashboard/components/DealsTable.tsx`
- Delete: `app/dashboard/` (pasta inteira após verificação)

- [ ] **Step 1: Copiar e atualizar queries.ts com fallback em getRecentDeals**

```typescript
// app/(crm)/dashboard/queries.ts
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMonthBoundariesUTC } from '@/lib/utils/dates'

export const getTotalSales = cache(async (): Promise<number> => {
  const supabase = createSupabaseServerClient()
  const { start, end } = getMonthBoundariesUTC()
  const { data, error } = await supabase
    .from('deals')
    .select('value')
    .eq('status', 'won')
    .gte('closed_date', start.toISOString().split('T')[0])
    .lt('closed_date', end.toISOString().split('T')[0])
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
  const { data, error } = await supabase
    .from('monthly_goals')
    .select('goal_value')
    .eq('month', start.toISOString().split('T')[0])
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.goal_value != null ? Number(data.goal_value) : null
})

export const getChartData = cache(async (): Promise<{ date: string; total: number }[]> => {
  const supabase = createSupabaseServerClient()
  const { start, end } = getMonthBoundariesUTC()
  const { data, error } = await supabase
    .from('deals')
    .select('value, closed_date')
    .eq('status', 'won')
    .gte('closed_date', start.toISOString().split('T')[0])
    .lt('closed_date', end.toISOString().split('T')[0])
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
    .select('id, client_name, client_id, value, status, created_at, clients(name)')
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw new Error(error.message)
  return (data ?? []).map((d: any) => ({
    ...d,
    displayName: d.clients?.name ?? d.client_name ?? '–',
  }))
})
```

- [ ] **Step 2: Copiar MetricCards, SalesChart para (crm)/dashboard/components/**

Copiar exatamente de `app/dashboard/components/MetricCards.tsx` → `app/(crm)/dashboard/components/MetricCards.tsx` (sem alterações no conteúdo).

Copiar exatamente de `app/dashboard/components/SalesChart.tsx` → `app/(crm)/dashboard/components/SalesChart.tsx` (sem alterações).

- [ ] **Step 3: Atualizar DealsTable para usar displayName**

```tsx
// app/(crm)/dashboard/components/DealsTable.tsx
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/dates'

type DealStatus = 'open' | 'won' | 'lost'

type Deal = {
  id: string
  displayName: string
  value: string | number
  status: DealStatus
  created_at: string
}

interface DealsTableProps {
  deals: Deal[]
}

const STATUS_LABELS: Record<DealStatus, string> = { won: 'Ganho', open: 'Aberto', lost: 'Perdido' }
const STATUS_VARIANTS: Record<DealStatus, 'default' | 'secondary' | 'destructive'> = {
  won: 'default', open: 'secondary', lost: 'destructive',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function DealsTable({ deals }: DealsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-700">Negócios Recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {deals.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum negócio encontrado.</p>
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
                  <tr key={deal.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 text-gray-800">{deal.displayName}</td>
                    <td className="py-3 px-3 text-right text-gray-800 font-medium">{formatCurrency(Number(deal.value))}</td>
                    <td className="py-3 px-3 text-center">
                      <Badge variant={STATUS_VARIANTS[deal.status]}>{STATUS_LABELS[deal.status]}</Badge>
                    </td>
                    <td className="py-3 px-3 text-right text-gray-500">{formatDate(deal.created_at)}</td>
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

- [ ] **Step 4: Criar a página do dashboard sem Header**

```tsx
// app/(crm)/dashboard/page.tsx
export const dynamic = 'force-dynamic'

import { MetricCards } from './components/MetricCards'
import { SalesChart } from './components/SalesChart'
import { DealsTable } from './components/DealsTable'
import { PageHeader } from '../components/PageHeader'
import {
  getTotalSales, getOpenDealsCount, getMonthlyGoal, getChartData, getRecentDeals
} from './queries'

export default async function DashboardPage() {
  const results = await Promise.allSettled([
    getTotalSales(), getOpenDealsCount(), getMonthlyGoal(), getChartData(), getRecentDeals()
  ])

  const hasDataError = results.some(r => r.status === 'rejected')
  const totalSales   = results[0].status === 'fulfilled' ? results[0].value : 0
  const openDeals    = results[1].status === 'fulfilled' ? results[1].value : 0
  const goal         = results[2].status === 'fulfilled' ? results[2].value : null
  const chartData    = results[3].status === 'fulfilled' ? results[3].value : []
  const recentDeals  = results[4].status === 'fulfilled' ? results[4].value : []

  return (
    <div>
      <PageHeader title="Visão Geral" />
      <div className="px-6 py-6 space-y-6">
        {hasDataError && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
            Alguns dados não puderam ser carregados. Tente recarregar a página.
          </div>
        )}
        <MetricCards totalSales={totalSales} openDeals={openDeals} goal={goal} />
        <SalesChart data={chartData} />
        <DealsTable deals={recentDeals} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Criar error.tsx**

```tsx
// app/(crm)/dashboard/error.tsx
'use client'

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex items-center justify-center h-full px-4">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-lg font-semibold text-gray-800">Erro ao carregar o dashboard</h2>
        <p className="text-sm text-gray-500">Não foi possível buscar os dados. Tente novamente.</p>
        <button onClick={reset} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Deletar pasta app/dashboard/ antiga**

```bash
rm -rf "app/dashboard"
```

Verificar que o build ainda passa (a rota /dashboard agora vem de app/(crm)/dashboard/).

- [ ] **Step 7: Verificar build**

```bash
npm run build
```
Esperado: rota `/dashboard` aparece como `ƒ (Dynamic)` no output.

- [ ] **Step 8: Commit**

```bash
git add app/\(crm\)/dashboard/ && git commit -m "feat: migrate dashboard to (crm) route group, update DealsTable with displayName fallback"
```

---

## Task 5: Query Compartilhada getDealsWithClients

**Files:**
- Create: `app/(crm)/shared/queries.ts`

- [ ] **Step 1: Criar queries compartilhadas**

```typescript
// app/(crm)/shared/queries.ts
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getSixMonthsAgoUTC } from '@/lib/utils/dates'

export type DealWithClient = {
  id: string
  user_id: string
  client_id: string | null
  client_name: string | null
  value: string
  status: 'open' | 'won' | 'lost'
  created_at: string
  closed_at: string | null
  closed_date: string | null
  updated_at: string
  clients: { name: string } | null
  displayName: string
}

export const getDealsWithClients = cache(async (): Promise<DealWithClient[]> => {
  const supabase = createSupabaseServerClient()
  const { startStr } = getSixMonthsAgoUTC()

  const { data, error } = await supabase
    .from('deals')
    .select('*, clients(name)')
    .gte('created_at', startStr)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((deal: any) => ({
    ...deal,
    displayName: deal.clients?.name ?? deal.client_name ?? '–',
  }))
})
```

- [ ] **Step 2: Commit**

```bash
git add app/\(crm\)/shared/
git commit -m "feat: shared getDealsWithClients query with 6-month window"
```

---

## Task 6: Clientes — CRUD Completo

**Files:**
- Create: `app/(crm)/clientes/queries.ts`
- Create: `app/(crm)/clientes/actions.ts`
- Create: `app/(crm)/clientes/page.tsx`
- Create: `__tests__/app/(crm)/clientes/actions.test.ts`

- [ ] **Step 1: Escrever testes para as actions**

```typescript
// __tests__/app/(crm)/clientes/actions.test.ts
const mockSupabase = { from: jest.fn() }

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => mockSupabase,
}))

import { createClient, deleteClient } from '@/app/(crm)/clientes/actions'

function buildChain(terminal: string, result: object) {
  const chain: Record<string, jest.Mock> = {
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  }
  chain[terminal] = jest.fn().mockResolvedValue(result)
  return chain
}

beforeEach(() => jest.clearAllMocks())

describe('createClient', () => {
  it('returns error when name is empty', async () => {
    const fd = new FormData()
    fd.append('name', '')
    const result = await createClient({ error: null }, fd)
    expect(result.error).toBe('Nome é obrigatório.')
  })

  it('returns null error on success', async () => {
    const chain = buildChain('select', { data: [{ id: '1' }], error: null })
    mockSupabase.from.mockReturnValue(chain)
    const fd = new FormData()
    fd.append('name', 'Empresa X')
    const result = await createClient({ error: null }, fd)
    expect(result.error).toBeNull()
  })
})

describe('deleteClient', () => {
  it('throws on Supabase error', async () => {
    const chain = buildChain('eq', { error: { message: 'DB error' } })
    mockSupabase.from.mockReturnValue(chain)
    await expect(deleteClient('123')).rejects.toThrow('DB error')
  })
})
```

- [ ] **Step 2: Rodar para confirmar FAIL**

```bash
npm test -- --testPathPattern="clientes/actions.test" --passWithNoTests
```
Esperado: FAIL com "Cannot find module"

- [ ] **Step 3: Criar actions.ts**

```typescript
// app/(crm)/clientes/actions.ts
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
```

- [ ] **Step 4: Rodar para confirmar PASS**

```bash
npm test -- --testPathPattern="clientes/actions.test"
```
Esperado: PASS

- [ ] **Step 5: Criar queries.ts**

```typescript
// app/(crm)/clientes/queries.ts
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type Client = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export const getClients = cache(async (): Promise<Client[]> => {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, company, email, phone, notes, created_at, updated_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
})
```

- [ ] **Step 6: Criar page.tsx de Clientes**

```tsx
// app/(crm)/clientes/page.tsx
export const dynamic = 'force-dynamic'

'use server'
import { Suspense } from 'react'
import { PageHeader } from '../components/PageHeader'
import { ClientesClient } from './ClientesClient'
import { getClients } from './queries'

export default async function ClientesPage() {
  const clients = await getClients()
  return (
    <div>
      <PageHeader title="Clientes" />
      <div className="px-6 py-6">
        <ClientesClient initialClients={clients} />
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Criar ClientesClient.tsx (componente client com busca e modal)**

```tsx
// app/(crm)/clientes/ClientesClient.tsx
'use client'

import { useState, useMemo } from 'react'
import { useFormState } from 'react-dom'
import { type Client } from './queries'
import { createClient, updateClient, deleteClient } from './actions'
import { Modal } from '../components/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

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

  if (state.error === null && initial === undefined) {
    // success on create — but we can't redirect here; parent handles close
  }

  return (
    <form action={async (fd: FormData) => {
      const r = await action({ error: null }, fd)
      if (!r.error) onSuccess()
    }} className="space-y-3 mt-2">
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

  const filtered = useMemo(() =>
    clients.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? '').toLowerCase().includes(search.toLowerCase())
    ), [clients, search])

  async function handleDelete(id: string) {
    await deleteClient(id)
    setClients(prev => prev.filter(c => c.id !== id))
    setConfirming(null)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Input
          placeholder="Buscar por nome ou empresa..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={() => setCreating(true)}>+ Novo Cliente</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Nome', 'Empresa', 'E-mail', 'Telefone', 'Ações'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhum cliente encontrado.</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-3 text-gray-600">{c.company ?? '–'}</td>
                <td className="px-4 py-3 text-gray-600">{c.email ?? '–'}</td>
                <td className="px-4 py-3 text-gray-600">{c.phone ?? '–'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(c)}>Editar</Button>
                    <Button size="sm" variant="destructive" onClick={() => setConfirming(c.id)}>Excluir</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal title="Novo Cliente" isOpen={creating} onClose={() => setCreating(false)}>
        <ClientForm
          action={createClient}
          onSuccess={() => { setCreating(false); window.location.reload() }}
        />
      </Modal>

      <Modal title="Editar Cliente" isOpen={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <ClientForm
            initial={editing}
            action={(prev, fd) => updateClient(editing.id, prev, fd)}
            onSuccess={() => { setEditing(null); window.location.reload() }}
          />
        )}
      </Modal>

      <Modal title="Confirmar exclusão" isOpen={!!confirming} onClose={() => setConfirming(null)}>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-gray-600">
            Tem certeza que deseja excluir este cliente? Os deals vinculados serão mantidos mas perderão a associação com este cliente.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => confirming && handleDelete(confirming)}>Excluir</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
```

- [ ] **Step 8: Rodar todos os testes**

```bash
npm test
```
Esperado: todos passando

- [ ] **Step 9: Commit**

```bash
git add app/\(crm\)/clientes/ __tests__/app/\(crm\)/
git commit -m "feat: Clientes page with full CRUD, search, and confirmation modal"
```

---

## Task 7: Pipeline Page

**Files:**
- Create: `app/(crm)/pipeline/page.tsx`

- [ ] **Step 1: Criar página de Pipeline**

```tsx
// app/(crm)/pipeline/page.tsx
export const dynamic = 'force-dynamic'

'use client'
import { useState, useMemo } from 'react'
import { PageHeader } from '../components/PageHeader'
import { PipelineClient } from './PipelineClient'
import { getDealsWithClients } from '../shared/queries'

export default async function PipelinePage() {
  const deals = await getDealsWithClients()
  return (
    <div>
      <PageHeader title="Pipeline" />
      <div className="px-6 py-6">
        <PipelineClient deals={deals} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Criar PipelineClient.tsx**

```tsx
// app/(crm)/pipeline/PipelineClient.tsx
'use client'

import { useState, useMemo } from 'react'
import { type DealWithClient } from '../shared/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { formatCurrency } from '@/lib/utils/dates'

type Filter = 'all' | 'open' | 'won' | 'lost'
const STATUS_LABELS = { open: 'Aberto', won: 'Ganho', lost: 'Perdido' } as const
const STATUS_VARIANTS = { open: 'secondary', won: 'default', lost: 'destructive' } as const

export function PipelineClient({ deals }: { deals: DealWithClient[] }) {
  const [filter, setFilter] = useState<Filter>('all')

  const open = deals.filter(d => d.status === 'open')
  const won  = deals.filter(d => d.status === 'won')
  const lost = deals.filter(d => d.status === 'lost')

  const totalOpen = open.reduce((s, d) => s + Number(d.value), 0)
  const totalWon  = won.reduce((s, d)  => s + Number(d.value), 0)
  const totalLost = lost.reduce((s, d) => s + Number(d.value), 0)
  const convRate  = won.length + lost.length > 0
    ? Math.round((won.length / (won.length + lost.length)) * 100)
    : 0

  const filtered = filter === 'all' ? deals : deals.filter(d => d.status === filter)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Abertos', value: totalOpen, count: open.length, color: 'text-blue-600' },
          { label: 'Ganhos',  value: totalWon,  count: won.length,  color: 'text-green-600' },
          { label: 'Perdidos',value: totalLost, count: lost.length, color: 'text-red-600' },
          { label: 'Taxa de Conversão', value: null, count: null, color: 'text-gray-800' },
        ].map((card, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {card.value !== null ? (
                <>
                  <p className={`text-2xl font-bold ${card.color}`}>{formatCurrency(card.value)}</p>
                  <p className="text-xs text-gray-400 mt-1">{card.count} deal(s)</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-gray-800">{convRate}%</p>
                  <Progress value={convRate} className="h-2 mt-2" />
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        {(['all', 'open', 'won', 'lost'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'all' ? 'Todos' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Cliente', 'Valor', 'Status', 'Data de Fechamento'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Nenhum negócio encontrado.</td></tr>
            ) : filtered.map(d => (
              <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{d.displayName}</td>
                <td className="px-4 py-3 text-gray-700">{formatCurrency(Number(d.value))}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANTS[d.status as keyof typeof STATUS_VARIANTS]}>
                    {STATUS_LABELS[d.status as keyof typeof STATUS_LABELS]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {d.closed_date ? new Date(d.closed_date).toLocaleDateString('pt-BR') : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(crm\)/pipeline/
git commit -m "feat: Pipeline page with conversion rate, filter, and deal table"
```

---

## Task 8: Kanban Page + Actions

**Files:**
- Create: `app/(crm)/kanban/actions.ts`
- Create: `app/(crm)/kanban/page.tsx`
- Create: `app/(crm)/kanban/KanbanClient.tsx`
- Create: `__tests__/app/(crm)/kanban/actions.test.ts`

- [ ] **Step 1: Escrever testes para moveDeal e createDeal**

```typescript
// __tests__/app/(crm)/kanban/actions.test.ts
const mockSupabase = { from: jest.fn(), auth: { getUser: jest.fn() } }

jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => mockSupabase,
}))

import { moveDeal, createDeal } from '@/app/(crm)/kanban/actions'

function buildChain(terminal: string, result: object) {
  const chain: Record<string, jest.Mock> = {
    update: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
  }
  chain[terminal] = jest.fn().mockResolvedValue(result)
  return chain
}

beforeEach(() => jest.clearAllMocks())

describe('moveDeal', () => {
  it('throws on invalid status', async () => {
    await expect(moveDeal('id-1', 'invalid' as any)).rejects.toThrow('Status inválido')
  })

  it('throws on Supabase error', async () => {
    const chain = buildChain('eq', { error: { message: 'DB error' } })
    mockSupabase.from.mockReturnValue(chain)
    await expect(moveDeal('id-1', 'won')).rejects.toThrow('DB error')
  })
})

describe('createDeal', () => {
  it('returns error when value is not a positive number', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
    const result = await createDeal({ error: null }, Object.assign(new FormData(), {
      get: (k: string) => k === 'value' ? '-100' : 'client-id',
    }))
    expect(result.error).toBeTruthy()
  })
})
```

- [ ] **Step 2: Rodar para confirmar FAIL**

```bash
npm test -- --testPathPattern="kanban/actions.test" --passWithNoTests
```
Esperado: FAIL

- [ ] **Step 3: Criar actions.ts**

```typescript
// app/(crm)/kanban/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['open', 'won', 'lost'] as const
type Status = typeof VALID_STATUSES[number]

export async function moveDeal(id: string, newStatus: Status): Promise<void> {
  if (!VALID_STATUSES.includes(newStatus)) throw new Error('Status inválido')
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('deals')
    .update({ status: newStatus })
    .eq('id', id)
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
    // client_name omitido — nullable após migration 008
    // displayName é derivado via JOIN em getDealsWithClients()
  })

  if (error) return { error: error.message }
  revalidatePath('/kanban')
  return { error: null }
}
```

- [ ] **Step 4: Rodar para confirmar PASS**

```bash
npm test -- --testPathPattern="kanban/actions.test"
```
Esperado: PASS

- [ ] **Step 5: Criar page.tsx do Kanban**

```tsx
// app/(crm)/kanban/page.tsx
export const dynamic = 'force-dynamic'

import { PageHeader } from '../components/PageHeader'
import { KanbanClient } from './KanbanClient'
import { getDealsWithClients } from '../shared/queries'
import { getClients } from '../clientes/queries'

export default async function KanbanPage() {
  const [deals, clients] = await Promise.all([
    getDealsWithClients(),
    getClients(),
  ])

  return (
    <div>
      <PageHeader title="Kanban" />
      <div className="px-6 py-6">
        <KanbanClient deals={deals} clients={clients} />
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Criar KanbanClient.tsx**

```tsx
// app/(crm)/kanban/KanbanClient.tsx
'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { type DealWithClient } from '../shared/queries'
import { type Client } from '../clientes/queries'
import { moveDeal, createDeal } from './actions'
import { Modal } from '../components/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils/dates'

type Status = 'open' | 'won' | 'lost'

const COLUMNS: { status: Status; label: string; color: string }[] = [
  { status: 'open',  label: 'Abertos',  color: 'bg-blue-50 border-blue-200' },
  { status: 'won',   label: 'Ganhos',   color: 'bg-green-50 border-green-200' },
  { status: 'lost',  label: 'Perdidos', color: 'bg-red-50 border-red-200' },
]

function DealCard({ deal, onMove }: { deal: DealWithClient; onMove: (id: string, status: Status) => void }) {
  const actions: { label: string; status: Status; variant: 'default' | 'outline' | 'destructive' }[] =
    deal.status === 'open'
      ? [{ label: 'Marcar Ganho', status: 'won', variant: 'default' }, { label: 'Marcar Perdido', status: 'lost', variant: 'destructive' }]
      : [{ label: 'Reabrir', status: 'open', variant: 'outline' }]

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2 shadow-sm">
      <p className="font-medium text-gray-800 text-sm">{deal.displayName}</p>
      <p className="text-sm text-gray-600">{formatCurrency(Number(deal.value))}</p>
      <div className="flex gap-1 flex-wrap pt-1">
        {actions.map(a => (
          <Button key={a.status} size="sm" variant={a.variant} className="text-xs h-7"
            onClick={() => onMove(deal.id, a.status)}>
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function KanbanClient({ deals, clients }: { deals: DealWithClient[]; clients: Client[] }) {
  const [localDeals, setLocalDeals] = useState(deals)
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [newDealState, newDealAction] = useFormState(createDeal, { error: null })
  const [isPending, startTransition] = useTransition()

  function handleMove(id: string, newStatus: Status) {
    startTransition(async () => {
      await moveDeal(id, newStatus)
      setLocalDeals(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d))
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setNewDealOpen(true)}>+ Novo Deal</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const colDeals = localDeals.filter(d => d.status === col.status)
          const colTotal = colDeals.reduce((s, d) => s + Number(d.value), 0)
          return (
            <div key={col.status} className={`rounded-lg border p-3 space-y-3 ${col.color}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-700">{col.label}</h3>
                <span className="text-xs text-gray-500">{colDeals.length} · {formatCurrency(colTotal)}</span>
              </div>
              {colDeals.length === 0
                ? <p className="text-xs text-gray-400 text-center py-4">Nenhum deal</p>
                : colDeals.map(d => <DealCard key={d.id} deal={d} onMove={handleMove} />)
              }
            </div>
          )
        })}
      </div>

      <Modal title="Novo Deal" isOpen={newDealOpen} onClose={() => setNewDealOpen(false)}>
        <form action={async (fd: FormData) => {
          const r = await createDeal({ error: null }, fd)
          if (!r.error) { setNewDealOpen(false); window.location.reload() }
        }} className="space-y-3 mt-2">
          <select name="client_id" required className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm">
            <option value="">Selecionar cliente...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
          </select>
          <Input name="value" type="number" placeholder="Valor (R$)" min="0.01" step="0.01" required />
          {newDealState.error && <p className="text-sm text-red-600">{newDealState.error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewDealOpen(false)}>Cancelar</Button>
            <Button type="submit">Criar Deal</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add app/\(crm\)/kanban/ __tests__/app/\(crm\)/kanban/
git commit -m "feat: Kanban page with column cards, move buttons, and new deal modal"
```

---

## Task 9: Configurações Page + saveMeta Action

**Files:**
- Create: `app/(crm)/configuracoes/actions.ts`
- Create: `app/(crm)/configuracoes/page.tsx`
- Create: `app/(crm)/configuracoes/ConfiguracoesClient.tsx`

- [ ] **Step 1: Criar actions.ts**

```typescript
// app/(crm)/configuracoes/actions.ts
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

  // Obter user_id da sessão server-side — nunca do input do usuário
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.', success: null }

  // Admin client exclusivo para monthly_goals (tabela sem política de escrita para usuários)
  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('monthly_goals').upsert(
    { user_id: user.id, month, goal_value: value },
    { onConflict: 'user_id,month' }
  )

  if (error) return { error: error.message, success: null }
  revalidatePath('/configuracoes')
  return { error: null, success: 'Meta salva com sucesso!' }
}
```

- [ ] **Step 2: Criar page.tsx**

```tsx
// app/(crm)/configuracoes/page.tsx
export const dynamic = 'force-dynamic'

import { PageHeader } from '../components/PageHeader'
import { ConfiguracoesClient } from './ConfiguracoesClient'
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server'
import { getMonthBoundariesUTC, getSixMonthsAgoUTC, formatCurrency } from '@/lib/utils/dates'

async function getGoalHistory() {
  const supabase = createSupabaseServerClient()
  const admin = createSupabaseAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const [goalsResult, wonResult] = await Promise.allSettled([
    admin.from('monthly_goals')
      .select('month, goal_value')
      .eq('user_id', user.id)
      .order('month', { ascending: false })
      .limit(6),
    supabase.from('deals')
      .select('closed_date, value')
      .eq('status', 'won')
      .gte('closed_date', getSixMonthsAgoUTC().startStr),
  ])

  const goals  = goalsResult.status  === 'fulfilled' ? (goalsResult.value.data  ?? []) : []
  const wonDeals = wonResult.status  === 'fulfilled' ? (wonResult.value.data    ?? []) : []

  const sumByMonth: Record<string, number> = {}
  for (const d of wonDeals) {
    const key = (d.closed_date as string).slice(0, 7)
    sumByMonth[key] = (sumByMonth[key] ?? 0) + Number(d.value)
  }

  return goals.map((g: any) => ({
    month: g.month as string,
    goal:  Number(g.goal_value),
    won:   sumByMonth[(g.month as string).slice(0, 7)] ?? 0,
  }))
}

async function getCurrentGoal() {
  const admin = createSupabaseAdminClient()
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { start } = getMonthBoundariesUTC()
  const monthKey = start.toISOString().split('T')[0]

  const { data } = await admin.from('monthly_goals')
    .select('goal_value')
    .eq('user_id', user.id)
    .eq('month', monthKey)
    .maybeSingle()

  return data?.goal_value ? Number(data.goal_value) : null
}

export default async function ConfiguracoesPage() {
  const [history, currentGoal] = await Promise.all([
    getGoalHistory(),
    getCurrentGoal(),
  ])

  const { start } = getMonthBoundariesUTC()
  const currentMonth = start.toISOString().split('T')[0]

  return (
    <div>
      <PageHeader title="Configurações" />
      <div className="px-6 py-6">
        <ConfiguracoesClient
          history={history}
          currentGoal={currentGoal}
          currentMonth={currentMonth}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Criar ConfiguracoesClient.tsx**

```tsx
// app/(crm)/configuracoes/ConfiguracoesClient.tsx
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
  return <Button type="submit" disabled={pending}>{pending ? 'Salvando...' : 'Salvar Meta'}</Button>
}

function formatMonth(dateStr: string) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
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
          {currentGoal ? (
            <p className="text-sm text-gray-600 mb-4">Meta atual: <span className="font-semibold">{formatCurrency(currentGoal)}</span></p>
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
          <CardTitle className="text-base font-semibold text-gray-700">Histórico (últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum histórico disponível.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">Mês</th>
                  <th className="text-right py-2 font-medium text-gray-500">Meta</th>
                  <th className="text-right py-2 font-medium text-gray-500">Total Ganho</th>
                  <th className="text-right py-2 font-medium text-gray-500">% Atingido</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const pct = h.goal > 0 ? Math.min(Math.round((h.won / h.goal) * 100), 100) : 0
                  return (
                    <tr key={h.month} className="border-b border-gray-50">
                      <td className="py-3 text-gray-700">{formatMonth(h.month)}</td>
                      <td className="py-3 text-right text-gray-700">{formatCurrency(h.goal)}</td>
                      <td className="py-3 text-right text-gray-700">{formatCurrency(h.won)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Progress value={pct} className="h-1.5 w-16" />
                          <span className="text-gray-700 w-10 text-right">{pct}%</span>
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
```

- [ ] **Step 4: Verificar build**

```bash
npm run build
```
Esperado: todas as rotas compilam sem erro.

- [ ] **Step 5: Commit**

```bash
git add app/\(crm\)/configuracoes/
git commit -m "feat: Configuracoes page with current month goal form and 6-month history"
```

---

## Self-Review: Cobertura do Spec

| Requisito do Spec | Task que implementa |
|---|---|
| Route group (crm) com layout | Task 3 |
| Sidebar com usePathname, signOut | Task 3 |
| Modal com interface { title, isOpen, onClose, children } | Task 3 |
| getUser() no layout (não getSession) | Task 3 |
| Migration clients com trigger + unique email | Task 1 |
| Migration deals client_id nullable + ownership trigger | Task 1 |
| client_name NOT NULL removida | Task 1 |
| getDealsWithClients com janela 6 meses e displayName | Task 5 |
| getSixMonthsAgoUTC utility | Task 2 |
| Dashboard migrado para (crm), Header removido | Task 4 |
| getRecentDeals com fallback displayName | Task 4 |
| Clientes CRUD completo (criar, editar, excluir, busca) | Task 6 |
| Confirmação de delete sem COUNT query | Task 6 |
| Pipeline com taxa de conversão e filtro | Task 7 |
| Conversão: guard won+lost>0 | Task 7 |
| Kanban com colunas, botões de mover, Novo Deal modal | Task 8 |
| moveDeal dispara trigger existente (set_closed_at) | Task 8 (documentado) |
| createDeal sem pre-fetch de client_name | Task 8 |
| Configurações: meta do mês atual + histórico 6 meses | Task 9 |
| saveMeta usa admin client com user_id da sessão | Task 9 |
| getGoalHistory: 2 queries em vez de N+1 | Task 9 |
