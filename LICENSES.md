# Licences and third-party inventory

ASTRAL source code: Apache License 2.0 (see `LICENSE`).

## Notable obligations

* **psycopg / psycopg-binary — LGPL-3.0-only.** Used unmodified as a dynamically imported library. Satisfies LGPL when distributed unmodified with notice; users must be able to replace it (pip-installable). Review before redistributing modified binaries.
* **world-atlas** (Natural Earth 1:110m, public domain) — used to draw the Earth texture locally.
* **Vallado SGP4 verification data** (`tests/reference/SGP4-VER.TLE`, `tcppver.out`) — redistributed with python-sgp4 (MIT); originally published with Vallado et al., AIAA 2006-6753.
* **Fonts** (Fjalla One, Cantarell, IBM Plex Mono, Quicksand via @fontsource) — SIL Open Font License 1.1.
* NASA CARA tools were **not** incorporated (they were not accessible from the build environment).

Inventories were generated from installed package metadata in this build. Declared licences have not been independently audited.

## Python runtime dependencies (`backend/requirements.lock.txt`)

| Package | Version | Licence (as declared in package metadata) |
|---|---|---|
| alembic | 1.14.1 | MIT License |
| annotated-doc | 0.0.5 | MIT |
| annotated-types | 0.8.0 | MIT |
| anyio | 4.15.1 | MIT |
| argon2-cffi | 23.1.0 | MIT |
| argon2-cffi-bindings | 26.1.0 | MIT |
| astropy | 6.1.7 | BSD License |
| astropy-iers-data | 0.2026.10.5.1.0.7 | BSD-3-Clause |
| certifi | 2026.7.22 | Mozilla Public License 2.0 (MPL 2.0) |
| cffi | 2.1.1 | MIT-0 |
| chardet | 7.6.0 | 0BSD |
| click | 8.5.0 | BSD-3-Clause |
| cloudpickle | 3.1.2 | BSD License |
| colorama | 0.4.6 | BSD License |
| contourpy | 1.3.3 | BSD License |
| cycler | 0.12.1 | BSD License |
| defusedxml | 0.7.1 | Python Software Foundation License |
| dnspython | 2.9.0 | ISC |
| email-validator | 2.3.0 | The Unlicense (Unlicense) |
| fastapi | 0.143.0 | MIT |
| fonttools | 4.66.1 | MIT |
| greenlet | 3.5.6 | MIT AND PSF-2.0 |
| h11 | 0.16.0 | MIT License |
| httpcore | 1.0.9 | BSD-3-Clause |
| httptools | 0.9.0 | MIT |
| httpx | 0.27.2 | BSD-3-Clause |
| idna | 3.20 | BSD-3-Clause |
| joblib | 1.6.0 | BSD-3-Clause |
| kiwisolver | 1.5.1 | BSD License |
| Mako | 1.4.3 | MIT |
| MarkupSafe | 3.0.4 | BSD-3-Clause |
| matplotlib | 3.9.4 | Python Software Foundation License |
| numpy | 2.1.3 | BSD License |
| opentelemetry-api | 1.45.1 | Apache-2.0 |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause |
| pillow | 12.3.0 | MIT-CMU |
| psutil | 6.1.1 | BSD License |
| psycopg | 3.2.13 | LGPL-3.0-only |
| psycopg-binary | 3.2.13 | LGPL-3.0-only |
| pycparser | 3.11 | BSD-3-Clause |
| pydantic | 2.14.0 | MIT |
| pydantic-settings | 2.15.0 | MIT |
| pydantic_core | 2.50.0 | MIT |
| pyerfa | 2.0.1.5 | BSD License |
| pyparsing | 3.3.3 | MIT |
| python-dateutil | 2.9.0.post0 | BSD License; Apache Software License |
| python-dotenv | 1.2.4 | BSD-3-Clause |
| python-multipart | 0.0.32 | Apache-2.0 |
| PyYAML | 6.0.3 | MIT License |
| reportlab | 4.2.5 | BSD License |
| scikit-learn | 1.5.2 | BSD License |
| scipy | 1.14.1 | BSD License |
| sgp4 | 2.24 | MIT License |
| six | 1.17.0 | MIT License |
| sniffio | 1.3.1 | MIT License; Apache Software License |
| SQLAlchemy | 2.0.54 | MIT |
| starlette | 1.7.0 | BSD-3-Clause |
| threadpoolctl | 3.7.0 | BSD-3-Clause |
| typing-inspection | 0.4.4 | MIT |
| typing_extensions | 4.16.0 | PSF-2.0 |
| tzdata | 2026.5 | Apache-2.0 |
| uvicorn | 0.32.1 | BSD License |
| watchfiles | 1.3.0 | MIT License |
| websockets | 17.2 | BSD-3-Clause |

## Frontend runtime dependencies (direct)

| Package | Version | Licence |
|---|---|---|
| @fontsource/cantarell | 5.3.0 | OFL-1.1 |
| @fontsource/fjalla-one | 5.3.0 | OFL-1.1 |
| @fontsource/ibm-plex-mono | 5.3.0 | OFL-1.1 |
| @fontsource/quicksand | 5.3.0 | OFL-1.1 |
| @react-three/drei | 9.122.0 | MIT |
| @react-three/fiber | 8.18.0 | MIT |
| @tanstack/react-query | 5.104.1 | MIT |
| react | 18.3.1 | MIT |
| react-dom | 18.3.1 | MIT |
| react-router-dom | 7.18.4 | MIT |
| recharts | 3.10.1 | MIT |
| three | 0.169.0 | MIT |
| topojson-client | 3.1.0 | ISC |
| world-atlas | 2.0.2 | ISC |

Transitive npm licences: `npx license-checker --production` (not run in this build).
