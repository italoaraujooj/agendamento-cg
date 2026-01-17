# Configuração do Google Auth no Supabase

## Passo 1: Configurar Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Navegue para "APIs e Serviços" > "Credenciais"
4. Clique em "Criar credenciais" > "ID do cliente OAuth"
5. Configure a tela de consentimento OAuth:
   - Tipo de usuário: Externo
   - Nome do app: Sistema de Agendamento - Cidade Viva CG
   - Email do suporte: seu-email@exemplo.com
   - Domínios autorizados: localhost (para desenvolvimento)
   - Links: Adicione links relevantes
6. Selecione "Aplicativo Web" como tipo de aplicativo
7. Adicione URIs de redirecionamento autorizados:
   - Para desenvolvimento: `http://localhost:3000/auth/callback`
   - Para produção: `https://seusite.com/auth/callback`
8. Anote o **Client ID** e **Client Secret**

## Passo 2: Configurar Supabase

1. Acesse seu [Supabase Dashboard](https://app.supabase.com/)
2. Selecione seu projeto
3. Navegue para "Authentication" > "Providers"
4. Ative o Google provider
5. Cole o **Client ID** e **Client Secret** do Google Cloud Console
6. Configure as opções:
   - Redirect URLs: Adicione as URLs de callback
   - Enable sign-in with Google

## Passo 3: Configurar Escopos do Google (Opcional)

Para integração com Google Calendar, você pode precisar de escopos adicionais:

1. No Google Cloud Console, vá para "APIs e Serviços" > "Biblioteca"
2. Ative a "Google Calendar API"
3. Volte para as credenciais OAuth
4. Edite o ID do cliente OAuth
5. Adicione os escopos:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`

## Passo 4: Configurar Variáveis de Ambiente

Adicione ao seu arquivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_supabase_anon_key
```

## Passo 5: Testar a Configuração

1. Execute o sistema
2. Clique no botão "Entrar com Google"
3. Verifique se o login funciona corretamente
4. Teste a criação de reservas (deve incluir o user_id automaticamente)

## Configuração de Produção

Para produção, certifique-se de:

1. Configurar os domínios corretos no Google Cloud Console
2. Atualizar as URLs de redirecionamento no Supabase
3. Verificar se as APIs necessárias estão ativadas
4. Configurar as variáveis de ambiente corretas

## Resolução de Problemas

### Erro: "Invalid OAuth access token"
- Verifique se o Client ID e Secret estão corretos
- Confirme se as URLs de redirecionamento estão configuradas

### Erro: "redirect_uri_mismatch"
- Verifique se a URL de callback está exatamente igual no Google Cloud Console e Supabase

### Erro: "Access blocked: This app's request is invalid"
- Verifique se a tela de consentimento OAuth está completamente configurada
- Confirme se o aplicativo está publicado ou em modo de teste

## Próximos Passos

Após configurar o Google Auth:

1. Execute a migração `005-add-authentication.sql`
2. Teste o sistema completo
3. Implemente a integração com Google Calendar (Edge Functions)
4. Configure permissões adicionais conforme necessário
