# QUESTIONS.md — Code Review & Perguntas Técnicas

> Documento gerado após revisão completa do codebase. Cada questão é independente e deve ser respondida
> diretamente neste arquivo. Após as respostas, as melhorias serão implementadas com base nelas.
>
> **Ordenado por urgência/criticidade:** CRÍTICO → ALTO → MÉDIO → BAIXO

---

## 🔴 CRÍTICO — Vulnerabilidades de segurança e integridade de dados

### Q1 — Ausência de autenticação nas rotas de API de mutação

Todas as rotas de API que criam/atualizam/deletam dados (servants, areas, ministries, assignments,
schedule-periods) usam `createAdminClient()` (service role key) mas **não verificam se o usuário
chamador é autenticado nem se tem permissão** para a operação. Qualquer pessoa com acesso à URL da
API pode criar ou deletar servos, áreas e períodos sem nenhuma sessão válida.

**Exemplo:** `POST /api/escalas/servants` cria um servo sem checar quem está chamando.

Isso é intencional? O projeto tem proteção de rede (Vercel protections) ou WAF que restringe o acesso?
Ou devemos implementar verificação de sessão + papel (admin/ministry_leader) em cada rota?

---

### Q35 — Módulo de Bookings sem validação de conflito no servidor

O módulo de agendamentos não tem rotas de API visíveis — a lógica parece rodar no cliente
diretamente via Supabase. Validações críticas como detecção de conflito de horário, verificação
de disponibilidade de ambiente e regras de negócio de reserva estão no lado do cliente, onde
podem ser bypassadas. Isso é intencional? Devemos mover para API routes server-side?

---

### Q11 — Ausência de transações em operações multi-step

Várias operações críticas têm múltiplos passos sem transação:

1. **Criação de servo**: insere em `servants` → insere em `servant_areas` (se falhar, servo fica sem área na junction)
2. **Atualização de áreas do servo**: deleta `servant_areas` → insere novamente (se o insert falhar, servo fica sem nenhuma área)
3. **Submissão de disponibilidade**: deleta registros antigos → insere novos (se insert falhar, dados somem)

O Supabase suporta transações via RPC (funções PostgreSQL). Devemos encapsular essas operações em
funções PL/pgSQL para garantir atomicidade? Ou o risco de falha parcial é aceitável?

---

### Q2 — Qualquer um pode submeter disponibilidade por qualquer servo

`POST /api/escalas/availability` aceita `servant_id` no body sem verificar se quem está chamando
**é aquele servo**. A única "proteção" é o token no link — mas o token autentica o *período*, não
o *servo*. Se alguém souber o `servant_id` de outro (é um UUID, mas ainda...) e tiver o link do
período, pode submeter disponibilidade em nome de outro.

Isso é um risco aceitável dado o contexto (sistema interno da igreja)? Ou devemos vincular a
submissão ao email informado no formulário e verificar que o `servant_id` corresponde?

---

### Q14 — Falha silenciosa na sincronização de servant_areas

```typescript
// PUT /api/escalas/servants/[id]
if (area_ids && area_ids.length > 0) {
  await supabase.from("servant_areas").delete().eq("servant_id", id)
  await supabase.from("servant_areas").insert(...)  // erro não verificado
}
```

Se o insert de `servant_areas` falhar após o delete, o servo fica sem nenhuma área registrada na
junction table, mas o `servants.area_id` ainda aponta para a área anterior. O erro não é propagado
para o cliente. Devemos verificar e retornar erro se a sincronização falhar?

---

### Q28 — Sem tratamento de erro na sincronização de servant_areas no PUT

```typescript
await supabase.from("servant_areas").delete().eq("servant_id", id)
await supabase.from("servant_areas").insert(area_ids.map(...))
// Nenhuma verificação de erro nos dois awaits acima
```

Se qualquer uma dessas operações falhar, o servo ficará com dados inconsistentes mas o cliente
receberá um `200 OK` com os dados do servo (que só refletem o update de `servants`, não o de
`servant_areas`). Devemos verificar os erros e retornar 500 se a sincronização falhar?

---

### Q23 — Ausência de validação de ownership no DELETE de período

