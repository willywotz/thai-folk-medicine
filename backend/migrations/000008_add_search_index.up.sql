CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX remedy_name_trgm ON remedy USING gin (name gin_trgm_ops);
CREATE INDEX remedy_symptoms_trgm ON remedy USING gin (symptoms gin_trgm_ops);
CREATE INDEX remedy_ingredients_trgm ON remedy USING gin (ingredients gin_trgm_ops);
CREATE INDEX healer_full_name_trgm ON healer USING gin (full_name gin_trgm_ops);
CREATE INDEX healer_specialty_trgm ON healer USING gin (specialty gin_trgm_ops);
CREATE INDEX healer_biography_trgm ON healer USING gin (biography gin_trgm_ops);
CREATE INDEX healer_sub_district_trgm ON healer USING gin (sub_district gin_trgm_ops);
