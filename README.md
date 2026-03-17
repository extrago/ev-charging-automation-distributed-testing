<div align="center">

# ⚡ EV Charging Station API Test Suite

**Enterprise-grade API automation framework for EV Charging Station Spatial Search**

[![Playwright](https://img.shields.io/badge/Playwright-1.42+-45ba4b?logo=playwright&logoColor=white)](https://playwright.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed?logo=docker&logoColor=white)](https://www.docker.com)
[![PostGIS](https://img.shields.io/badge/PostGIS-15--3.3-336791?logo=postgresql&logoColor=white)](https://postgis.net)
[![Kafka](https://img.shields.io/badge/Apache_Kafka-7.3-231f20?logo=apachekafka&logoColor=white)](https://kafka.apache.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

*A production-ready, fully Dockerized API testing framework covering spatial geolocation, reservation concurrency, input validation, and real-time Kafka event streaming — all verified against a live PostGIS backend.*

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Test Suites](#-test-suites)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Running Tests](#-running-tests)
- [Environment Configuration](#-environment-configuration)
- [Database Schema](#-database-schema)
- [Reporting](#-reporting)
- [CI/CD Integration](#-cicd-integration)
- [Contributing](#-contributing)

---

## 🔍 Overview

This test suite provides **end-to-end API verification** for an EV Charging Station platform, covering:

- 📍 **Spatial search accuracy** — Haversine-validated radius queries against a real PostGIS database
- 🔒 **Reservation concurrency safety** — Race condition testing to ensure exclusive station booking
- 🛡️ **Input validation hardening** — WGS-84 boundary checks, type coercion, and error contract enforcement
- 🚛 **Kafka event-driven testing** — Fleet telemetry ingestion and speeding alert pipeline verification

All services — the API, PostGIS database, Kafka broker, and Zookeeper — run in isolated Docker containers defined in `docker-compose.yml`. No local database or Kafka installation is required.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Test Host (Playwright)                    │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ spatial.spec │  │negative.spec │  │ concurrency.spec       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘  │
│         │                 │                        │              │
│         └────────────┬────┘                        │              │
│                      │        ┌────────────────────┘              │
│              ┌───────▼────────▼──────┐                            │
│              │     ApiHelper.ts       │◄──── fleet_kafka.spec     │
│              │     DbHelper.ts        │◄──── KafkaHelper.ts       │
│              │     GeoHelper.ts       │                            │
│              └───────────┬───────────┘                            │
└──────────────────────────┼─────────────────────────────────────┘
                           │   Docker Network: ev-net
           ┌───────────────┼────────────────────────────┐
           │               │                            │
    ┌──────▼──────┐  ┌──────▼──────┐  ┌─────────────────▼──┐
    │  ev_api     │  │  ev_postgis  │  │  ev_kafka           │
    │  :3000      │  │  PostGIS 15  │  │  :9092 (external)   │
    │  Node.js    │  │  :5432       │  │  :29092 (internal)  │
    └──────┬──────┘  └─────────────┘  └────────────────────┘
           │                                    ▲
           └────────────────────────────────────┘
                     Kafka Consumer (kafkaConsumer.ts)
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| **PostGIS over in-memory geometry** | Enables authentic spatial index (`GIST`) testing matching production behavior |
| **Docker Compose healthchecks** | Guarantees DB and API are ready before any test runs — zero flaky startup failures |
| **Dual Kafka listeners** | Port `29092` for internal Docker service mesh; Port `9092` for Playwright producer on the host |
| **`EXCLUDE` constraint on reservations** | PostgreSQL-enforced exclusion prevents double-booking without application-level locking |
| **`fullyParallel: false`** | Preserves deterministic DB state across concurrency and spatial tests |

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Test Framework** | [Playwright](https://playwright.dev) 1.42+ | API request context, fixtures, assertions |
| **Language** | TypeScript 5.3 (strict mode) | Type safety across all helpers and specs |
| **Database** | PostgreSQL 15 + PostGIS 3.3 | Spatial station data with GIST indexing |
| **Message Broker** | Apache Kafka (Confluent 7.3) | Fleet telemetry event streaming |
| **Containerisation** | Docker Compose | Isolated, reproducible environment |
| **Reporting** | Allure + Custom HTML Reporter | Stakeholder dashboards + CI artifacts |
| **DB Client** | `pg` (node-postgres) | Direct DB assertions and state seeding |

---

## 📁 Project Structure

```
ev-charging-station-api-test-suite/
│
├── docker/
│   ├── api/                        # Dockerized Node.js API under test
│   │   ├── src/
│   │   │   ├── server.ts           # Express server with spatial endpoints
│   │   │   ├── kafkaConsumer.ts    # Kafka consumer — fleet telemetry + speeding alerts
│   │   │   └── db.ts               # pg connection pool
│   │   ├── Dockerfile
│   │   └── package.json
│   └── db/
│       └── init.sql                # PostGIS schema, spatial indices, seed data
│
├── src/
│   ├── helpers/
│   │   ├── apiHelper.ts            # Typed REST client (search, reservations, cancellation)
│   │   ├── dbHelper.ts             # Direct DB access for state seeding & assertions
│   │   ├── geoHelper.ts            # Pure Haversine distance calculations
│   │   └── KafkaHelper.ts          # Kafka producer for telemetry event injection
│   ├── fixtures/
│   │   └── index.ts                # Playwright fixtures: apiHelper, dbHelper, kafkaHelper
│   ├── reporters/
│   │   └── customReporter.ts       # Custom HTML + JSON business reporter
│   ├── types/
│   │   └── index.ts                # Shared TypeScript interfaces and types
│   └── config/                     # Test environment configuration
│
├── tests/
│   ├── spatial.spec.ts             # TC-001–006: Spatial boundary & Haversine validation
│   ├── negative.spec.ts            # TC-N-001–014: Input validation & error contract
│   ├── concurrency.spec.ts         # TC-C-001–005: Race condition & reservation locking
│   └── fleet_kafka.spec.ts         # TC-012: Kafka speeding alert pipeline
│
├── scripts/
│   └── wait-for-api.js             # Startup readiness probe script
│
├── reports/                        # Generated: HTML + JSON test reports
├── allure-results/                 # Generated: Allure report data
├── docker-compose.yml
├── playwright.config.ts
├── tsconfig.json
├── .env.example
└── package.json
```

---

## 🧪 Test Suites

### 📍 Spatial Boundary Tests (`spatial.spec.ts`)
These tests verify that the `GET /stations/search` endpoint performs accurate geospatial filtering using the seeded London dataset.

| ID | Test Case | Validates |
|---|---|---|
| TC-001 | 5 km radius returns only 2 near-origin stations | Correct spatial filtering |
| TC-002 | Results ordered by ascending distance | `ORDER BY distance ASC` behavior |
| TC-003 | Every result verified via Haversine formula | Mathematical correctness of coordinates |
| TC-004 | Stations outside 5 km strictly excluded | No false positives at boundary |
| TC-005 | 25 km radius returns all 5 seeded stations | Full coverage at wider radius |
| TC-006 | 50 m radius returns zero results | Edge case: extremely small radius |

### 🛡️ Negative Tests (`negative.spec.ts`)
Validates the API's input sanitisation, WGS-84 geographic constraints, and error response contract.

| ID | Test Case | Expected Status |
|---|---|---|
| TC-N-001 | Missing `lat` parameter | `400` |
| TC-N-002 | Missing `lon` parameter | `400` |
| TC-N-003 | Non-numeric `lat` value | `400` |
| TC-N-004 | Non-numeric `lon` value | `400` |
| TC-N-005 | Negative `radius` value | `400` |
| TC-N-006 | Zero `radius` value | `400` |
| TC-N-007 | `lat` > 90 (WGS-84 violation) | `400` |
| TC-N-008 | `lon` > 180 (WGS-84 violation) | `400` |
| TC-N-009 | Empty `POST /reservations` body | `400` |
| TC-N-010 | Non-integer `stationId` | `400` |
| TC-N-011 | Negative `stationId` | `400` |
| TC-N-012 | Valid-format non-existent `stationId` | `404` |
| TC-N-013 | Null `stationId` | `400` |
| TC-N-014 | Every `400` includes `error` + `message` fields | Error contract |

### ⚡ Concurrency Tests (`concurrency.spec.ts`)
Verifies that the PostgreSQL `EXCLUDE` constraint prevents double-booking when simultaneous reservation requests race for the same station.

| ID | Test Case | Validates |
|---|---|---|
| TC-C-001 | 2 simultaneous requests → exactly 1 `200`, 1 `409` | Mutual exclusion |
| TC-C-002 | 3 simultaneous requests → exactly 1 wins, 2 get `409` | N-way race safety |
| TC-C-003 | Sequential second attempt on reserved station → `409` | Idempotent rejection |
| TC-C-004 | Simultaneous reservations on different stations → both `200` | No cross-station contention |
| TC-C-005 | Re-reservation after cancellation succeeds | State machine correctness |

### 🚛 Fleet Kafka Integration (`fleet_kafka.spec.ts`)
End-to-end event-driven test: the Playwright test publishes a truck telemetry event to Kafka, and asserts that the API's consumer correctly writes a speeding alert to the PostGIS database.

| ID | Test Case | Validates |
|---|---|---|
| TC-012 | Speeding alert triggered when truck exceeds limit in restricted zone | Full Kafka → DB pipeline |

---

## ✅ Prerequisites

Ensure the following are installed on your machine:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Docker Compose v2)
- [Node.js](https://nodejs.org/) >= 18.x
- [npm](https://www.npmjs.com/) >= 9.x

Verify with:
```bash
docker --version        # Docker version 24+
docker compose version  # Docker Compose v2.x
node --version          # v18+
```

---

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/extrago/ev-charging-automation-distributed-testing.git
cd ev-charging-automation-distributed-testing
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env if needed — defaults work out of the box with Docker Compose
```

### 4. Start all infrastructure services

```bash
npm run docker:up
```

This command builds and starts:
- `ev_postgis` — PostGIS database (auto-runs `init.sql` to create schema + seed 5 London stations)
- `ev_api` — Node.js API server (waits for the DB healthcheck before starting)
- `ev_kafka` — Kafka broker
- `ev_zookeeper` — Zookeeper cluster coordinator

### 5. Wait for the API to be ready

```bash
npm run docker:wait
```

### 6. Run the full test suite

```bash
npm test
```

---

## 🧑‍💻 Running Tests

| Command | Description |
|---|---|
| `npm test` | Run all test suites |
| `npm run test:spatial` | Run spatial boundary tests only |
| `npm run test:negative` | Run negative input validation tests only |
| `npm run test:concurrency` | Run concurrency race condition tests only |
| `npm run test:headed` | Run with visible browser/reporter UI |
| `npm run typecheck` | TypeScript strict type-check (no emit) |
| `npm run docker:up` | Start all Docker services |
| `npm run docker:down` | Stop and remove all containers + volumes |
| `npm run docker:logs` | Stream live container logs |

### Running a single spec file

```bash
npx playwright test tests/spatial.spec.ts
npx playwright test tests/fleet_kafka.spec.ts
```

### Running a specific test by title

```bash
npx playwright test -g "TC-C-001"
```

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env` and adjust as needed:

```env
# API Under Test
API_BASE_URL=http://localhost:3000

# PostgreSQL / PostGIS
DB_HOST=localhost
DB_PORT=5432
DB_USER=ev_user
DB_PASSWORD=ev_secret
DB_NAME=ev_charging

# Kafka
KAFKA_BROKER=localhost:9092
KAFKA_TOPIC=truck-telemetry

# Test Identity Header
X_TEST_CLIENT=ev-playwright-suite
```

> **Note:** When running tests against Docker Compose services, the default values in `.env.example` work without modification. The API container uses its own internal environment variables (`DB_HOST=db`, `KAFKA_BROKER=kafka:29092`) within the Docker network.

---

## 🗄️ Database Schema

The PostGIS database is auto-initialised from `docker/db/init.sql` on first container start.

```sql
-- Spatial station registry with GIST index for fast radius queries
stations (id, name, operator, status, power_kw, connector, location GEOGRAPHY(POINT,4326), created_at)

-- Exclusive reservation constraint prevents double-booking at the DB level
reservations (id, station_id → stations, user_id, status, created_at)
  CONSTRAINT: EXCLUDE USING btree (station_id WITH =) WHERE (status = 'active')

-- Speeding alerts written by the Kafka consumer
alerts (id, truck_id, type, speed, location GEOGRAPHY(POINT,4326), created_at)
```

**Seeded Stations (London, WGS-84):**

| Station | Operator | Power | Connector | Coords |
|---|---|---|---|---|
| Covent Garden Rapid Charger | EV Connect Ltd | 50 kW | CCS | `51.5117, -0.1246` |
| Borough Market Hub | Osprey Charging | 22 kW | Type 2 | `51.5055, -0.0910` |
| Canary Wharf Supercharger | Tesla | 150 kW | Tesla/CCS | `51.5045, -0.0235` |
| Heathrow T5 Charger | Pod Point | 7.4 kW | Type 2 | `51.4770, -0.4885` |
| Stratford Rapid Station | Connected Kerb | 50 kW | CHAdeMO | `51.5421, -0.0020` |

---

## 📊 Reporting

After each test run, three reports are generated:

### 1. Custom Business Reporter
- **Location:** `reports/report.html` and `reports/results.json`
- Real-time pass/fail summary with duration metrics
- Structured JSON output for downstream integrations

### 2. Playwright HTML Report
- **Location:** `playwright-report/`
- Full trace, screenshot, and video attachments for failed tests
- Open with: `npx playwright show-report`

### 3. Allure Report
- **Location:** `allure-results/`
- Rich test management dashboard with categories, trends, and suite hierarchy
- Generate and open with:
```bash
npx allure generate allure-results --clean -o allure-report
npx allure open allure-report
```

---

## 🔄 CI/CD Integration

This suite is designed to drop into any CI pipeline. Example GitHub Actions workflow:

```yaml
name: EV API Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  api-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Start infrastructure
        run: npm run docker:up

      - name: Wait for API readiness
        run: npm run docker:wait

      - name: Run test suite
        run: npm test

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

      - name: Upload Allure results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: allure-results
          path: allure-results/
          retention-days: 14

      - name: Teardown infrastructure
        if: always()
        run: npm run docker:down
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/TC-XXX-description`
3. Write your test following the existing naming convention (e.g., `TC-XXX`)
4. Ensure type-checking passes: `npm run typecheck`
5. Submit a Pull Request with a clear description of the test case and acceptance criteria

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built with ❤️ for quality engineering**

*Playwright · TypeScript · PostGIS · Kafka · Docker*

---

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Basem_Abdelwahab-0077b5?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/basemabdelwahab/)

</div>
