-- name: CreateRemedy :one
INSERT INTO remedy (healer_id, name, symptoms, preparation_method, usage, note)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at;

-- name: GetRemedy :one
SELECT id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at
FROM remedy
WHERE id = $1;

-- name: ListRemedyByHealer :many
SELECT id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at
FROM remedy
WHERE healer_id = $1
ORDER BY name;

-- name: ListRecentRemedy :many
SELECT id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at
FROM remedy
ORDER BY created_at DESC, id DESC
LIMIT $1;

-- name: UpdateRemedy :one
UPDATE remedy
SET name = $2, symptoms = $3, preparation_method = $4, usage = $5, note = $6, updated_at = now()
WHERE id = $1
RETURNING id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at;

-- name: DeleteRemedy :execrows
DELETE FROM remedy WHERE id = $1;

-- name: SearchRemedy :many
SELECT r.id, r.name, r.symptoms, r.healer_id, h.full_name AS healer_full_name
FROM remedy r
JOIN healer h ON h.id = r.healer_id
LEFT JOIN remedy_herb rh ON rh.remedy_id = r.id
LEFT JOIN herb hb ON hb.id = rh.herb_id
WHERE r.name ILIKE '%' || @search_term::text || '%'
   OR r.symptoms ILIKE '%' || @search_term::text || '%'
   OR hb.name_thai ILIKE '%' || @search_term::text || '%'
   OR hb.name_english ILIKE '%' || @search_term::text || '%'
GROUP BY r.id, r.name, r.symptoms, r.healer_id, h.full_name
ORDER BY GREATEST(
    similarity(r.name, @search_term::text),
    similarity(r.symptoms, @search_term::text),
    max(similarity(hb.name_thai, @search_term::text)),
    max(similarity(hb.name_english, @search_term::text))
) DESC, r.name;
