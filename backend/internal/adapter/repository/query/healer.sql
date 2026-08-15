-- name: CreateHealer :one
INSERT INTO healer (district_id, full_name, sub_district, specialty, biography)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at;

-- name: GetHealer :one
SELECT id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at
FROM healer
WHERE id = $1;

-- name: ListHealerByDistrictPage :many
SELECT id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at
FROM healer
WHERE district_id = sqlc.arg('district_id')
ORDER BY full_name
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountHealerByDistrict :one
SELECT COUNT(*) FROM healer WHERE district_id = sqlc.arg('district_id');

-- name: ListHealer :many
SELECT id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at
FROM healer
WHERE (sqlc.narg('district_id')::bigint IS NULL OR district_id = sqlc.narg('district_id'))
ORDER BY id
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountHealer :one
SELECT COUNT(*) FROM healer
WHERE (sqlc.narg('district_id')::bigint IS NULL OR district_id = sqlc.narg('district_id'));

-- name: UpdateHealer :one
UPDATE healer
SET district_id = $2, full_name = $3, sub_district = $4, specialty = $5, biography = $6, updated_at = now()
WHERE id = $1
RETURNING id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at;

-- name: DeleteHealer :execrows
DELETE FROM healer WHERE id = $1;