`DELETE /api/escalas/schedule-periods/[id]` verifica apenas se o status é "published" para bloquear
o delete, mas não verifica se o usuário tem permissão sobre aquele ministério. Um admin de um
ministério poderia deletar períodos de outros ministérios?

---

### Q3 — Admin client usado onde não é necessário

Várias rotas de leitura usam `createAdminClient()` (service role, bypassa RLS) quando poderiam
usar `createServerClient()` com RLS. Por exemplo, `GET /api/escalas/servants`,
`GET /api/escalas/ministries/[id]`, `GET /api/escalas/schedule-periods/[id]/availability`.

O uso excessivo do admin client significa que se qualquer endpoint for comprometido, ele tem acesso
total ao banco sem restrições de RLS. Devemos migrar leituras para `createServerClient()` onde
o RLS permite? Ou o RLS ainda não está configurado adequadamente para isso?

---

## 🟠 ALTO — Bugs e comportamentos incorretos

### Q8 — Auto-fill ignora servos em áreas secundárias (servant_areas)

`POST /api/escalas/schedule-periods/[id]/auto-fill-availability` busca servos assim:

```typescript
const { data: servants } = await supabase
  .from("servants")
  .select("id, name")
  .in("area_id", areaIds)  // ← só área primária!
  .eq("is_active", true)
```

Servos que pertencem ao ministério **apenas** via `servant_areas` (área secundária, sem ter `area_id`
naquele ministério) **não serão incluídos** no auto-fill. Isso é um bug? Devemos também buscar por
`servant_areas`?

---

### Q26 — GET /api/escalas/assignments com period_id pode não funcionar

```typescript
query = query.eq("event.period_id", periodId)  // filtra em campo de relação aninhada
```

Filtrar por um campo de uma tabela relacionada (`event.period_id`) no PostgREST do Supabase
normalmente requer `.eq()` em uma relação explícita ou um join diferente. Esse filtro funciona
corretamente? Foi testado? Poderia ser mais explícito usando um select + filter via RPC.

---

### Q7 — Dual tracking de área do servo: `area_id` FK + tabela `servant_areas`

O banco tem dois mecanismos paralelos para rastrear a área de um servo:
1. `servants.area_id` — coluna FK direta (área "primária")
2. Tabela junction `servant_areas` — suporte a múltiplas áreas

Isso cria inconsistência: ao criar um servo, insere em `servants.area_id` **e** em `servant_areas`.
Ao fazer soft-delete, o registro em `servant_areas` **não é removido**. Ao buscar servos por área,
algumas queries usam `.eq("area_id", areaId)` (só pega a primária), outras verificam ambas.

A intenção é manter `area_id` como coluna legada e migrar 100% para `servant_areas`? Ou `area_id`
deve sempre ser a área principal? Se for manter as duas, precisamos de um constraint de banco
garantindo que `area_id` sempre esteja presente em `servant_areas`.

---

### Q24 — event_id na submissão de disponibilidade não é validado contra o período

```typescript
// POST /api/escalas/availability
const { servant_id, period_id, availabilities } = validationResult.data
// Não verifica se os event_ids pertencem ao period_id
await supabase.from("servant_availability").insert(availabilityRecords)
```

Um submissor poderia enviar `event_id`s de um período diferente. Devemos validar que todos os
`event_id`s do array pertencem ao `period_id` informado?

---

### Q22 — Fallbacks de query para schema antigo em ministries/[id]

```typescript
// Tenta com leader/co_leader → fallback sem leaders → fallback sem servant_areas
let result = await supabase.from("ministries").select(`*, leader:servants!ministries_leader_id_fkey...`)
if (result.error) { result = await supabase.from("ministries").select(`*, areas(...)`) }
if (result.error) { result = await supabase.from("ministries").select(`*, areas(servants...)`) }
```

Três tentativas de query com fallbacks para lidar com schemas diferentes indica que as migrações
de banco não foram aplicadas de forma confiável em todos os ambientes. O schema atual do banco em
produção tem as colunas `leader_id` e `co_leader_id` nas ministries? Se sim, os fallbacks podem
ser removidos. Se não, precisamos de uma migration.

