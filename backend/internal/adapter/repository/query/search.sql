-- name: SearchAll :many
WITH hits AS (
  SELECT 'remedy'::text AS type, r.id, r.name AS title, r.symptoms AS subtitle,
         GREATEST(similarity(r.name, @search_term::text), similarity(r.symptoms, @search_term::text),
                  COALESCE(max(similarity(hb.name_thai, @search_term::text)), 0))::real AS score
  FROM remedy r
  LEFT JOIN remedy_herb rh ON rh.remedy_id = r.id
  LEFT JOIN herb hb ON hb.id = rh.herb_id
  GROUP BY r.id, r.name, r.symptoms
  UNION ALL
  SELECT 'healer'::text, h.id, h.full_name, h.sub_district,
         GREATEST(similarity(h.full_name, @search_term::text), similarity(h.specialty, @search_term::text))::real
  FROM healer h
  UNION ALL
  SELECT 'herb'::text, hb.id, hb.name_thai, hb.name_english,
         GREATEST(similarity(hb.name_thai, @search_term::text), similarity(hb.name_english, @search_term::text),
                  similarity(hb.scientific_name, @search_term::text))::real
  FROM herb hb
)
SELECT type, id, title, subtitle, score FROM hits
WHERE score > 0
ORDER BY score DESC, type, id
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountSearchAll :one
WITH hits AS (
  SELECT 'remedy'::text AS type, r.id,
         GREATEST(similarity(r.name, @search_term::text), similarity(r.symptoms, @search_term::text),
                  COALESCE(max(similarity(hb.name_thai, @search_term::text)), 0))::real AS score
  FROM remedy r
  LEFT JOIN remedy_herb rh ON rh.remedy_id = r.id
  LEFT JOIN herb hb ON hb.id = rh.herb_id
  GROUP BY r.id, r.name, r.symptoms
  UNION ALL
  SELECT 'healer'::text, h.id,
         GREATEST(similarity(h.full_name, @search_term::text), similarity(h.specialty, @search_term::text))::real
  FROM healer h
  UNION ALL
  SELECT 'herb'::text, hb.id,
         GREATEST(similarity(hb.name_thai, @search_term::text), similarity(hb.name_english, @search_term::text),
                  similarity(hb.scientific_name, @search_term::text))::real
  FROM herb hb
)
SELECT COUNT(*) FROM hits WHERE score > 0;
