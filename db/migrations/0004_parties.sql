-- 0004: organisers, farmers, farms
CREATE TABLE organiser (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       char(3) NOT NULL UNIQUE CHECK (code ~ '^\d{3}$'),
  name       varchar(100) NOT NULL,
  address_1  text NOT NULL,
  address_2  text,
  village_id uuid NOT NULL REFERENCES village(id),
  pincode    char(6) NOT NULL CHECK (pincode ~ '^[1-9]\d{5}$'),
  mobile     char(10) NOT NULL UNIQUE CHECK (mobile ~ '^[6-9]\d{9}$'),
  email      text,
  active     boolean NOT NULL DEFAULT true
);

CREATE TABLE farmer (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         char(6) NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6}$'),
  organiser_id uuid NOT NULL REFERENCES organiser(id),
  name         varchar(100) NOT NULL,
  address_1    text NOT NULL,
  address_2    text,
  village_id   uuid NOT NULL REFERENCES village(id),
  pincode      char(6) NOT NULL CHECK (pincode ~ '^[1-9]\d{5}$'),
  mobile       char(10) CHECK (mobile ~ '^[6-9]\d{9}$'),
  email        text,
  active       boolean NOT NULL DEFAULT true
);
CREATE INDEX farmer_organiser_idx ON farmer(organiser_id);

CREATE TABLE farm (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id            uuid NOT NULL REFERENCES farmer(id),
  farm_seq             smallint NOT NULL CHECK (farm_seq BETWEEN 1 AND 99),
  survey_no            text,
  declared_area_sqm    numeric(12,2) NOT NULL CHECK (declared_area_sqm > 0),
  computed_area_sqm    numeric(12,2) GENERATED ALWAYS AS (ST_Area(geofence)) STORED,
  soil_type            text NOT NULL,
  irrigation_source    text NOT NULL,
  location             geography(Point, 4326) NOT NULL,
  location_accuracy_m  numeric(6,1),
  geofence             geography(Polygon, 4326) NOT NULL
                       CHECK (ST_IsValid(geofence::geometry) AND ST_Area(geofence) > 100),
  UNIQUE (farmer_id, farm_seq)
);
CREATE INDEX farm_geofence_gix ON farm USING gist (geofence);
