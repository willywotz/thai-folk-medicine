DROP INDEX IF EXISTS healer_sub_district_trgm;
DROP INDEX IF EXISTS healer_biography_trgm;
DROP INDEX IF EXISTS healer_specialty_trgm;
DROP INDEX IF EXISTS healer_full_name_trgm;
DROP INDEX IF EXISTS remedy_ingredients_trgm;
DROP INDEX IF EXISTS remedy_symptoms_trgm;
DROP INDEX IF EXISTS remedy_name_trgm;
DROP EXTENSION IF EXISTS pg_trgm;
