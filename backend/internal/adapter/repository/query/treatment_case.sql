-- name: CreateTreatmentCase :one
INSERT INTO treatment_case (remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at;

-- name: GetTreatmentCase :one
SELECT id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at
FROM treatment_case
WHERE id = $1;

-- name: ListTreatmentCaseByRemedy :many
SELECT id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at
FROM treatment_case
WHERE remedy_id = $1
ORDER BY treated_on DESC, id DESC;

-- name: UpdateTreatmentCase :one
UPDATE treatment_case
SET patient_age = $2, patient_sex = $3, symptoms = $4, result = $5, note = $6, treated_on = $7, updated_at = now()
WHERE id = $1
RETURNING id, remedy_id, healer_id, patient_age, patient_sex, symptoms, result, note, treated_on, created_at, updated_at;

-- name: DeleteTreatmentCase :execrows
DELETE FROM treatment_case WHERE id = $1;
