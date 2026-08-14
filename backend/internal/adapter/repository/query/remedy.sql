-- name: CreateRemedy :one
INSERT INTO remedy (healer_id, name, symptoms, ingredients, preparation_method, usage, note)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, healer_id, name, symptoms, ingredients, preparation_method, usage, note, created_at, updated_at;

-- name: GetRemedy :one
SELECT id, healer_id, name, symptoms, ingredients, preparation_method, usage, note, created_at, updated_at
FROM remedy
WHERE id = $1;

-- name: ListRemedyByHealer :many
SELECT id, healer_id, name, symptoms, ingredients, preparation_method, usage, note, created_at, updated_at
FROM remedy
WHERE healer_id = $1
ORDER BY name;

-- name: UpdateRemedy :one
UPDATE remedy
SET name = $2, symptoms = $3, ingredients = $4, preparation_method = $5, usage = $6, note = $7, updated_at = now()
WHERE id = $1
RETURNING id, healer_id, name, symptoms, ingredients, preparation_method, usage, note, created_at, updated_at;

-- name: DeleteRemedy :execrows
DELETE FROM remedy WHERE id = $1;

-- name: SearchRemedy :many
SELECT r.id, r.name, r.symptoms, r.ingredients, r.healer_id, h.full_name AS healer_full_name
FROM remedy r
JOIN healer h ON h.id = r.healer_id
WHERE r.name ILIKE '%' || @search_term::text || '%'
   OR r.symptoms ILIKE '%' || @search_term::text || '%'
   OR r.ingredients ILIKE '%' || @search_term::text || '%'
ORDER BY GREATEST(
    similarity(r.name, @search_term::text),
    similarity(r.symptoms, @search_term::text),
    similarity(r.ingredients, @search_term::text)
) DESC, r.name;
