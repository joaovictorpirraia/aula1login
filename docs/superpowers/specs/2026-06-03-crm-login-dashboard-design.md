# CRM de Vendas — Login + Dashboard

**Data:** 2026-06-03  
**Status:** Aprovado (revisado após 4 rounds de code review)

---

## Visão Geral

Sistema web de CRM focado em vendas com autenticação individual por vendedor e dashboard de métricas. Cada usuário acessa apenas seus próprios dados. Deploy totalmente self-hosted via EasyPanel.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Frontend / Backend | Next.js 14 (App Router) |
| Autenticação + Banco | Supabase self-hosted |
| Gráficos | Recharts |
| Estilo | Tailwind CSS + shadcn/ui |
| Deploy | EasyPanel |

---

## Arquitetura

```
/login          → Tela pública de autenticação
/dashboard      → Rota protegida (redireciona se não logado)
/middleware.ts  → Intercepta todas as rotas exceto estáticos e /login exato
/api/           → Route Handlers do Next.js (se necessário)
```

O Next.js se comunica com o Supabase self-hosted via variáveis de ambiente configuradas no EasyPanel. A sessão é mantida em cookie seguro gerenciado pelo Supabase Auth via `@supabase/ssr`.

### Regra de cliente Supabase

- **Server Actions e componentes server-side:** usar `createServerClient` do `@supabase/ssr`, passando os cookies da requisição. Nunca usar a service role key neste contexto.
- **Middleware:** usar `createMiddlewareClient` do `@supabase/ssr` para validar a sessão.
- **Service role key:** reservada exclusivamente para scripts administrativos externos (ex: seed de dados). A service role key bypassa todo o RLS por design no PostgREST — por isso jamais deve aparecer em Server Actions ou componentes. Veja seção Segurança para detalhes.

### Middleware matcher

Em Next.js 14 App Router, Server Actions fazem POST na rota da página que as contém (ex: `/dashboard`), não em `/api/`. O middleware cobre todas as rotas exceto as explicitamente públicas, usando ancoragem exata para `/login`:

```ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|login$|login/).*)',
  ],
}
```

`login$` garante que apenas a rota `/login` exata é excluída — rotas como `/admin/loginhistory` ou `/loginX` não são afetadas. O RLS é a camada de segurança de dados final e funciona independentemente do middleware.

---

## Telas

### Tela 1 — Login (`/login`)

- Formulário com campos: e-mail e senha
- Botão "Entrar"
- Mensagem de erro para credenciais inválidas
- Após login bem-sucedido: redireciona para `/dashboard`
- Sem cadastro público — usuários criados pelo admin diretamente no painel do Supabase
- Estilo: light mode, centralizado, card com sombra suave
- **Proteção contra brute-force:** ver configuração completa na seção Deploy → Proteção brute-force

### Tela 2 — Dashboard (`/dashboard`)

Layout dividido em quatro blocos verticais:

**Header**
- Logo do CRM à esquerda
- Nome do usuário logado e botão "Sair" à direita

**Bloco 1 — Cards de Métricas (3 cards lado a lado)**
- **Total de Vendas:** soma de `value` dos `deals` com `status = 'won'` onde `closed_date` está no mês calendário atual em UTC (ex: `closed_date >= '2026-06-01' AND closed_date < '2026-07-01'`)
- **Negócios Abertos:** contagem de `deals` com `status = 'open'` (sem filtro de data — todos os abertos)
- **Meta do Mês:** barra de progresso — `(total_won / goal_value) × 100%`
  - Se não houver linha em `monthly_goals` para o mês atual: exibir o card com texto "Sem meta definida" e barra vazia (0%), sem erro

**Bloco 2 — Gráfico de Vendas**
- Gráfico de barras — soma de `value` dos deals com `status = 'won'` agrupados por `closed_date` **no mês calendário atual em UTC**
- Mesmo filtro do card Total de Vendas: `closed_date >= '2026-06-01' AND closed_date < '2026-07-01'`
- Componente Recharts, responsivo

**Bloco 3 — Tabela de Negócios Recentes**
- Colunas: Cliente | Valor | Status | Data
- Exibe os 10 negócios mais recentes do usuário logado, ordenados por `created_at DESC`
- Status com badge colorido: Ganho (verde), Aberto (azul), Perdido (vermelho)

**Performance e cache das queries:**
- O servidor Next.js calcula os limites do mês em UTC em JavaScript antes de passar para as queries (ex: `new Date(Date.UTC(year, month, 1))`)
- As 5 queries do dashboard são executadas em paralelo com `Promise.all([...])` dentro do Server Component
- **Cache por usuário:** usar `unstable_cache` do `next/cache` com cache key que inclui o `user_id` e o mês atual. Revalidar a cada 60 segundos. Isso garante isolamento total entre usuários (cada usuário tem sua própria entrada de cache) e evita re-execução a cada request

