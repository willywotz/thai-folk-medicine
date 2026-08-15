-- name: CreateTreatmentCase :one
INSERT INTO treatment_case (remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at;

-- name: GetTreatmentCase :one
SELECT id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at
FROM treatment_case
WHERE id = $1;

-- name: ListCaseByRemedyPage :many
SELECT id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at
FROM treatment_case
WHERE remedy_id = sqlc.arg('remedy_id')
ORDER BY treated_on DESC, id DESC
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountCaseByRemedy :one
SELECT COUNT(*) FROM treatment_case WHERE remedy_id = sqlc.arg('remedy_id');

-- name: ListRecentCasePage :many
SELECT id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at
FROM treatment_case
ORDER BY treated_on DESC, id DESC
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountCasePage :one
SELECT COUNT(*) FROM treatment_case;

-- name: UpdateTreatmentCase :one
UPDATE treatment_case
SET patient_age = $2, patient_sex = $3, symptoms = $4, result = $5, note = $6, treated_on = $7, updated_at = now()
WHERE id = $1
RETURNING id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at;

-- name: DeleteTreatmentCase :execrows
DELETE FROM treatment_case WHERE id = $1;
