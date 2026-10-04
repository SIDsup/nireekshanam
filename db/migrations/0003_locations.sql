-- 0003: State → District → Taluk → Village
CREATE TABLE state (
  code              char(2) PRIMARY KEY CHECK (code ~ '^[A-Z]{2}$'),
  name              text NOT NULL,
  area_display_unit text NOT NULL DEFAULT 'GUNTA' CHECK (area_display_unit IN ('GUNTA', 'CENT'))
);

CREATE TABLE district (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code char(2) NOT NULL REFERENCES state(code),
  code       char(2) NOT NULL CHECK (code ~ '^\d{2}$'),
  name       text NOT NULL,
  UNIQUE (state_code, code)
);

CREATE TABLE taluk (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id uuid NOT NULL REFERENCES district(id),
  code        varchar(3) NOT NULL CHECK (code ~ '^\d{2,3}$'), -- [OPEN] length, SPECS §9 Q3
  name        text NOT NULL,
  UNIQUE (district_id, code)
);

CREATE TABLE village (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  taluk_id uuid NOT NULL REFERENCES taluk(id),
  code     char(2) NOT NULL CHECK (code ~ '^\d{2}$'),
  name     text NOT NULL,
  pincode  char(6) NOT NULL CHECK (pincode ~ '^[1-9]\d{5}$'),
  center   geography(Point, 4326),
  UNIQUE (taluk_id, code)
);
