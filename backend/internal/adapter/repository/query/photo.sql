-- name: CreatePhoto :one
INSERT INTO photo (owner_type, owner_id, object_key, caption)
VALUES ($1, $2, $3, $4)
RETURNING id, owner_type, owner_id, object_key, caption, created_at;

-- name: GetPhoto :one
SELECT id, owner_type, owner_id, object_key, caption, created_at
FROM photo
WHERE id = $1;

-- name: DeletePhoto :execrows
DELETE FROM photo WHERE id = $1;
