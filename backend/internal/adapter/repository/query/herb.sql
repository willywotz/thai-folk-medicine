-- name: CreateHerb :one
INSERT INTO herb (name_thai, name_english, scientific_name, properties, description)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at;

-- name: GetHerb :one
SELECT id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at
FROM herb
WHERE id = $1;

-- name: ListHerbPage :many
SELECT id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at
FROM herb
WHERE (sqlc.narg('query')::text IS NULL
       OR name_thai ILIKE '%' || sqlc.narg('query')::text || '%'
       OR name_english ILIKE '%' || sqlc.narg('query')::text || '%'
       OR properties ILIKE '%' || sqlc.narg('query')::text || '%')
ORDER BY name_thai
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountHerbPage :one
SELECT COUNT(*) FROM herb
WHERE (sqlc.narg('query')::text IS NULL
       OR name_thai ILIKE '%' || sqlc.narg('query')::text || '%'
       OR name_english ILIKE '%' || sqlc.narg('query')::text || '%'
       OR properties ILIKE '%' || sqlc.narg('query')::text || '%');

-- name: UpdateHerb :one
UPDATE herb
SET name_thai = $2, name_english = $3, scientific_name = $4, properties = $5, description = $6, updated_at = now()
WHERE id = $1
RETURNING id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at;

-- name: DeleteHerb :execrows
DELETE FROM herb WHERE id = $1;

-- name: SearchHerb :many
SELECT id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at
FROM herb
WHERE name_thai ILIKE '%' || @search_term::text || '%'
   OR name_english ILIKE '%' || @search_term::text || '%'
   OR scientific_name ILIKE '%' || @search_term::text || '%'
   OR properties ILIKE '%' || @search_term::text || '%'
ORDER BY GREATEST(
    similarity(name_thai, @search_term::text),
    similarity(name_english, @search_term::text)
) DESC, name_thai;
