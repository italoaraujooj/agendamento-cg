## Agendamento CG — Guia para rodar o projeto

[![Deploy na Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/italoaraujoojs-projects/v0-church-room-scheduler)

### Visão geral
Aplicação Next.js para agendamento de salas/ambientes, utilizando Supabase para persistência de dados.

### Requisitos
- Node.js 20 LTS (recomendado) ou 18.18+
- PNPM 9+ (ou npm/yarn; os comandos abaixo usam pnpm)

### Passo a passo (primeira execução)
1) Instale dependências
```bash
pnpm install
```

2) Configure variáveis de ambiente
Crie um arquivo `.env.local` na raiz do projeto com as chaves do seu projeto Supabase:
```env
NEXT_PUBLIC_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="SUA-CHAVE-ANON"
```
Como obter:
- No painel do Supabase: Project Settings → API
  - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
  - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

3) (Opcional) Preparar o banco no Supabase
Os arquivos SQL em `scripts/` podem ser executados no SQL Editor do Supabase, na ordem:
- `scripts/001-create-tables.sql`
- `scripts/002-insert-church-spaces.sql`
- `scripts/003-setup-complete-database.sql`
- `scripts/004-setup-database-fixed.sql`
 - `scripts/005-add-environment-availability.sql` (cria e popula a tabela de disponibilidades)

4) Rodar em desenvolvimento
```bash
pnpm dev
```
A aplicação sobe por padrão em `http://localhost:3000`.

### Scripts disponíveis
- `pnpm dev`: inicia o servidor de desenvolvimento
- `pnpm build`: cria o build de produção
- `pnpm start`: roda o servidor em modo produção (após `pnpm build`)
- `pnpm lint`: executa o linter

### Deploy (Vercel)
- Configure as mesmas variáveis de ambiente do `.env.local` no painel da Vercel (Project → Settings → Environment Variables)
- Faça o deploy do projeto; o Next.js cuidará do build

### Estrutura do projeto (resumo)
- `app/`: rotas e páginas (App Router)
- `components/`: componentes reutilizáveis (inclui UI base)
- `lib/`: utilidades e clientes (ex.: `lib/supabase/`)
- `scripts/`: scripts SQL para preparar o banco no Supabase

### Solução de problemas
- Mensagem “Supabase environment variables are not set.”: confira se `.env.local` está preenchido e se o servidor foi reiniciado após mudanças
- 401/403 do Supabase: verifique se a chave anon está correta e se as políticas RLS/permits no banco permitem as operações esperadas
- Erros de build: garanta Node 20+ e dependências instaladas com sucesso
