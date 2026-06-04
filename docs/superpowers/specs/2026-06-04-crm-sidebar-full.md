# CRM Completo — Sidebar + 5 Seções

**Data:** 2026-06-04
**Status:** Aprovado (revisado após code review)

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
Implementado com shadcn/ui `Dialog`. Cada seção passa seu próprio formulário como `children`. Não é uma abstração de formulário — só encapsula abertura/fechamento e título.

### Obtenção do usuário no layout

`(crm)/layout.tsx` usa `supabase.auth.getSession()` para obter o e-mail do usuário a partir do JWT em cache (sem network call extra ao Supabase). O middleware já garantiu que a sessão é válida:

```tsx
// layout.tsx — Server Component
const { data: { session } } = await supabase.auth.getSession()
const userEmail = session?.user?.email ?? ''
```

Isso evita um segundo round-trip ao Supabase Auth por page load.

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

-- Unicidade de e-mail por usuário (permite NULL — cliente sem e-mail)
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
-- client_name torna-se nullable (era NOT NULL) para suportar deals criados via Kanban
-- que derivam o nome do cliente via JOIN, sem precisar de campo duplicado
ALTER TABLE deals ALTER COLUMN client_name DROP NOT NULL;

-- client_id nullable — compatibilidade com deals existentes
ALTER TABLE deals ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- Índice para lookup de deals por cliente
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals (client_id);
```

**Regra de exibição do nome do cliente:**
- Se `client_id IS NOT NULL`: exibir `clients.name` via JOIN
- Se `client_id IS NULL` e `client_name IS NOT NULL`: exibir `client_name` (deal legado)
- Se ambos nulos: exibir "–"

Esta lógica se aplica a Pipeline, Kanban e qualquer view que liste deals.

### Atualização em `monthly_goals` — política de escrita para usuários

Para que Configurações possa fazer UPSERT via client normal (sem service role em Server Action):

```sql
-- Adicionar política de escrita para o próprio usuário
CREATE POLICY "goals: escrita própria"
  ON monthly_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals: atualização própria"
  ON monthly_goals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Com essas políticas, `saveMeta` usa `createSupabaseServerClient()` (client normal) em vez do admin client — alinhado com a regra existente de nunca usar service role em Server Actions.

---

## Seção 1 — Sidebar (`app/(crm)/components/Sidebar.tsx`)

**`'use client'`** — necessário para `usePathname()`.

**Layout:** fixo à esquerda, 240px de largura, altura full. Em mobile: recolhível via hambúrguer.

**Estrutura:**
```
┌─────────────────────┐
│ ◉ CRM Vendas        │  ← Logo + nome
├─────────────────────┤
│ 📊 Visão Geral      │  → /dashboard
│ 👥 Clientes         │  → /clientes
│ 📈 Pipeline         │  → /pipeline
│ 🗂  Kanban          │  → /kanban
│ ⚙️  Configurações   │  → /configuracoes
├─────────────────────┤
│ user@email.com      │
│ [Sair]              │  ← form action={signOut}
└─────────────────────┘
```

- Link ativo: fundo azul claro, texto azul escuro (detectado por `usePathname()`)
- Links inativos: texto cinza, hover com fundo cinza suave
- `signOut` importado de `@/app/login/actions`

**Props:**
```tsx
interface SidebarProps {
  userEmail: string
}
```

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

Dashboard atual migrado para `app/(crm)/dashboard/page.tsx`. Sem alterações funcionais:
- 3 cards de métricas (Total de Vendas, Negócios Abertos, Meta do Mês)
- Gráfico de barras (vendas do mês)
- Tabela de deals recentes

Remove `Header.tsx` — sidebar assume navegação.

As queries existentes em `app/dashboard/queries.ts` são movidas para `app/(crm)/dashboard/queries.ts`. Os componentes `MetricCards`, `SalesChart`, `DealsTable` são movidos para `app/(crm)/dashboard/components/`.

---

## Seção 3 — Clientes (`/clientes`)

### Funcionalidades
- Listar todos os clientes do usuário em tabela (Nome, Empresa, E-mail, Telefone, Data)
- Busca em tempo real por nome ou empresa (client-side filter)
- Botão "Novo Cliente" → abre Modal com formulário de criação
- Ação "Editar" por linha → abre Modal com dados preenchidos
- Ação "Excluir" por linha → confirmação inline com aviso:
  > "Este cliente tem X deal(s) vinculado(s). Ao excluir, os deals serão mantidos mas perderão a associação com este cliente. Deseja continuar?"
  > (conta deals via `SELECT COUNT(*) FROM deals WHERE client_id = ?` antes de exibir o modal)

