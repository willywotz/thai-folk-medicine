CREATE TABLE healer (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    district_id  BIGINT NOT NULL REFERENCES district (id),
    full_name    TEXT NOT NULL,
    sub_district TEXT NOT NULL DEFAULT '',
    specialty    TEXT NOT NULL DEFAULT '',
    biography    TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX healer_district_id_idx ON healer (district_id);
