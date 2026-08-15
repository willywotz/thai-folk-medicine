-- name: InsertEventLog :exec
INSERT INTO event_log (event_name, payload) VALUES ($1, $2);

-- name: ListEventLog :many
SELECT id, event_name, payload, occurred_at
FROM event_log
ORDER BY occurred_at DESC, id DESC
LIMIT sqlc.arg('page_limit') OFFSET sqlc.arg('page_offset');

-- name: CountEventLog :one
SELECT COUNT(*) FROM event_log;
