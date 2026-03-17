# EV Charging Station API Test Suite — Implementation Plan

A portfolio-grade Playwright + TypeScript API automation project that validates a spatial EV station
search backed by PostGIS. The stack includes a Docker-hosted mock Express API, direct DB helpers for
test isolation, strict typing, and a custom reporter.

---

## Proposed Directory Structure

```
EV Charging Station API Test Suite/
├── docker/
│   ├── api/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── server.ts          # Express entry-point
│   │       ├── db.ts              # pg Pool singleton
│   │       └── routes/
│   │           ├── stations.ts    # GET /stations/search
│   │           └── reservations.ts# POST /reservations
│   └── db/
│       └── init.sql               # PostGIS seed (5 stations)
├── src/
│   ├── config/
│   │   └── envConfig.ts           # Typed env var loader
│   ├── types/
│   │   └── index.ts               # Station, Reservation, ApiError interfaces
│   ├── helpers/
│   │   ├── dbHelper.ts            # pg-based DB helper (setup/teardown)
│   │   ├── apiHelper.ts           # APIRequestContext wrapper
│   │   └── geoHelper.ts           # Haversine distance utility
│   ├── fixtures/
│   │   └── index.ts               # Playwright test fixtures
│   └── reporters/
│       └── customReporter.ts      # Enterprise JSON + HTML reporter
├── tests/
│   ├── spatial.spec.ts            # 5 km boundary spatial test
│   ├── negative.spec.ts           # 400 for invalid GeoJSON inputs
│   └── concurrency.spec.ts        # Double-reservation 409 conflict
├── .env.example
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── playwright.config.ts
```

---

## Proposed Changes

### Docker Infrastructure

#### [NEW] docker-compose.yml
- **`db`** service: `postgis/postgis:15-3.3`, exposes port 5432, mounts `./docker/db/init.sql`
- **`api`** service: custom Dockerfile builds the Express app, exposes port 3000, depends on `db`
- Shared network `ev-net`; `healthcheck` on both services

#### [NEW] docker/db/init.sql
- Enables `postgis` extension
- Creates `stations` table with `GEOGRAPHY(POINT, 4326)` column
- Seeds 5 EV stations (London metro area) at varied distances from test origin `(51.5074, -0.1278)`
- Creates `reservations` table with `status` + advisory-lock-based unique constraint

#### [NEW] docker/api/src/server.ts + routes
- `GET /stations/search?lat=&lon=&radius=` — uses `ST_DWithin` returning stations within radius metres
- `POST /reservations` body `{ stationId }` — uses `SELECT … FOR UPDATE` + advisory lock to serialize concurrent inserts, returns 409 if already reserved
- Input validation middleware returns 400 on malformed / missing lat/lon/GeoJSON fields

---

### Source Code

#### [NEW] src/types/index.ts
Strict interfaces: `Station`, `Reservation`, `SearchParams`, `ApiErrorResponse`, `ReservationRequest`

#### [NEW] src/config/envConfig.ts
Reads `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `API_BASE_URL` from `process.env` with typed defaults; throws on missing required vars.

#### [NEW] src/helpers/dbHelper.ts
- Class `DbHelper` wrapping `pg.Pool`
- Methods: `connect()`, `disconnect()`, `deleteReservations()`, `resetStationStatus()`, `queryStations()`, `rawQuery()`
- Used in `beforeAll` / `afterEach` for test isolation

#### [NEW] src/helpers/apiHelper.ts
- Class `ApiHelper` wrapping Playwright `APIRequestContext`
- Methods: `searchStations(params)`, `createReservation(body)`, `healthCheck()`
- Full typed request/response generics

#### [NEW] src/helpers/geoHelper.ts
- Static utility class
- `haversineDistance(lat1, lon1, lat2, lon2): number` — returns metres
- `isWithinRadius(station, origin, radiusMetres): boolean`

#### [NEW] src/reporters/customReporter.ts
- Implements `Reporter` from `@playwright/test/reporter`
- Emits per-test JSON events to `reports/results.json`
- Generates a self-contained `reports/report.html` after suite completion with pass/fail/skip counts, duration, and colour-coded rows

#### [NEW] src/fixtures/index.ts
- `test` fixture extending base Playwright `test`
- Provides: `dbHelper` (connected DbHelper), `apiHelper` (ApiHelper bound to baseURL)
- `afterEach` auto-calls `dbHelper.deleteReservations()` + `dbHelper.resetStationStatus()`

---

### Tests

#### [NEW] tests/spatial.spec.ts — Spatial Boundary Test
- **Setup**: ensure all 5 stations are in DB; 2 are planted < 5 km from origin, 3 are > 5 km
- **Test**: `GET /stations/search?lat=51.5074&lon=-0.1278&radius=5000`
- **Assertions**:
  - Status 200
  - Response array length === 2
  - Each returned station's haversine distance from origin < 5000 m (server-side + client-side double validation)
  - No station in response exceeds the radius

#### [NEW] tests/negative.spec.ts — Negative / Validation Tests
- Test 1: Missing `lat` param → 400 + error message
- Test 2: Missing `lon` param → 400
- Test 3: `lat` = `"not-a-number"` → 400
- Test 4: `radius` = `-1` → 400
- Test 5: `POST /reservations` with `{}` body → 400
- Test 6: `POST /reservations` with non-existent `stationId` → 404

#### [NEW] tests/concurrency.spec.ts — Concurrency / Locking Test
- **Setup**: reset station to `available` via DbHelper
- **Test**: Fire two simultaneous `Promise.all` reservation requests for the same `stationId`
- **Assertions**:
  - Exactly one response has status 200 (reservation created)
  - Exactly one response has status 409 (conflict / already reserved)
  - DB query confirms reservation count === 1

---

### Config

#### [NEW] package.json
Scripts: `test`, `test:headed`, `docker:up`, `docker:down`, `docker:logs`, `typecheck`

#### [NEW] playwright.config.ts
- `baseURL` from env, `testDir: './tests'`, `timeout: 30000`, `retries: 1`
- Custom reporter: `['./src/reporters/customReporter.ts', { outputDir: 'reports' }]` + `['list']`
- Single `APIRequestContext` project (no browser needed)

#### [NEW] tsconfig.json
`strict: true`, `moduleResolution: bundler`, `target: ES2022`, `paths` aliases `@helpers/*`, `@types/*`

---

## Verification Plan

### Automated — TypeScript Type Check
```powershell
cd "c:\Users\QAE\Downloads\EV Charging Station API Test Suite"
npx tsc --noEmit
```
Expected: zero errors.

### Automated — Docker Build
```powershell
cd "c:\Users\QAE\Downloads\EV Charging Station API Test Suite"
docker-compose build
docker-compose up -d
docker-compose ps   # all services should show "healthy"
```

### Automated — Full Test Run
```powershell
cd "c:\Users\QAE\Downloads\EV Charging Station API Test Suite"
npx playwright test --reporter=list
```
Expected: all tests pass (spatial: 1, negative: 6, concurrency: 1 = **8 tests total**).

### Manual — Custom Report
After the test run, open `reports/report.html` in a browser and verify:
- Pass/fail counts are correct
- Each test has name, duration, and status colour-coded
