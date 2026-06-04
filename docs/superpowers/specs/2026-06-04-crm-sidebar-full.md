# CRM Completo — Sidebar + 5 Seções

**Data:** 2026-06-04
**Status:** Aprovado (revisado após 2 rounds de code review)

---

## Visão Geral

Expansão do CRM de vendas com menu lateral fixo e 5 seções completas: Visão Geral (dashboard existente), Clientes (CRUD), Pipeline (funil), Kanban (board com botões) e Configurações (metas mensais). Nova entidade `clients` vinculada a `deals`.

---

## Arquitetura

### Route Group `(crm)`

```
app/
├── (crm)/
│   ├── layout.tsx              ← Layout com Sidebar + área de conteúdo
│   ├── dashboard/
│   │   └── page.tsx            ← Visão Geral (dashboard atual migrado)
│   ├── clientes/
│   │   └── page.tsx
│   ├── pipeline/
│   │   └── page.tsx
│   ├── kanban/
│   │   └── page.tsx
│   └── configuracoes/
│       └── page.tsx
├── login/                      ← Fora do grupo — sem sidebar
└── page.tsx                    ← redirect → /dashboard
```

- O Header atual (`app/dashboard/components/Header.tsx`) é removido — o Sidebar assume logo e logout
- O middleware continua protegendo todas as rotas exceto `/login`
- `export const dynamic = 'force-dynamic'` mantido nas páginas que buscam dados

### Componentes compartilhados

```
app/(crm)/components/
├── Sidebar.tsx          ← Menu lateral fixo ('use client' — usa usePathname)
├── PageHeader.tsx       ← Título da página + ação primária opcional
└── Modal.tsx            ← Modal wrapper com interface definida abaixo
```

**Interface de Modal.tsx:**
```tsx
interface ModalProps {
  title: string
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}
```
Implementado com shadcn/ui `Dialog`. Cada seção passa seu próprio formulário como `children`.

### Obtenção do usuário no layout

`(crm)/layout.tsx` usa `supabase.auth.getUser()` — **não** `getSession()`. O motivo: `getSession()` só lê o JWT do cookie sem revalidar com o servidor Auth, tornando-o inseguro para acesso server-side (uma sessão revogada ainda pareceria válida). `getUser()` sempre revalida o token com o Supabase Auth Server.

```tsx
// layout.tsx — Server Component
const { data: { user } } = await supabase.auth.getUser()
const userEmail = user?.email ?? ''
```

O round-trip extra ao Supabase é intencional por segurança.

---

## Banco de Dados

### Nova tabela `clients`

```sql
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
  ON clients FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients: deleção própria"
  ON clients FOR DELETE USING (auth.uid() = user_id);

-- Índice de listagem
CREATE INDEX IF NOT EXISTS idx_clients_user ON clients (user_id, created_at DESC);

-- Unicidade de e-mail por usuário (permite NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_user_email
  ON clients (user_id, email)
  WHERE email IS NOT NULL;

-- Trigger para atualizar updated_at em edições
CREATE OR REPLACE FUNCTION set_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION set_clients_updated_at();
```

### Atualização em `deals`

```sql
-- client_name torna-se nullable para suportar deals criados via Kanban
ALTER TABLE deals ALTER COLUMN client_name DROP NOT NULL;

-- client_id nullable — compatibilidade com deals existentes
ALTER TABLE deals ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- Índice para lookup de deals por cliente
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals (client_id);

-- Trigger para garantir que client_id referencie um cliente do mesmo usuário
-- Previne exposição cross-user via JOIN em getDealsWithClients()
CREATE OR REPLACE FUNCTION check_deal_client_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM clients
      WHERE id = NEW.client_id AND user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'client_id must reference a client owned by the same user';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deal_client_ownership
BEFORE INSERT OR UPDATE ON deals
FOR EACH ROW EXECUTE FUNCTION check_deal_client_ownership();
```

**Regra de exibição do nome do cliente (aplicada em TODAS as views):**
- Se `client_id IS NOT NULL`: exibir `clients.name` via JOIN
- Se `client_id IS NULL` e `client_name IS NOT NULL`: exibir `client_name` (deal legado)
- Se ambos nulos: exibir "–"

Esta lógica se aplica a Pipeline, Kanban, Dashboard (DealsTable) e qualquer view que liste deals. **A query `getRecentDeals()` existente deve ser atualizada para aplicar este fallback.**

