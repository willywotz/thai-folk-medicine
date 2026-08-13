-- name: ListProvince :many
SELECT id, name_thai, name_english
FROM province
ORDER BY name_english;

-- name: ListDistrictByProvince :many
SELECT id, province_id, name_thai, name_english
FROM district
WHERE province_id = $1
ORDER BY name_english;