---

## 🟡 MÉDIO — Performance e segurança secundária

### Q30 — Sem rate limiting na submissão de disponibilidade

`POST /api/escalas/availability` é um endpoint **público** (não requer autenticação) que pode ser
chamado repetidamente por qualquer um. Alguém com o link pode submeter disponibilidades em massa
para todos os `servant_id`s. Precisamos de rate limiting (ex.: por IP, por `servant_id`, por
`period_id`)? O Vercel tem proteções nativas ou precisamos implementar?

---

### Q33 — `availability_token` nunca expira ou é rotacionado

O token de disponibilidade é gerado uma vez e nunca muda. Se o link vazar, qualquer pessoa pode
acessar o formulário enquanto o período estiver em "collecting". Devemos implementar expiração
do token (vinculado ao `availability_deadline`) ou rotação (gerar novo token ao mudar status)?

---

### Q12 — Filtro de servants por ministry_id feito em JavaScript, não no banco

```typescript
// GET /api/escalas/servants
const { data: allData } = await query // Busca TODOS os servos ativos
if (ministryId) {
  const filtered = allData.filter(...)  // Filtra em JS
}
```

O mesmo problema existe em `/api/escalas/availability/[token]/route.ts`. Isso significa que
**todos os servos do banco** são carregados na memória antes de filtrar. Com poucos servos é ok,
mas não escala. Devemos mover o filtro para o banco (via JOIN com servant_areas)?

---

### Q13 — Query aninhada muito profunda no GET /schedule-periods/[id]

```typescript
select(`*, ministry(*), events:schedule_events(*, assignments:schedule_assignments(*, servant(*), area(*)))`)
```

Esse select carrega o período inteiro com todos os eventos, todas as atribuições, todos os servos e
áreas em uma única query. Para um período com 30 eventos e 5 áreas cada, isso pode retornar centenas
de registros aninhados. Isso é usado em qual contexto? Deveria ser paginado ou lazy-loaded?

---

### Q10 — Cron job faz HTTP call para si mesmo

```typescript
const res = await fetch(`${appUrl}/api/escalas/schedule-periods/${period.id}/auto-fill-availability`, ...)
```

O cron chama outro endpoint da mesma aplicação via HTTP em vez de chamar a lógica diretamente. Isso:
- Adiciona latência desnecessária
- Pode falhar se `NEXT_PUBLIC_APP_URL` estiver errado
- Cria dependência circular (self-calling)
- Em ambiente local/preview, pode chamar a URL errada

A lógica de auto-fill deveria ser extraída para uma função compartilhada. Isso é intencional ou foi
feito por conveniência?

---

### Q19 — N+1 queries no syncMinistryRoles

```typescript
for (const servant of servants) {
  // Query individual por servant no loop
  const { data: profile } = await supabase.from("profiles").select("id").eq("email", servant.email).single()
  ...
  await supabase.from("servants").update({ user_id: profile.id }).eq("id", servant.id)
  ...
  await supabase.from("user_ministry_roles").delete()...
  await supabase.from("user_ministry_roles").upsert(...)
  await supabase.from("profiles").update(...)
}
```

O `syncMinistryRoles` executa múltiplas queries individuais em loop (N+1). Para um ministério com
muitos líderes históricos, isso pode ser lento. Devemos reescrever usando bulk operations ou uma
função RPC no banco?

---

### Q9 — Deduplicação por nome no auto-fill é frágil

```typescript
if (seenNames.has(nameLower)) return false
```

Dois servos diferentes com o mesmo nome serão tratados como duplicatas e só um receberá o auto-fill.
O critério correto deveria ser por `servant_id` único, não por nome. A deduplicação por nome foi
adicionada para lidar com qual caso específico? Servos com múltiplas entradas no banco (registros
duplicados)? Se sim, o problema não deveria ser resolvido na origem (evitar duplicatas no cadastro)?

---

### Q16 — Status de período sem máquina de estados explícita

O status do período (`draft → collecting → scheduling → published → closed`) pode ser atualizado para
qualquer valor via `PUT /api/escalas/schedule-periods/[id]`:

