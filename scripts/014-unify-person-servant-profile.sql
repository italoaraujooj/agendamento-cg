-- ============================================================
-- 014: Unificação de Pessoa — profiles como entidade central
-- ============================================================
-- Objetivo: garantir que servants vinculados a um perfil
-- compartilhem nome e telefone de forma automática e bidirecional.
--
-- Regras de sincronização:
--   • profiles.full_name → servant.name  (perfil prevalece)
--   • servant.name       → profiles.full_name  (se perfil estiver vazio)
--   • Mesma lógica para telefone
-- ============================================================


-- ─── 1. Trigger: ao definir servant.user_id, sincronizar nome/telefone ────────

CREATE OR REPLACE FUNCTION public.sync_servant_on_user_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_full_name text;
  p_phone     varchar(20);
BEGIN
  -- Apenas quando user_id está sendo definido (NULL → valor)
  IF NEW.user_id IS NOT NULL AND (OLD.user_id IS DISTINCT FROM NEW.user_id) THEN

    SELECT full_name, phone
    INTO   p_full_name, p_phone
    FROM   public.profiles
    WHERE  id = NEW.user_id;

    -- Nome: perfil prevalece; se perfil estiver vazio, puxar do servo
    IF p_full_name IS NOT NULL AND p_full_name <> '' THEN
      NEW.name := p_full_name;
    ELSIF NEW.name IS NOT NULL AND NEW.name <> '' THEN
      UPDATE public.profiles
      SET    full_name   = NEW.name,
             updated_at  = now()
      WHERE  id = NEW.user_id
        AND  (full_name IS NULL OR full_name = '');
    END IF;

    -- Telefone: mesma lógica
    IF p_phone IS NOT NULL AND p_phone <> '' THEN
      NEW.phone := p_phone;
    ELSIF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
      UPDATE public.profiles
      SET    phone       = NEW.phone,
             updated_at  = now()
      WHERE  id = NEW.user_id
        AND  (phone IS NULL OR phone = '');
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_servant_on_user_link ON public.servants;
CREATE TRIGGER sync_servant_on_user_link
  BEFORE UPDATE ON public.servants
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_servant_on_user_link();


-- ─── 2. Trigger: ao atualizar perfil, propagar para servos vinculados ─────────

CREATE OR REPLACE FUNCTION public.sync_profile_to_servants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quando full_name é atualizado para um valor não-vazio
  IF NEW.full_name IS DISTINCT FROM OLD.full_name
     AND NEW.full_name IS NOT NULL
     AND NEW.full_name <> ''
  THEN
    UPDATE public.servants
    SET    name        = NEW.full_name,
           updated_at  = now()
    WHERE  user_id = NEW.id;
  END IF;

  -- Quando phone é atualizado para um valor não-vazio
  IF NEW.phone IS DISTINCT FROM OLD.phone
     AND NEW.phone IS NOT NULL
     AND NEW.phone <> ''
  THEN
    UPDATE public.servants
    SET    phone       = NEW.phone,
           updated_at  = now()
    WHERE  user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_profile_to_servants ON public.profiles;
CREATE TRIGGER sync_profile_to_servants
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_to_servants();


-- ─── 3. Migração única: vincular servos existentes a perfis pelo email ─────────
-- Percorre todos os servants ativos sem user_id que possuam email cadastrado.
-- Para cada um, busca o perfil com o mesmo email e faz a vinculação.
-- O trigger acima cuida da sincronização de nome/telefone automaticamente.

DO $$
DECLARE
  rec    RECORD;
  p_id   uuid;
  total  int := 0;
BEGIN
  FOR rec IN
    SELECT s.id, s.email
    FROM   public.servants s
    WHERE  s.user_id  IS NULL
      AND  s.email    IS NOT NULL
      AND  s.email    <> ''
      AND  s.is_active = true
  LOOP
    SELECT p.id
    INTO   p_id
    FROM   public.profiles p
    WHERE  lower(p.email) = lower(rec.email)
    LIMIT  1;

    IF p_id IS NOT NULL THEN
      UPDATE public.servants
      SET    user_id     = p_id,
             updated_at  = now()
      WHERE  id = rec.id;

      total := total + 1;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Migração 014 concluída: % servo(s) vinculado(s) a perfis.', total;
END;
$$;
