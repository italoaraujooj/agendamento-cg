-- ============================================================
-- 020: Um registro de servo por pessoa em cada ministério
-- ============================================================
-- Antes: a mesma pessoa tinha uma linha em `servants` por área, e o sistema
-- tentava juntá-las pelo nome. Agora: uma linha por pessoa em cada ministério
-- (servants = participação no ministério); as áreas ficam em `servant_areas`.
-- A identidade da pessoa entre ministérios é user_id / e-mail.
--
-- Duplicatas = mesmo ministério + mesmo e-mail (normalizado).
-- Sobrevivente: vinculado a conta > ativo > mais antigo.
--
-- Backup de tudo que é alterado fica no schema `backup_020` (não exposto
-- pela API). Pode ser removido depois de validar: DROP SCHEMA backup_020 CASCADE;
-- ============================================================

BEGIN;

-- ─── 0. Mapa duplicata → sobrevivente ──────────────────────────────────────
CREATE TEMP TABLE servant_merge_map ON COMMIT DROP AS
WITH s AS (
  SELECT sv.id, sv.user_id, sv.is_active, sv.created_at,
         a.ministry_id, lower(trim(sv.email)) AS nemail
  FROM public.servants sv
  JOIN public.areas a ON a.id = sv.area_id
  WHERE sv.email IS NOT NULL AND trim(sv.email) <> ''
),
ranked AS (
  SELECT s.*,
         first_value(id) OVER (
           PARTITION BY ministry_id, nemail
           ORDER BY (user_id IS NOT NULL) DESC, is_active DESC NULLS LAST, created_at ASC, id ASC
         ) AS survivor_id,
         count(*) OVER (PARTITION BY ministry_id, nemail) AS group_size
  FROM s
)
SELECT id AS dup_id, survivor_id
FROM ranked
WHERE group_size > 1 AND id <> survivor_id;

-- ─── 1. Backup ─────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS backup_020;
REVOKE ALL ON SCHEMA backup_020 FROM anon, authenticated;

CREATE TABLE backup_020.servants AS
  SELECT * FROM public.servants
  WHERE id IN (SELECT dup_id FROM servant_merge_map UNION SELECT survivor_id FROM servant_merge_map);
CREATE TABLE backup_020.servant_areas AS
  SELECT * FROM public.servant_areas
  WHERE servant_id IN (SELECT dup_id FROM servant_merge_map UNION SELECT survivor_id FROM servant_merge_map);
CREATE TABLE backup_020.servant_availability AS
  SELECT * FROM public.servant_availability
  WHERE servant_id IN (SELECT dup_id FROM servant_merge_map UNION SELECT survivor_id FROM servant_merge_map);
CREATE TABLE backup_020.schedule_assignments AS
  SELECT * FROM public.schedule_assignments WHERE servant_id IN (SELECT dup_id FROM servant_merge_map);
CREATE TABLE backup_020.ministries AS
  SELECT id, leader_id, co_leader_id FROM public.ministries
  WHERE leader_id IN (SELECT dup_id FROM servant_merge_map)
     OR co_leader_id IN (SELECT dup_id FROM servant_merge_map);
CREATE TABLE backup_020.merge_map AS SELECT * FROM servant_merge_map;

-- ─── 2. Áreas: sobrevivente passa a ter todas as áreas do grupo ────────────
INSERT INTO public.servant_areas (servant_id, area_id)
SELECT m.survivor_id, sv.area_id
FROM servant_merge_map m JOIN public.servants sv ON sv.id = m.dup_id
ON CONFLICT DO NOTHING;

INSERT INTO public.servant_areas (servant_id, area_id)
SELECT m.survivor_id, sa.area_id
FROM servant_merge_map m JOIN public.servant_areas sa ON sa.servant_id = m.dup_id
ON CONFLICT DO NOTHING;

-- Consistência: toda área primária também consta na junction
INSERT INTO public.servant_areas (servant_id, area_id)
SELECT id, area_id FROM public.servants
ON CONFLICT DO NOTHING;

-- ─── 3. Disponibilidade: uma resposta por pessoa/evento (a mais recente) ───
WITH grp AS (
  SELECT dup_id AS servant_id, survivor_id FROM servant_merge_map
  UNION SELECT DISTINCT survivor_id, survivor_id FROM servant_merge_map
),
ranked AS (
  SELECT av.id,
         row_number() OVER (
           PARTITION BY g.survivor_id, av.period_id, av.event_id
           ORDER BY (av.servant_id = g.survivor_id) DESC, av.submitted_at DESC NULLS LAST
         ) AS rn
  FROM public.servant_availability av
  JOIN grp g ON g.servant_id = av.servant_id
)
DELETE FROM public.servant_availability WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