```ts
// Padrão correto — cache isolado por usuário:
const getCachedDeals = unstable_cache(
  async (userId, monthStart, monthEnd) => supabase.from('deals')...,
  ['dashboard-deals'],
  { revalidate: 60, tags: [`user-${userId}`] }
)
```

- **IMPORTANTE:** NÃO usar `cache()` do React para este caso — ele é escopo de render, não de request, e não persiste entre requests. NÃO usar `unstable_cache` sem incluir `user_id` na cache key — isso causaria vazamento de dados entre usuários

---

## Banco de Dados (Supabase PostgreSQL)

**Timezone do PostgreSQL:** configurar `PGTZ=UTC` no container para garantir que todas as operações de data/hora sejam em UTC.

**Nome do banco de dados:** o Supabase self-hosted usa `postgres` como nome padrão do banco. Verificar e documentar o nome real antes de configurar scripts de backup.

### Tabela `users`
Gerenciada automaticamente pelo Supabase Auth.

```sql
id          uuid PRIMARY KEY
email       text
created_at  timestamp
```

### Tabela `deals`
```sql
id           uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id      uuid NOT NULL REFERENCES auth.users(id)
client_name  text NOT NULL
value        numeric(12, 2) NOT NULL
status       text NOT NULL CHECK (status IN ('open', 'won', 'lost'))
created_at   timestamp DEFAULT now()
closed_at    timestamp
closed_date  date
updated_at   timestamp DEFAULT now()
```

`closed_date` é uma coluna regular (não generated column) mantida pelo trigger. Armazena `closed_at::date` em UTC. Usada como campo de agrupamento no gráfico e filtro de período, evitando funções STABLE em expressões de índice.

**Regra de integridade para `closed_at` e `closed_date`:**

```sql
CREATE OR REPLACE FUNCTION set_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Atalho: se status não mudou em UPDATE, não faz nada
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
    -- Reabertura: limpa campos de fechamento
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

Cobertura do trigger:
- UPDATE sem mudança de status: retorna imediatamente (sem overhead)
- INSERT com `status = 'won'` (seed/admin): `closed_at` e `closed_date` preenchidos
- `open → won` ou `open → lost`: `closed_at` e `closed_date` preenchidos
- `won → lost` ou `lost → won`: `closed_at` e `closed_date` existentes mantidos
- `won → open` ou `lost → open` (reabertura via aplicação): `closed_at` e `closed_date` limpos. **Esta é uma operação permitida a qualquer vendedor com permissão UPDATE — não requer intervenção admin**

### Tabela `monthly_goals`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id     uuid NOT NULL REFERENCES auth.users(id)
month       date NOT NULL
goal_value  numeric(12, 2) NOT NULL
CONSTRAINT uq_user_month UNIQUE (user_id, month),
CONSTRAINT chk_month_first_day CHECK (month = date_trunc('month', month)::date)
```

**Convenção:** `month` armazena sempre o primeiro dia do mês (`YYYY-MM-01`). O `CHECK` constraint impede inserção de qualquer outra data. Query de lookup: `WHERE month = date_trunc('month', now())::date` (PostgreSQL em UTC, consistente com o cálculo JavaScript do Next.js).

### Índices

```sql
-- Total de Vendas: range filter em closed_date
CREATE INDEX idx_deals_user_status_date ON deals (user_id, status, closed_date);

-- Gráfico: GROUP BY closed_date — mesmo índice acima já cobre
-- (closed_date é uma coluna regular; não há conflito com IMMUTABLE)

-- Tabela recente: ORDER BY created_at DESC
CREATE INDEX idx_deals_user_created ON deals (user_id, created_at DESC);

-- Lookup de meta mensal
CREATE INDEX idx_goals_user_month ON monthly_goals (user_id, month);
```

**Nota:** os índices `idx_deals_user_status_date` e `idx_deals_user_created` são não-redundantes:
- `idx_deals_user_status_date` serve queries com filtro de status + range/group por `closed_date`
- `idx_deals_user_created` serve a tabela de deals recentes que ordena por `created_at`, não por `closed_date`

---

## Segurança

### Row Level Security (RLS)

RLS ativado em todas as tabelas. Políticas explícitas:

```sql
-- Tabela deals
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

-- DELETE em deals: sem política definida.
-- Com RLS ativo, ausência de política = DENY implícito para todos os roles não-superuser.
-- Isso é INTENCIONAL: deletar deals está fora do escopo desta versão (ver Fora de Escopo).
-- Para habilitar deleção futura, adicionar política explícita neste ponto.

-- Tabela monthly_goals
ALTER TABLE monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals: leitura própria"
ON monthly_goals FOR SELECT
USING (auth.uid() = user_id);

-- INSERT, UPDATE e DELETE em monthly_goals: sem política definida.
-- Ausência de política = DENY implícito para usuários autenticados.
-- Operações de escrita exigem service role key (ver explicação abaixo).
-- NÃO adicionar políticas de INSERT/UPDATE/DELETE aqui.
```

