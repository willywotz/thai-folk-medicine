CREATE TABLE remedy (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    healer_id          BIGINT NOT NULL REFERENCES healer (id),
    name               TEXT NOT NULL,
    symptoms           TEXT NOT NULL DEFAULT '',
    ingredients        TEXT NOT NULL DEFAULT '',
    preparation_method TEXT NOT NULL DEFAULT '',
    usage              TEXT NOT NULL DEFAULT '',
    note               TEXT NOT NULL DEFAULT '',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX remedy_healer_id_idx ON remedy (healer_id);
