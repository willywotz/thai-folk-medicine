-- name: CreateRemedy :one
INSERT INTO remedy (healer_id, name, symptoms, preparation_method, usage, note)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at;

-- name: GetRemedy :one
SELECT id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at
FROM remedy
WHERE id = $1;

-- name: ListRemedyByHealerPage :many
SELECT id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at
FROM remedy
WHERE healer_id = sqlc.arg('healer_id')
ORDER BY name
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountRemedyByHealer :one
SELECT COUNT(*) FROM remedy WHERE healer_id = sqlc.arg('healer_id');

-- name: ListRemedyPage :many
SELECT r.id, r.healer_id, r.name, r.symptoms, r.preparation_method, r.usage, r.note, r.created_at, r.updated_at
FROM remedy r
JOIN healer h ON h.id = r.healer_id
WHERE (sqlc.narg('herb_id')::bigint IS NULL
       OR EXISTS (SELECT 1 FROM remedy_herb rh
                  WHERE rh.remedy_id = r.id AND rh.herb_id = sqlc.narg('herb_id')::bigint))
  AND (sqlc.narg('district_id')::bigint IS NULL OR h.district_id = sqlc.narg('district_id')::bigint)
  AND (sqlc.narg('symptom')::text IS NULL OR r.symptoms ILIKE '%' || sqlc.narg('symptom')::text || '%')
ORDER BY r.created_at DESC, r.id DESC
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountRemedyPage :one
SELECT COUNT(*)
FROM remedy r
JOIN healer h ON h.id = r.healer_id
WHERE (sqlc.narg('herb_id')::bigint IS NULL
       OR EXISTS (SELECT 1 FROM remedy_herb rh
                  WHERE rh.remedy_id = r.id AND rh.herb_id = sqlc.narg('herb_id')::bigint))
  AND (sqlc.narg('district_id')::bigint IS NULL OR h.district_id = sqlc.narg('district_id')::bigint)
  AND (sqlc.narg('symptom')::text IS NULL OR r.symptoms ILIKE '%' || sqlc.narg('symptom')::text || '%');

-- name: UpdateRemedy :one
UPDATE remedy
SET name = $2, symptoms = $3, preparation_method = $4, usage = $5, note = $6, updated_at = now()
WHERE id = $1
RETURNING id, healer_id, name, symptoms, preparation_method, usage, note, created_at, updated_at;

-- name: DeleteRemedy :execrows
DELETE FROM remedy WHERE id = $1;
