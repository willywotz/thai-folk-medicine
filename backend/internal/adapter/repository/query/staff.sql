-- name: GetStaffByUsername :one
SELECT id, username, email, password_hash, created_at
FROM staff_user
WHERE username = $1;

-- name: CreateStaff :one
INSERT INTO staff_user (username, email, password_hash)
VALUES ($1, $2, $3)
RETURNING id, username, email, password_hash, created_at;

-- name: CountStaff :one
SELECT count(*) FROM staff_user;
