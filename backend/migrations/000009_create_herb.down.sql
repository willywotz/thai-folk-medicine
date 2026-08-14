ALTER TABLE photo DROP CONSTRAINT photo_owner_type_check;
ALTER TABLE photo ADD CONSTRAINT photo_owner_type_check
    CHECK (owner_type IN ('healer', 'remedy', 'case'));
DROP TABLE IF EXISTS herb;