UPDATE public.servant_availability av
SET servant_id = m.survivor_id
FROM servant_merge_map m
WHERE av.servant_id = m.dup_id;

-- ─── 4. Atribuições ─────────────────────────────────────────────────────────
-- (levantamento prévio: nenhuma pessoa escalada 2x no mesmo evento; a
-- remoção abaixo só protege a UNIQUE(schedule_event_id, servant_id))
DELETE FROM public.schedule_assignments d
USING servant_merge_map m
WHERE d.servant_id = m.dup_id
  AND EXISTS (
    SELECT 1 FROM public.schedule_assignments s
    WHERE s.schedule_event_id = d.schedule_event_id AND s.servant_id = m.survivor_id
  );

UPDATE public.schedule_assignments sa
SET servant_id = m.survivor_id
FROM servant_merge_map m
WHERE sa.servant_id = m.dup_id;

-- ─── 5. Líder / co-líder do ministério ─────────────────────────────────────
UPDATE public.ministries mi SET leader_id = m.survivor_id
FROM servant_merge_map m WHERE mi.leader_id = m.dup_id;

UPDATE public.ministries mi SET co_leader_id = m.survivor_id
FROM servant_merge_map m WHERE mi.co_leader_id = m.dup_id;

-- ─── 6. Atributos do sobrevivente ──────────────────────────────────────────
UPDATE public.servants s
SET is_active  = agg.any_active,
    is_leader  = agg.any_leader,
    user_id    = COALESCE(s.user_id, agg.any_user),
    phone      = COALESCE(NULLIF(s.phone, ''), agg.any_phone),
    notes      = NULLIF(agg.all_notes, ''),
    updated_at = now()
FROM (
  SELECT m.survivor_id,
         bool_or(COALESCE(sv.is_active, false)) AS any_active,
         bool_or(COALESCE(sv.is_leader, false)) AS any_leader,
         (array_agg(sv.user_id) FILTER (WHERE sv.user_id IS NOT NULL))[1] AS any_user,
         (array_agg(sv.phone) FILTER (WHERE sv.phone IS NOT NULL AND sv.phone <> ''))[1] AS any_phone,
         string_agg(DISTINCT NULLIF(trim(sv.notes), ''), ' | ') AS all_notes
  FROM (SELECT DISTINCT survivor_id FROM servant_merge_map) m
  JOIN public.servants sv
    ON sv.id = m.survivor_id
    OR sv.id IN (SELECT dup_id FROM servant_merge_map mm WHERE mm.survivor_id = m.survivor_id)
  GROUP BY m.survivor_id
) agg
WHERE s.id = agg.survivor_id;

-- Nome: o perfil vinculado prevalece (mesma regra do script 014)
UPDATE public.servants s
SET name = p.full_name
FROM public.profiles p
WHERE s.user_id = p.id
  AND s.id IN (SELECT survivor_id FROM servant_merge_map)
  AND p.full_name IS NOT NULL AND p.full_name <> '';

-- ─── 7. Remove as duplicatas ────────────────────────────────────────────────
DELETE FROM public.servants WHERE id IN (SELECT dup_id FROM servant_merge_map);

-- ─── 8. Impede novas duplicatas (mesmo e-mail no mesmo ministério) ─────────
CREATE OR REPLACE FUNCTION public.prevent_duplicate_servant_per_ministry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ministry uuid;
BEGIN
  IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  SELECT ministry_id INTO v_ministry FROM public.areas WHERE id = NEW.area_id;

  IF EXISTS (
    SELECT 1
    FROM public.servants s
    JOIN public.areas a ON a.id = s.area_id
    WHERE a.ministry_id = v_ministry
      AND lower(trim(s.email)) = lower(trim(NEW.email))
      AND s.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'Já existe um servo com este e-mail neste ministério'
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_servant_per_ministry ON public.servants;
CREATE TRIGGER prevent_duplicate_servant_per_ministry
  BEFORE INSERT OR UPDATE OF email, area_id ON public.servants
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_servant_per_ministry();

COMMIT;
