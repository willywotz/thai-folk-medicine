CREATE TABLE herb (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name_thai       TEXT NOT NULL,
    name_english    TEXT NOT NULL DEFAULT '',
    scientific_name TEXT NOT NULL DEFAULT '',
    properties      TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX herb_name_thai_trgm ON herb USING gin (name_thai gin_trgm_ops);
CREATE INDEX herb_name_english_trgm ON herb USING gin (name_english gin_trgm_ops);

-- Let a photo belong to a herb too.
ALTER TABLE photo DROP CONSTRAINT photo_owner_type_check;
ALTER TABLE photo ADD CONSTRAINT photo_owner_type_check
    CHECK (owner_type IN ('healer', 'remedy', 'case', 'herb'));