```typescript
status: z.enum(["draft", "collecting", "scheduling", "published", "closed"]).optional()
```

Não há validação de transições válidas. Por exemplo: pode-se mudar de `published` de volta para
`draft`, ou pular de `draft` direto para `closed`. Devemos implementar uma máquina de estados que
valide transições permitidas? Quais transições são válidas?

---

### Q6 — Token de disponibilidade armazenado em texto simples

O `availability_token` é armazenado em texto puro na tabela `schedule_periods`. Se o banco for
comprometido, todos os tokens ficam expostos. Considerando que o token é o único mecanismo de acesso
ao formulário público, devemos armazenar um hash (como é feito com senhas) e comparar na query?
Ou o risco é aceitável dado que são tokens de curta duração?

---

### Q5 — Cron job sem validação de IP de origem

O endpoint `GET /api/cron/auto-fill-availability` valida apenas o header `Authorization: Bearer CRON_SECRET`.
Não há validação de que a chamada vem da Vercel. O Vercel Cron envia um header `x-vercel-signature`
que pode ser verificado para garantir a origem. Devemos adicionar essa validação?

---

### Q18 — Ausência de paginação em todas as listagens

Nenhum endpoint de listagem tem paginação: `GET /servants`, `GET /areas`, `GET /schedule-periods`,
`GET /assignments`. Com o crescimento do sistema (múltiplos ministérios, anos de histórico), essas
queries podem se tornar lentas. Devemos implementar paginação (limit/offset ou cursor-based)?
Ou o volume esperado de dados é sempre pequeno?

---

### Q20 — Cache de sessão do servidor pode não funcionar em API routes

```typescript
export const createServerClient = cache(async () => { ... })
```

O `cache()` do React foi projetado para Server Components, não para API Routes (que rodam no Node.js
runtime). Em API Routes, cada request cria uma nova instância do módulo, então o `cache()` não
tem efeito entre requests. Isso pode estar gerando instâncias desnecessárias. Devemos verificar o
comportamento e potencialmente usar uma abordagem diferente de cache para API routes?

---

## 🟢 BAIXO — Qualidade de código, UX e melhorias futuras

### Q15 — Módulo de Agendamentos (Bookings): onde estão as rotas de API?

A exploração do código não encontrou `app/api/bookings/` nem `app/api/admin/`. O módulo de
agendamentos existe como página (`/booking`) mas sem API routes visíveis. As bookings são gerenciadas
diretamente pelo cliente Supabase no frontend (sem passar por API routes)? Isso significa que a
lógica de validação de conflitos, disponibilidade de ambientes, etc., roda no frontend sem validação
no servidor?

---

### Q25 — `isMinistryLeader` verifica qualquer role, incluindo "coordinator"

```typescript
const isMinistryLeader = useCallback((ministryId: string) => {
  return ministryRoles.some(r => r.ministry_id === ministryId)  // qualquer role!
}, [ministryRoles])
```

A função retorna `true` tanto para `role: "leader"` quanto para `role: "coordinator"`. Em alguns
contextos no código, isso pode dar acesso a funcionalidades que deveriam ser exclusivas do líder.
Isso é intencional? O co-líder tem exatamente as mesmas permissões que o líder no sistema?

---

### Q17 — Soft delete não limpa dados relacionados

Quando um servo é desativado (`is_active: false`), seus registros em `servant_areas` permanecem.
Quando um ministério é desativado, suas áreas e servos continuam ativos. Isso é comportamento
intencional (para auditoria/recuperação)? Ou devemos cascadear o soft delete para os relacionamentos?

---

### Q29 — Sem notificação por email quando a escala é publicada

Quando um período muda de status para "published", não há envio de email/notificação para os servos
escalados. O sistema tem integração com Resend (usado para confirmação de cadastro e reset de senha).
Está previsto implementar notificação de publicação de escala? Qual seria o conteúdo desejado?

---

### Q4 — Console.log com dados de autenticação em produção

O `auth-provider.tsx` tem vários `console.log` e `console.warn` com informações de sessão e eventos
de auth:

