ALTER TABLE remedy ADD COLUMN ingredients TEXT NOT NULL DEFAULT '';
CREATE INDEX remedy_ingredients_trgm ON remedy USING gin (ingredients gin_trgm_ops);
DROP TABLE IF EXISTS remedy_herb;