### monthly_goals — sem alteração de RLS

As políticas de monthly_goals permanecem como estão (somente SELECT para usuários autenticados, sem INSERT/UPDATE). Isso evita que vendedores alterem suas próprias metas.

`saveMeta` usa o **admin client** (service role) exclusivamente para esta operação, com o `user_id` extraído explicitamente da sessão server-side — não de input do usuário. Esta é a única exceção documentada ao princípio "sem service role em Server Actions":

```typescript
// app/(crm)/configuracoes/actions.ts
'use server'
export async function saveMeta(month: string, value: number) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  // Admin client usado apenas aqui, com user_id forçado da sessão server-side
  const admin = createSupabaseAdminClient()
  await admin.from('monthly_goals').upsert({
    user_id: user.id,   // ← sempre da sessão, nunca do input do usuário
    month,
    goal_value: value,
  }, { onConflict: 'user_id,month' })
}
```

---

## Seção 1 — Sidebar (`app/(crm)/components/Sidebar.tsx`)

**`'use client'`** — necessário para `usePathname()`.

**Layout:** fixo à esquerda, 240px de largura, altura full. Em mobile: recolhível via hambúrguer.

**Props:**
```tsx
interface SidebarProps {
  userEmail: string
}
```

- Link ativo: fundo azul claro, texto azul escuro (detectado por `usePathname()`)
- `signOut` importado de `@/app/login/actions`

**Layout raiz `(crm)/layout.tsx`:**
```tsx
<div className="flex h-screen">
  <Sidebar userEmail={userEmail} />
  <main className="flex-1 overflow-y-auto bg-gray-50">
    {children}
  </main>
</div>
```

---

## Seção 2 — Visão Geral (`/dashboard`)

Dashboard atual migrado para `app/(crm)/dashboard/page.tsx`. Remove `Header.tsx`.

As queries em `app/dashboard/queries.ts` são movidas para `app/(crm)/dashboard/queries.ts`.

**Atualização obrigatória em `getRecentDeals()`:** após client_name se tornar nullable, a query deve fazer JOIN em clients e aplicar o fallback:

```typescript
export const getRecentDeals = cache(async () => {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('deals')
    .select('id, client_name, client_id, value, status, created_at, clients(name)')
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw new Error(error.message)
  return (data ?? []).map(d => ({
    ...d,
    displayName: d.clients?.name ?? d.client_name ?? '–'
  }))
})
```

---

## Seção 3 — Clientes (`/clientes`)

### Funcionalidades
- Listar todos os clientes em tabela (Nome, Empresa, E-mail, Telefone, Data)
- Busca client-side por nome ou empresa
- Botão "Novo Cliente" → Modal com formulário
- "Editar" por linha → Modal com dados preenchidos
- "Excluir" por linha → confirmação inline com mensagem genérica:
  > "Tem certeza que deseja excluir este cliente? Os deals vinculados serão mantidos mas perderão a associação."

  **Não fazer SELECT COUNT antes de exibir o modal.** O aviso é sempre exibido; a contagem real é desnecessária para a UX e adiciona um round-trip gratuito. Se o client tiver 0 deals, a ação simplesmente não afeta nenhum deal.

### Server Actions
- `createClient(formData)` — INSERT em clients
- `updateClient(id, formData)` — UPDATE em clients
- `deleteClient(id)` — DELETE em clients; em caso de erro, exibir mensagem ao usuário

### Queries
- `getClients()` — SELECT FROM clients ORDER BY created_at DESC

---

## Seção 4 — Pipeline (`/pipeline`)

### Funcionalidades
- 3 cards de resumo: total abertos (R$), total ganhos (R$), total perdidos (R$)
- Taxa de conversão: `won + lost > 0 ? (won / (won + lost)) × 100 : 0` — exibe "0%" quando não há deals fechados
- Barras de progresso visual do funil
- Tabela de deals com fallback de nome (clients.name ?? client_name ?? "–")
- Filtro client-side por status

### Queries
- Usa `getDealsWithClients()` — query compartilhada com Kanban (ver abaixo)

---

## Seção 5 — Kanban (`/kanban`)

### Colunas
3 colunas fixas: **Abertos** | **Ganhos** | **Perdidos**

