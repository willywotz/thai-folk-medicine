-- name: ListProvince :many
SELECT id, name_thai, name_english
FROM province
ORDER BY name_english;

-- name: CountProvince :one
SELECT COUNT(*) FROM province;

-- name: CountDistrict :one
SELECT COUNT(*) FROM district;

-- name: ListDistrictByProvince :many
SELECT id, province_id, name_thai, name_english
FROM district
WHERE province_id = $1
ORDER BY name_english;

-- name: GetDistrict :one
SELECT id, province_id, name_thai, name_english
FROM district
WHERE id = $1;

-- name: GetProvince :one
SELECT id, name_thai, name_english
FROM province
WHERE id = $1;

-- name: CreateProvince :one
INSERT INTO province (name_thai, name_english)
VALUES ($1, $2)
RETURNING id, name_thai, name_english;

-- name: UpdateProvince :one
UPDATE province
SET name_thai = $2, name_english = $3
WHERE id = $1
RETURNING id, name_thai, name_english;

-- name: DeleteProvince :execrows
DELETE FROM province WHERE id = $1;

-- name: CountDistrictByProvince :one
SELECT COUNT(*) FROM district WHERE province_id = sqlc.arg('province_id');

-- name: CreateDistrict :one
INSERT INTO district (province_id, name_thai, name_english)
VALUES ($1, $2, $3)
RETURNING id, province_id, name_thai, name_english;

-- name: UpdateDistrict :one
UPDATE district
SET name_thai = $2, name_english = $3
WHERE id = $1
RETURNING id, province_id, name_thai, name_english;

-- name: DeleteDistrict :execrows
DELETE FROM district WHERE id = $1;
