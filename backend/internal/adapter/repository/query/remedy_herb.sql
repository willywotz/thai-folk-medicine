-- name: InsertRemedyHerb :exec
INSERT INTO remedy_herb (remedy_id, herb_id, amount, position)
VALUES ($1, $2, $3, $4);

-- name: DeleteRemedyHerbByRemedy :exec
DELETE FROM remedy_herb WHERE remedy_id = $1;

-- name: ListHerbByRemedy :many
SELECT rh.herb_id, h.name_thai, h.name_english, rh.amount
FROM remedy_herb rh
JOIN herb h ON h.id = rh.herb_id
WHERE rh.remedy_id = $1
ORDER BY rh.position, h.name_thai;

-- name: ListRemedyByHerb :many
SELECT r.id, r.healer_id, r.name, r.symptoms, r.preparation_method, r.usage, r.note, r.created_at, r.updated_at
FROM remedy r
JOIN remedy_herb rh ON rh.remedy_id = r.id
WHERE rh.herb_id = $1
ORDER BY r.name;