### Card de deal
```
┌───────────────────┐
│ Nome do Cliente   │  ← clients.name ?? client_name ?? "–"
│ R$ 5.000,00       │
│ [→ Ganho] [→ Perd]│
└───────────────────┘
```

Botões condicionais: Abertos→[Ganho][Perdido] | Ganhos→[Reabrir] | Perdidos→[Reabrir]

Botão "Novo Deal" → Modal: selecionar cliente (dropdown), valor

### Server Actions

**`moveDeal(id, newStatus)`** — UPDATE deals SET status = newStatus
- O trigger `trg_set_closed_at` existente cuida automaticamente de `closed_at` e `closed_date`
- Transições cobertas pelo trigger: open→won, open→lost, won→open, lost→open

**`createDeal(clientId, value)`** — INSERT direto sem pre-fetch de client_name:
```typescript
// client_name é nullable — displayName é derivado via JOIN em getDealsWithClients()
await supabase.from('deals').insert({
  user_id: user.id,    // da sessão server-side
  client_id: clientId,
  value,
  status: 'open',
  // client_name omitido — o trigger de ownership valida que clientId pertence ao user
})
```

Elimina a race condition do SELECT→INSERT e o round-trip desnecessário.

### Query compartilhada — `getDealsWithClients()`

```typescript
export const getDealsWithClients = cache(async () => {
  const supabase = createSupabaseServerClient()
  // Limita aos últimos 6 meses para evitar payload ilimitado
  const { start } = getSixMonthsAgoUTC()
  const { data, error } = await supabase
    .from('deals')
    .select('*, clients(name)')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(deal => ({
    ...deal,
    displayName: deal.clients?.name ?? deal.client_name ?? '–'
  }))
})
```

- **Janela:** últimos 6 meses por padrão (deals mais antigos ficam fora da view ativa)
- Pipeline e Kanban filtram client-side por status sobre este conjunto
- `getSixMonthsAgoUTC()` a ser adicionado em `lib/utils/dates.ts`

---

## Seção 6 — Configurações (`/configuracoes`)

### Funcionalidades
- Card "Meta do Mês Atual" — mostra meta ou "Nenhuma meta definida"
- Formulário para definir/editar meta do mês (R$)
- Tabela histórico: últimos 6 meses — Mês | Meta | Total Ganho | % Atingido

### Server Action
- `saveMeta(month, value)` — UPSERT via admin client com user_id da sessão (ver spec completo na seção de Banco de Dados)

### Query — `getGoalHistory()`

**Uma única query** com GROUP BY para evitar N+1:

```typescript
export const getGoalHistory = cache(async () => {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Query 1: últimas 6 metas
  const { data: goals } = await supabase
    .from('monthly_goals')
    .select('month, goal_value')
    .order('month', { ascending: false })
    .limit(6)

  // Query 2: soma de deals ganhos agrupados por mês (últimos 6 meses) — 1 única query
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 6)
  const { data: wonByMonth } = await supabase
    .from('deals')
    .select('closed_date, value')
    .eq('status', 'won')
    .gte('closed_date', sixMonthsAgo.toISOString().split('T')[0])

  // Agrupa por mês em JS (evita RPC ou SQL raw)
  // Total: 2 round-trips ao invés de 7
  const sumByMonth: Record<string, number> = {}
  for (const deal of wonByMonth ?? []) {
    const monthKey = deal.closed_date.slice(0, 7) // 'YYYY-MM'
    sumByMonth[monthKey] = (sumByMonth[monthKey] ?? 0) + Number(deal.value)
  }

  return (goals ?? []).map(g => ({
    month: g.month,
    goal: Number(g.goal_value),
    won: sumByMonth[g.month.slice(0, 7)] ?? 0,
  }))
})
```

Total: **2 round-trips** (em vez de 7). Agregação feita em JavaScript sobre conjunto pequeno (≤6 meses de deals ganhos).

---

## Estilo Visual

- Sidebar: fundo branco, borda direita cinza claro
- Área de conteúdo: fundo `gray-50`
- Paleta: tons de cinza e azul corporativo
- Componentes: shadcn/ui (card, badge, button, input, dialog, progress)
- Fonte: Inter (já configurada)
- Layout responsivo: sidebar recolhe em mobile via hambúrguer

---

## Fora de Escopo

- Drag and drop no Kanban
- Convite de membros / multi-usuário
- Edição de perfil / senha
- Relatórios exportáveis
- Notificações
