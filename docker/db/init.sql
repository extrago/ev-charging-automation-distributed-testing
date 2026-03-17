CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS stations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255)        NOT NULL,
  operator    VARCHAR(255)        NOT NULL,
  status      VARCHAR(50)         NOT NULL DEFAULT 'available'
                CHECK (status IN ('available', 'reserved', 'offline')),
  power_kw    NUMERIC(6, 2)       NOT NULL,
  connector   VARCHAR(50)         NOT NULL,
  location    GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stations_location
  ON stations USING GIST (location);

CREATE TABLE IF NOT EXISTS reservations (
  id          SERIAL PRIMARY KEY,
  station_id  INTEGER             NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  user_id     VARCHAR(255)        NOT NULL,
  status      VARCHAR(50)         NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_active_station_reservation
    EXCLUDE USING btree (station_id WITH =)
    WHERE (status = 'active')
);

CREATE TABLE IF NOT EXISTS alerts (
  id          SERIAL PRIMARY KEY,
  truck_id    VARCHAR(255)        NOT NULL,
  type        VARCHAR(100)        NOT NULL,
  speed       NUMERIC(6, 2),
  location    GEOGRAPHY(POINT, 4326) NOT NULL,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_location
  ON alerts USING GIST (location);

INSERT INTO stations (name, operator, power_kw, connector, location) VALUES
  (
    'Covent Garden Rapid Charger',
    'EV Connect Ltd',
    50.00,
    'CCS',
    ST_GeographyFromText('SRID=4326;POINT(-0.1246 51.5117)')
  ),
  (
    'Borough Market Hub',
    'Osprey Charging',
    22.00,
    'Type 2',
    ST_GeographyFromText('SRID=4326;POINT(-0.0910 51.5055)')
  ),
  (
    'Canary Wharf Supercharger',
    'Tesla',
    150.00,
    'Tesla/CCS',
    ST_GeographyFromText('SRID=4326;POINT(-0.0235 51.5045)')
  ),
  (
    'Heathrow T5 Charger',
    'Pod Point',
    7.40,
    'Type 2',
    ST_GeographyFromText('SRID=4326;POINT(-0.4885 51.4770)')
  ),
  (
    'Stratford Rapid Station',
    'Connected Kerb',
    50.00,
    'CHAdeMO',
    ST_GeographyFromText('SRID=4326;POINT(-0.0020 51.5421)')
  );