# Configuração Google OAuth para Calendar Integration

## 🚨 ERRO 404 - SOLUÇÃO

Se você está recebendo um erro 404 ao clicar em "Configurar integração", o problema está na configuração das URLs de redirecionamento no Google Cloud Console.

### ✅ URLs Corretas para Configurar

**Para desenvolvimento (localhost:3000):**
- **Origens JavaScript Autorizadas**: `http://localhost:3000`
- **URIs de Redirecionamento**: `http://localhost:3000/auth/callback`

**Para produção:**
- **Origens JavaScript Autorizadas**: `https://seu-dominio.com`
- **URIs de Redirecionamento**: `https://seu-dominio.com/auth/callback`

## 📋 Pré-requisitos

1. **Conta Google Cloud Console**: https://console.cloud.google.com/
2. **Projeto Supabase** configurado
3. **Domínio autorizado** (para produção)

## 🔧 Passo 1: Ativar APIs Necessárias

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Vá para **"APIs & Services" > "Library"**
4. Ative as seguintes APIs:
   - **Google Calendar API**
   - **Google+ API** (para informações do perfil)

## 🔑 Passo 2: Configurar OAuth Consent Screen

1. No menu lateral, vá para **"APIs & Services" > "OAuth consent screen"**
2. Escolha **"External"** (para usuários externos)
3. Preencha as informações:
   - **App name**: "Sistema de Agendamento CG"
   - **User support email**: seu-email@gmail.com
   - **Developer contact information**: seu-email@gmail.com
4. Clique em **"Save and Continue"**
5. Na seção **Scopes**, clique em **"ADD OR REMOVE SCOPES"** e adicione:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/userinfo.email`
   - `https://www.googleapis.com/auth/userinfo.profile`
6. Clique em **"UPDATE"** e depois **"Save and Continue"**
7. Adicione usuários de teste (opcional para desenvolvimento)
8. Clique em **"Save and Continue"**

## 🎯 Passo 3: Criar Credenciais OAuth

1. Vá para **"APIs & Services" > "Credentials"**
2. Clique em **"+ CREATE CREDENTIALS" > "OAuth 2.0 Client IDs"**
3. Configure:
   - **Application type**: "Web application"
   - **Name**: "Sistema Agendamento CG"
4. Em **"Authorized JavaScript origins"**, adicione:
   - `http://localhost:3000` (desenvolvimento)
   - `https://your-domain.com` (produção)
5. Em **"Authorized redirect URIs"**, adicione:
   - `http://localhost:3000/auth/callback` (desenvolvimento)  
   - `https://your-domain.com/auth/callback` (produção)
6. Clique em **"Create"**
7. **IMPORTANTE**: Anote os valores:
   - **Client ID**
   - **Client Secret**

## 🔐 Passo 4: Configurar Variáveis de Ambiente

### No arquivo `.env.local` (desenvolvimento):

```bash
# Google OAuth
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=your_google_client_id_here
GOOGLE_OAUTH_CLIENT_SECRET=your_google_client_secret_here

# Supabase (já existentes)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### No Supabase Dashboard:

1. Vá para **"Settings" > "Edge Functions"**
2. Adicione as variáveis de ambiente:
   - `GOOGLE_OAUTH_CLIENT_ID`: seu Client ID
   - `GOOGLE_OAUTH_CLIENT_SECRET`: seu Client Secret
   - `SUPABASE_URL`: URL do seu projeto Supabase
   - `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key

## 🚀 Passo 5: Executar Scripts SQL

Execute os scripts em ordem no **Supabase SQL Editor**:

```sql
-- 1. Configuração da integração Google Calendar
-- scripts/007-google-calendar-integration.sql

-- 2. Scripts de exemplo e verificação
-- scripts/setup-google-calendar-integration.sql
```

## ✅ Passo 6: Verificar Configuração

### Teste 1: Verificar tabelas
```sql
-- Verificar se os campos foram adicionados à tabela profiles
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name LIKE 'google_%';
```

### Teste 2: Verificar funções
```sql
-- Testar função de verificação de integração
SELECT has_calendar_integration();
```

### Teste 3: Teste completo
1. Faça login no sistema
2. Vá para **"Perfil & Integrações"**
3. Clique em **"Conectar Google Calendar"**
4. Autorize as permissões
5. Verifique se a integração foi ativada

## 🔍 Troubleshooting

### Erro: "Popup bloqueado pelo navegador"
- Permita popups para o seu domínio
- Tente novamente

### Erro: "Client ID inválido"
- Verifique se o Client ID está correto no `.env.local`
- Confirme se as origens autorizadas estão corretas

### Erro: "Redirect URI mismatch"
- Verifique se o redirect URI no Google Cloud Console
- Corresponde exatamente ao usado no código: `/auth/callback`

### Erro: "Tokens não salvos"
- Verifique se as variáveis de ambiente estão corretas no Supabase
- Confirme se as Edge Functions estão implantadas

## 📝 URLs Importantes

- **Google Cloud Console**: https://console.cloud.google.com/
- **Supabase Dashboard**: https://supabase.com/dashboard
- **Documentação Google Calendar API**: https://developers.google.com/calendar/api

## 🎯 Próximos Passos

Após a configuração bem-sucedida:

1. ✅ Teste a criação de reservas
2. ✅ Verifique se eventos aparecem no Google Calendar
3. ✅ Teste a edição/cancelamento de reservas
4. ✅ Configure notificações e lembretes

## 💡 Dicas de Segurança

- ✅ Nunca compartilhe o Client Secret
- ✅ Use HTTPS em produção
- ✅ Configure apenas as permissões necessárias
- ✅ Monitore o uso da API no Google Cloud Console
- ✅ Configure alertas de orçamento para evitar custos excessivos

---

**🎉 Pronto!** Sua integração com Google Calendar está configurada! 🚀
