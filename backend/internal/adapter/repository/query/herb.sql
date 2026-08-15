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
WHERE (sqlc.narg('search_term')::text IS NULL OR name_thai ILIKE '%'||sqlc.narg('search_term')||'%' OR name_english ILIKE '%'||sqlc.narg('search_term')||'%' OR scientific_name ILIKE '%'||sqlc.narg('search_term')||'%')
ORDER BY name_thai
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountHerbPage :one
SELECT COUNT(*) FROM herb
WHERE (sqlc.narg('search_term')::text IS NULL OR name_thai ILIKE '%'||sqlc.narg('search_term')||'%' OR name_english ILIKE '%'||sqlc.narg('search_term')||'%' OR scientific_name ILIKE '%'||sqlc.narg('search_term')||'%');

-- name: UpdateHerb :one
UPDATE herb
SET name_thai = $2, name_english = $3, scientific_name = $4, properties = $5, description = $6, updated_at = now()
WHERE id = $1
RETURNING id, name_thai, name_english, scientific_name, properties, description, created_at, updated_at;

-- name: DeleteHerb :execrows
DELETE FROM herb WHERE id = $1;