```
console.log('🔄 Inicializando autenticação...')
console.log('✅ Sessão encontrada')
console.log('🔄 Auth event:', event)
```

Esses logs ficam visíveis no browser do usuário (DevTools). Devemos remover ou colocar atrás de uma
flag `process.env.NODE_ENV === 'development'`?

---

### Q40 — Sem variável de ambiente de validação no startup

Não há um arquivo de configuração que valide na inicialização da aplicação se todas as variáveis
de ambiente obrigatórias estão presentes (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, etc.). A ausência silenciosa de qualquer uma delas pode
causar bugs difíceis de rastrear. Devemos adicionar validação com Zod no startup?

---

### Q36 — Sem proteção contra criação de múltiplos períodos "collecting" para o mesmo ministério

O banco tem unique constraint em `(ministry_id, month, year)`, mas não impede que um ministério
tenha múltiplos períodos em status "collecting" de meses diferentes ao mesmo tempo. Isso é
permitido? Ou um ministério só deveria ter um período "collecting" de cada vez?

---

### Q31 — Sem validação do formato de `event_time` no schema de eventos

```typescript
// POST /api/escalas/schedule-events
event_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Hora inválida"),
```

Esse regex valida o formato mas não se é um horário válido (ex.: `25:99:00` passaria). Devemos
usar `z.string().time()` do Zod ou uma validação mais robusta?

---

### Q27 — signOut faz redirect imperativo quebrando o estado do router

```typescript
const signOut = async () => {
  await supabase.auth.signOut()
  window.location.href = '/login'  // Hard redirect!
}
```

Usar `window.location.href` força um full page reload em vez de usar o Next.js router, o que
descarta todo o estado React e é mais lento. Devemos usar `router.push('/login')` após o logout?
Ou o full reload é intencional para garantir limpeza de estado/cookies?

---

### Q21 — Uso extensivo de `any` nos tipos

As rotas de API usam `any` em filtros e loops:

```typescript
const filtered = (allData ?? []).filter((s: any) => { ... })
s.servant_areas?.some((sa: any) => ...)
```

Os tipos em `types/escalas.ts` existem mas não são usados nas rotas de API. Devemos tipar
corretamente os retornos do Supabase usando os tipos definidos ou gerando tipos automaticamente
com `supabase gen types`?

---

### Q32 — Ausência de histórico/auditoria de mudanças

Não há log de auditoria de quem alterou o quê (quem mudou o status do período, quem atribuiu
qual servo, etc.). Para um sistema de gestão de escala, isso pode ser importante para resolver
disputas ou entender o histórico. Está nos planos implementar uma tabela de audit log?

---

### Q34 — Sem confirmação de presença no dia do evento

O sistema coleta disponibilidade prévia e monta a escala, mas não há mecanismo para confirmar
presença no dia do evento (ou registrar falta). O campo `confirmed` e `confirmed_at` existem
em `schedule_assignments` mas não parecem ser usados. Há planos para usar isso? Como seria o fluxo?

---

### Q37 — `vercel.json` e configuração do cron: está correto?

O cron job de auto-fill é mencionado no código mas não verificamos o `vercel.json`. O cron está
configurado corretamente? Com que frequência roda? O `CRON_SECRET` está configurado como variável
de ambiente no Vercel?

---

### Q38 — Falta de feedback no formulário quando servant não é encontrado por email

No `AvailabilityForm`, quando o usuário digita um email e não é encontrado como servo do ministério,
qual é a experiência? O sistema permite submeter uma disponibilidade com qualquer email mesmo que
não seja um servo cadastrado? Ou bloqueia? Devemos ver se há validação suficiente no frontend.

---

### Q39 — Imports não utilizados nas rotas

Várias rotas importam `createServerClient` e `createAdminClient` mas só usam um deles:

```typescript
// servants/route.ts
import { createAdminClient, createServerClient } from "@/lib/supabase/server"
// createServerClient nunca é usado neste arquivo
```

Devemos limpar os imports não utilizados?

---

*Responda cada questão diretamente neste arquivo abaixo da pergunta correspondente.*
*Após as respostas, as implementações serão feitas com base no que for definido aqui.*