### Formulário (modal)
Campos: Nome* | Empresa | E-mail | Telefone | Notas (textarea)

### Server Actions
- `createClient(formData)` — INSERT em clients
- `updateClient(id, formData)` — UPDATE em clients
- `deleteClient(id)` — DELETE em clients (ON DELETE SET NULL propaga para deals)

### Queries
- `getClients()` — SELECT * FROM clients ORDER BY created_at DESC

---

## Seção 4 — Pipeline (`/pipeline`)

### Funcionalidades
- 3 cards de resumo no topo: total abertos (R$), total ganhos (R$), total perdidos (R$)
- Taxa de conversão: `won + lost > 0 ? (won / (won + lost)) × 100 : 0` — exibe "0%" quando não há deals fechados
- Barras de progresso visual do funil (abertos → ganhos)
- Tabela completa de deals com colunas: Cliente, Valor, Status (badge), Data de Fechamento
  - **Coluna Cliente:** `clients.name` se `client_id` existir; senão `deals.client_name`; senão "–"
- Filtro por status (Todos / Abertos / Ganhos / Perdidos) — client-side

### Queries
- Usa `getDealsWithClients()` — query compartilhada com Kanban (ver abaixo)

---

## Seção 5 — Kanban (`/kanban`)

### Colunas
3 colunas fixas: **Abertos** | **Ganhos** | **Perdidos**

### Card de deal
```
┌───────────────────┐
│ Nome do Cliente   │  ← clients.name OU deals.client_name OU "–"
│ R$ 5.000,00       │
│ [→ Ganho] [→ Perd]│
└───────────────────┘
```

Botões condicionais:
- Coluna Abertos: botões "Marcar Ganho" e "Marcar Perdido"
- Coluna Ganhos: botão "Reabrir"
- Coluna Perdidos: botão "Reabrir"

Botão "Novo Deal" (canto superior direito) → Modal:
- Selecionar cliente (dropdown dos clients cadastrados)
- Valor (R$)
- Status inicial: Aberto

### Server Actions
- `moveDeal(id, newStatus)` — UPDATE deals SET status = newStatus
- `createDeal(clientId, value)`:
  1. SELECT name FROM clients WHERE id = clientId (obtém o nome)
  2. INSERT INTO deals (client_id, client_name, value, status) VALUES (clientId, clientName, value, 'open')

### Query compartilhada com Pipeline

```typescript
// Única query para ambas as páginas — evita round-trip duplo
export const getDealsWithClients = cache(async () => {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('deals')
    .select('*, clients(name)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(deal => ({
    ...deal,
    displayName: deal.clients?.name ?? deal.client_name ?? '–'
  }))
})
```

Pipeline e Kanban chamam `getDealsWithClients()` e filtram client-side por status.

---

## Seção 6 — Configurações (`/configuracoes`)

### Funcionalidades
- Card "Meta do Mês Atual" — mostra meta atual ou "Nenhuma meta definida"
- Formulário para definir/editar meta do mês atual (campo numérico em R$)
- Tabela histórico: últimos 6 meses com colunas Mês | Meta | Total Ganho | % Atingido

### Comportamento
- Se não existir meta para o mês atual: formulário de criação
- Se existir: formulário de edição com valor atual preenchido
- Usa `createSupabaseServerClient()` (client normal, **não** admin client) — possível graças às políticas RLS de escrita adicionadas em monthly_goals

### Server Action
- `saveMeta(month, value)` — UPSERT em monthly_goals via client normal:
  ```sql
  INSERT INTO monthly_goals (user_id, month, goal_value)
  VALUES (auth.uid(), $month, $value)
  ON CONFLICT (user_id, month) DO UPDATE SET goal_value = $value
  ```

### Queries
- `getGoalHistory()` — últimos 6 meses:
  1. SELECT month, goal_value FROM monthly_goals ORDER BY month DESC LIMIT 6
  2. Para cada mês: SUM(value) FROM deals WHERE status='won' AND closed_date IN [month_start, month_end)
  - Executadas em paralelo via Promise.allSettled

---

## Estilo Visual

- Sidebar: fundo branco, borda direita cinza claro
- Área de conteúdo: fundo `gray-50`
- Paleta: tons de cinza e azul corporativo (consistente com o dashboard existente)
- Componentes: shadcn/ui (card, badge, button, input, dialog, progress)
- Fonte: Inter (já configurada)
- Layout responsivo: sidebar recolhe em mobile via hambúrguer

---

## Fora de Escopo

- Drag and drop no Kanban (botões de mover em vez de arrastar)
- Convite de membros / multi-usuário na mesma conta
- Edição de perfil / senha
- Relatórios exportáveis
- Notificações
