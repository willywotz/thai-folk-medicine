CREATE TABLE remedy_herb (
    remedy_id BIGINT NOT NULL REFERENCES remedy (id) ON DELETE CASCADE,
    herb_id   BIGINT NOT NULL REFERENCES herb (id),
    amount    TEXT NOT NULL DEFAULT '',
    position  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (remedy_id, herb_id)
);

CREATE INDEX remedy_herb_herb_id_idx ON remedy_herb (herb_id);

-- Ingredients are now the linked herbs.
DROP INDEX IF EXISTS remedy_ingredients_trgm;
ALTER TABLE remedy DROP COLUMN ingredients;
