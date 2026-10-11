# Changelog

## 0.1.0 — 2026-10-12

First implementation.

* Scientific core: parsers (TLE, OMM KVN/XML/JSON/CSV, OEM KVN, CDM KVN, astral-states CSV/JSON), validation and dataset-level checks, time systems, frames (fast interpolated TEME↔GCRF), SGP4 / Hermite ephemeris / J2 propagators, screening with a provably conservative proximity bound, encounter geometry, covariance validation, 2D Pc with Monte Carlo cross-check, manoeuvre comparison, synthetic data generator.
* Backend: FastAPI app, SQLAlchemy models and Alembic migration, local and production profiles, Argon2id auth with sessions/CSRF/API tokens, project RBAC, audit log, rate limits and quotas, DB-backed job queue with in-process or external workers, reports (PDF/CSV/JSON), OEM/CDM export, CelesTrak provider (Space-Track unverified), ML lab.
* Frontend: 11 views implementing the "ASTRAL Pairings" design (pairings D Ignition / E Kyoto), 3D environment, analytics with CSV export.
* Deployment: Dockerfile, Docker Compose (PostgreSQL, API, worker), CI workflow.
* Validation fixes during the build: proximity bound tightened (800-object screening 78.5 s → 6.0 s, identical results); manoeuvre simulation 73.6 s → 6.2 s; Pc underflow now reported explicitly; security upgrades (starlette 1.7, pytest 9, react-router 7).
