-- 0005: stage definitions, production lots, stage records, media
CREATE TYPE lot_status AS ENUM ('PLANNED', 'ACTIVE', 'HARVESTED', 'CLOSED', 'REJECTED', 'ABANDONED');
CREATE TYPE review_status AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE stage_definition (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_code           char(2) NOT NULL REFERENCES crop(code),
  stage_code          text NOT NULL,
  name                text NOT NULL,
  sequence            smallint NOT NULL,
  applies_to_parent   text NOT NULL CHECK (applies_to_parent IN ('MALE', 'FEMALE', 'BOTH', 'NA')),
  repeatable          boolean NOT NULL DEFAULT false,
  mandatory           boolean NOT NULL DEFAULT true,
  expected_day_offset smallint NOT NULL,
  requires_photo      boolean NOT NULL DEFAULT true,
  min_photos          smallint NOT NULL DEFAULT 1,
  requires_geofence   boolean NOT NULL DEFAULT true,
  form_schema         jsonb NOT NULL DEFAULT '[]',
  version             integer NOT NULL DEFAULT 1,
  UNIQUE (crop_code, stage_code)
);

CREATE TABLE production_lot (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id              char(21) NOT NULL UNIQUE
                      CHECK (lot_id ~ '^\d{2}\d{2}[A-Z]{2}\d{4}\d{3}[A-Z0-9]{6}\d{2}$'),
  season_code         char(2) NOT NULL REFERENCES season(code),
  year                smallint NOT NULL,
  hybrid_id           uuid NOT NULL REFERENCES hybrid(id),
  organiser_id        uuid NOT NULL REFERENCES organiser(id),
  farmer_id           uuid NOT NULL REFERENCES farmer(id),
  farm_id             uuid NOT NULL REFERENCES farm(id),
  field_assistant_id  uuid,
  contracted_area_sqm numeric(12,2) NOT NULL CHECK (contracted_area_sqm > 0),
  target_yield_kg     numeric(10,2) NOT NULL DEFAULT 0,
  female_sowing_date  date,
  status              lot_status NOT NULL DEFAULT 'PLANNED',
  current_stage_code  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  -- One lot per farm per season (SPECS §3.2.9; split plots are an open question).
  UNIQUE (farm_id, season_code, year)
);
CREATE INDEX lot_status_idx ON production_lot(status, current_stage_code);
CREATE INDEX lot_fa_idx ON production_lot(field_assistant_id);

-- Append-only: corrections are new rows with `supersedes` set.
CREATE TABLE stage_record (
  id                  uuid PRIMARY KEY,                -- record_uuid from the device (idempotency key)
  lot_id              uuid NOT NULL REFERENCES production_lot(id),
  stage_code          text NOT NULL,
  round_no            smallint NOT NULL DEFAULT 1,
  observed_on         date NOT NULL,
  data                jsonb NOT NULL DEFAULT '{}',
  gps                 geography(Point, 4326) NOT NULL,
  gps_accuracy_m      numeric(6,1) NOT NULL,
  inside_geofence     boolean NOT NULL,                -- server-verified value
  device_inside       boolean NOT NULL,                -- value the device computed
  distance_outside_m  numeric(8,1) NOT NULL DEFAULT 0,
  mock_location       boolean NOT NULL DEFAULT false,
  out_of_fence_reason text,
  captured_by         uuid NOT NULL,
  captured_at         timestamptz NOT NULL,
  server_received_at  timestamptz NOT NULL DEFAULT now(),
  device_id           text NOT NULL,
  app_version         text NOT NULL,
  supersedes          uuid REFERENCES stage_record(id),
  review_status       review_status NOT NULL DEFAULT 'NONE',
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  review_comment      text,
  remarks             text,
  CHECK (observed_on <= (server_received_at AT TIME ZONE 'Asia/Kolkata')::date),
  CHECK (inside_geofence OR out_of_fence_reason IS NOT NULL)
);
CREATE INDEX stage_record_lot_idx ON stage_record(lot_id, stage_code);
CREATE INDEX stage_record_review_idx ON stage_record(review_status) WHERE review_status = 'PENDING';

CREATE TABLE media (
  id          uuid PRIMARY KEY,
  owner_type  text NOT NULL CHECK (owner_type IN ('stage_record', 'farm', 'farmer')),
  owner_id    uuid NOT NULL,
  storage_key text NOT NULL,
  gps         geography(Point, 4326),
  taken_at    timestamptz NOT NULL,
  uploaded_at timestamptz,
  size_bytes  integer
);
CREATE INDEX media_owner_idx ON media(owner_type, owner_id);
