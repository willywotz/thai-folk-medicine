CREATE TABLE photo (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_type TEXT NOT NULL CHECK (owner_type IN ('healer', 'remedy', 'case')),
    owner_id   BIGINT NOT NULL,
    object_key TEXT NOT NULL,
    caption    TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX photo_owner_idx ON photo (owner_type, owner_id);
