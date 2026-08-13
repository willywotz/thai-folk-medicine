CREATE TABLE province (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name_thai    TEXT NOT NULL,
    name_english TEXT NOT NULL
);

CREATE TABLE district (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    province_id  BIGINT NOT NULL REFERENCES province (id),
    name_thai    TEXT NOT NULL,
    name_english TEXT NOT NULL
);

CREATE INDEX district_province_id_idx ON district (province_id);
