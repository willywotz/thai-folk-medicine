CREATE TABLE event_log (
    id          BIGSERIAL PRIMARY KEY,
    event_name  TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX event_log_occurred_at_idx ON event_log (occurred_at DESC, id DESC);