### Como a service role key bypassa o RLS

No Supabase/PostgREST, o JWT da service role key faz o PostgREST executar queries como o role `postgres` (superuser), que não está sujeito a políticas RLS. Scripts admin com service role key podem escrever em `monthly_goals` sem política adicional. Usuários com anon/JWT normal são sempre sujeitos ao RLS.

### Camadas de autenticação

| Camada | Responsabilidade |
|---|---|
| Middleware Next.js | Bloqueia acesso a páginas sem sessão válida; redireciona para /login |
| `unstable_cache` com user_id na key | Garante que cache de dados não vaze entre usuários (correctness, não segurança primária) |
| RLS Supabase | **Autoridade final de isolamento de dados** — funciona mesmo se todas as camadas superiores falharem |
| `@supabase/ssr` | Propaga cookies de sessão corretamente para server-side |

### Env vars do Next.js

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública do Supabase (frontend + backend) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon para client-side e Server Actions |
| `SUPABASE_SERVICE_ROLE_KEY` | Apenas em scripts admin/seed externos. Bypassa RLS — nunca usar em Server Actions. |

---

## Deploy no EasyPanel

### Next.js
- Containerizado com `Dockerfile` multi-stage (build + produção)
- Variáveis de ambiente configuradas no painel do EasyPanel

### Supabase Self-Hosted
- Deploy via stack Docker oficial do Supabase no EasyPanel
- Serviços: Kong (API Gateway), GoTrue (Auth), PostgREST, PostgreSQL, Supabase Studio
- Configurado como serviço interno, acessível pelo Next.js via rede interna do EasyPanel
- **Timezone:** `PGTZ=UTC` no container PostgreSQL

### Proteção brute-force

**Kong (camada primária):**
- Plugin `rate-limiting` na rota `/auth/v1/token` (endpoint de autenticação por senha do GoTrue), tipo de match: prefixo exato da rota configurada no Kong para o serviço GoTrue
- Limite: máximo 5 requisições por minuto por IP

**GoTrue (camada secundária):**
- `GOTRUE_SECURITY_MAX_FAILED_ATTEMPTS=10` — bloqueia conta após 10 tentativas falhas consecutivas (verificar suporte na versão instalada)
- Alternativa se não suportado: `GOTRUE_SECURITY_CAPTCHA_ENABLED=true` + provedor de CAPTCHA

### Backup e Persistência do PostgreSQL

**Persistência:**
- O volume do container PostgreSQL deve ser declarado como **volume nomeado persistente** no EasyPanel (não anônimo)

**Backup externo obrigatório:**
- Backups devem ser armazenados **fora do host EasyPanel** — em storage externo como S3, Backblaze B2 ou Google Cloud Storage
- Configurar `rclone` ou script de upload para enviar o arquivo ao storage externo após cada execução
- Nunca armazenar backups apenas no mesmo disco do banco de dados

**Rotina de backup (formato custom para verificação confiável):**

```bash
# Usar -Fc (custom format) para habilitar pg_restore --list
pg_dump -Fc -U postgres -d postgres -f backup_$(date +%Y%m%d).dump

# Verificar integridade (funciona apenas com formato custom -Fc)
pg_restore --list backup_$(date +%Y%m%d).dump > /dev/null

# Upload para storage externo
rclone copy backup_$(date +%Y%m%d).dump remote:crm-backups/
```

- **Nome do banco:** o Supabase self-hosted usa `postgres` por padrão — confirmar com `psql -U postgres -c '\l'` antes de configurar o script
- Frequência: diária
- Retenção: mínimo 7 dias no storage externo
- Em caso de falha no upload ou verificação: script deve emitir alerta via email ou webhook

**Monitoramento:**
- Script de backup registra sucesso/falha em log e envia alerta em caso de falha
- Testar procedimento completo de restore em container separado antes do go-live:
  ```bash
  pg_restore -U postgres -d postgres_test backup_YYYYMMDD.dump
  ```

---

## Estilo Visual

- **Modo:** Light mode
- **Fonte:** Inter
- **Paleta:** Tons de cinza e azul corporativo
- **Componentes:** shadcn/ui (cards, tabelas, badges, botões)
- **Layout:** Responsivo, sidebar-free (header fixo no topo)

---

## Fora de Escopo (nesta versão)

- Cadastro de novos usuários pela interface
- Gestão de clientes (CRUD de deals via dashboard)
- Deleção de deals via dashboard (DELETE bloqueado por RLS intencionalmente)
- Funil Kanban
- Notificações
- Relatórios exportáveis
