-- 0002: season, crop, parent lines, hybrids
CREATE TABLE season (
  code        char(2) PRIMARY KEY CHECK (code ~ '^(01|02|03)$'),
  name        text NOT NULL,
  start_month smallint NOT NULL CHECK (start_month BETWEEN 1 AND 12),
  end_month   smallint NOT NULL CHECK (end_month BETWEEN 1 AND 12)
);

CREATE TYPE pollination_method AS ENUM ('HAND_EMASCULATION', 'HAND_POLLINATION_ONLY', 'DETASSELING', 'BULB_CROSSING');

CREATE TABLE crop (
  code               char(2) PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),
  name               text NOT NULL,
  is_transplanted    boolean NOT NULL,
  pollination_method pollination_method NOT NULL,
  active             boolean NOT NULL DEFAULT true
);

CREATE TABLE parent_line (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_code char(2) NOT NULL REFERENCES crop(code),
  code      char(4) NOT NULL CHECK (code ~ '^[A-Z0-9]{4}$'),
  sex       char(1) NOT NULL CHECK (sex IN ('M', 'F')),
  UNIQUE (crop_code, code, sex)
);

CREATE TABLE hybrid (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_code                 char(2) NOT NULL REFERENCES crop(code),
  hybrid_code               char(4) NOT NULL CHECK (hybrid_code ~ '^\d{4}$'),
  male_line_id              uuid NOT NULL REFERENCES parent_line(id),
  female_line_id            uuid NOT NULL REFERENCES parent_line(id),
  ratio_f_m                 text NOT NULL,
  expected_yield_kg_per_acre numeric(8,2) NOT NULL CHECK (expected_yield_kg_per_acre > 0),
  active                    boolean NOT NULL DEFAULT true,
  UNIQUE (crop_code, hybrid_code)
);
