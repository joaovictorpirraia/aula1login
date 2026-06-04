# CRM Completo — Sidebar + 5 Seções

**Data:** 2026-06-04
**Status:** Aprovado

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
├── Sidebar.tsx          ← Menu lateral fixo
├── PageHeader.tsx       ← Título da página + ação primária opcional
└── Modal.tsx            ← Modal genérico reutilizável
```

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

CREATE INDEX IF NOT EXISTS idx_clients_user ON clients (user_id, created_at DESC);
```

### Atualização em `deals`

```sql
-- client_id nullable — compatibilidade com deals existentes
ALTER TABLE deals ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

-- Índice para lookup de deals por cliente
CREATE INDEX IF NOT EXISTS idx_deals_client ON deals (client_id);
```

- Deals existentes: `client_id = NULL`, `client_name` permanece como texto
- Deals novos criados via Kanban: `client_id` preenchido + `client_name` derivado do nome do cliente

---

## Seção 1 — Sidebar (`app/(crm)/components/Sidebar.tsx`)

**Layout:** fixo à esquerda, 240px de largura, altura full. Em mobile: recolhível via hambúrguer.

**Estrutura:**
```
┌─────────────────────┐
│ ◉ CRM Vendas        │  ← Logo + nome
├─────────────────────┤
│ 📊 Visão Geral      │
│ 👥 Clientes         │
│ 📈 Pipeline         │
│ 🗂  Kanban          │
│ ⚙️  Configurações   │
├─────────────────────┤
│ user@email.com      │  ← E-mail do usuário
│ [Sair]              │  ← Botão signOut
└─────────────────────┘
```

- Link ativo: fundo azul claro, texto azul escuro
- Links inativos: texto cinza, hover com fundo cinza suave
- `usePathname()` para detectar rota ativa

**Layout raiz `(crm)/layout.tsx`:**
```tsx
<div className="flex h-screen">
  <Sidebar userEmail={user.email} />
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

---

## Seção 3 — Clientes (`/clientes`)

### Funcionalidades
- Listar todos os clientes do usuário em tabela (Nome, Empresa, E-mail, Telefone, Data)
- Busca em tempo real por nome ou empresa (client-side filter)
- Botão "Novo Cliente" → abre modal de criação
- Ação "Editar" por linha → abre modal com dados preenchidos
- Ação "Excluir" por linha → confirmação inline antes de deletar

### Formulário (modal)
Campos: Nome* | Empresa | E-mail | Telefone | Notas (textarea)

### Server Actions
- `createClient(formData)` — INSERT em clients
- `updateClient(id, formData)` — UPDATE em clients
- `deleteClient(id)` — DELETE em clients

### Queries
- `getClients()` — SELECT * FROM clients ORDER BY created_at DESC

---

## Seção 4 — Pipeline (`/pipeline`)

### Funcionalidades
- 3 cards de resumo no topo: total abertos (R$), total ganhos (R$), total perdidos (R$)
- Taxa de conversão: ganhos / (ganhos + perdidos) × 100%
- Barras de progresso visual do funil (abertos → ganhos)
- Tabela completa de deals com colunas: Cliente, Valor, Status (badge), Data de Fechamento
- Filtro por status (Todos / Abertos / Ganhos / Perdidos) — client-side

### Queries
- `getPipelineDeals()` — SELECT deals JOIN clients (se client_id existir), ORDER BY created_at DESC

---

## Seção 5 — Kanban (`/kanban`)

### Colunas
3 colunas fixas: **Abertos** | **Ganhos** | **Perdidos**

### Card de deal
```
┌───────────────────┐
│ Nome do Cliente   │
│ R$ 5.000,00       │
│ [→ Ganho] [→ Perd]│
└───────────────────┘
```

Botões condicionais:
- Coluna Abertos: botões "Marcar Ganho" e "Marcar Perdido"
- Coluna Ganhos: botão "Reabrir"
- Coluna Perdidos: botão "Reabrir"

Botão "Novo Deal" (canto superior direito) → modal:
- Selecionar cliente (dropdown dos clients cadastrados)
- Valor (R$)
- Status inicial: Aberto

### Server Actions
- `moveDeal(id, newStatus)` — UPDATE deals SET status = newStatus
- `createDeal(clientId, value)` — INSERT em deals com client_id e client_name derivado

### Queries
- `getKanbanDeals()` — SELECT deals com client info, agrupados por status

---

## Seção 6 — Configurações (`/configuracoes`)

### Funcionalidades
- Card "Meta do Mês Atual" — mostra meta atual ou "Nenhuma meta definida"
- Formulário para definir/editar meta do mês atual (campo numérico em R$)
- Tabela histórico: últimos 6 meses com colunas Mês | Meta | Total Ganho | % Atingido

### Comportamento
- Se não existir meta para o mês atual: formulário de criação
- Se existir: formulário de edição com valor atual preenchido
- Usa admin client (service role) para INSERT/UPDATE em monthly_goals (tabela sem política de escrita para usuários)

### Server Action
- `saveMeta(month, value)` — UPSERT em monthly_goals via admin client

---

## Estilo Visual

- Sidebar: fundo branco, borda direita cinza claro
- Área de conteúdo: fundo `gray-50`
- Paleta: tons de cinza e azul corporativo (consistente com o dashboard existente)
- Componentes: shadcn/ui (card, badge, button, input, dialog, progress)
- Fonte: Inter (já configurada)
- Layout responsivo: sidebar recolhe em mobile

---

## Fora de Escopo

- Drag and drop no Kanban (botões de mover em vez de arrastar)
- Convite de membros / multi-usuário na mesma conta
- Edição de perfil / senha
- Relatórios exportáveis
- Notificações
