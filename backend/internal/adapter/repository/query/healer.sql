-- name: CreateHealer :one
INSERT INTO healer (district_id, full_name, sub_district, specialty, biography)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at;

-- name: GetHealer :one
SELECT id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at
FROM healer
WHERE id = $1;

-- name: ListHealerByDistrict :many
SELECT id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at
FROM healer
WHERE district_id = $1
ORDER BY full_name;

-- name: UpdateHealer :one
UPDATE healer
SET district_id = $2, full_name = $3, sub_district = $4, specialty = $5, biography = $6, updated_at = now()
WHERE id = $1
RETURNING id, district_id, full_name, sub_district, specialty, biography, created_at, updated_at;

-- name: DeleteHealer :execrows
DELETE FROM healer WHERE id = $1;
