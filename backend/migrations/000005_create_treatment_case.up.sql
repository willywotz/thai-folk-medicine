CREATE TABLE treatment_case (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    remedy_id   BIGINT NOT NULL REFERENCES remedy (id),
    healer_id   BIGINT NOT NULL REFERENCES healer (id),
    patient_age INTEGER NOT NULL DEFAULT 0,
    patient_sex TEXT NOT NULL DEFAULT '',
    symptoms    TEXT NOT NULL DEFAULT '',
    result      TEXT NOT NULL DEFAULT '',
    note        TEXT NOT NULL DEFAULT '',
    treated_on  DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX treatment_case_remedy_id_idx ON treatment_case (remedy_id);
CREATE INDEX treatment_case_healer_id_idx ON treatment_case (healer_id);
