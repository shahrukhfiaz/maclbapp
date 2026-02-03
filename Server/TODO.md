# Backend Build Plan

## Phase 0 - Foundations
- [ ] Capture product requirements and legal constraints for DAT integration (licensing, ToS compliance)
- [ ] Define user roles (super-admin, reseller admin, end user, support) and permission matrix
- [ ] Choose cloud infrastructure stack (DigitalOcean Droplets/Kubernetes, managed DB, object storage)
- [ ] Establish coding standards, Git workflow, formatting, commit policies

## Phase 1 - Architecture & Project Setup
- [x] Document high-level system architecture (service boundaries, data flow, session lifecycle)
- [x] Design data models for users, proxies, sessions, domains, audit logs
- [x] Define API surface (REST endpoints) including authentication, CRUD, session operations
- [x] Decide tech stack (Node.js + Express, PostgreSQL via Prisma, Redis/Spaces planned)
- [x] Scaffold repository (backend structure, docs baseline)
- [x] Configure environment management (.env templates, zod validation)

## Phase 2 - Core Services
- [x] Implement authentication/authorization service (JWT access+refresh, RBAC middleware)
- [x] Build user management endpoints (create/update/delete/list, role assignment, password policies)
- [x] Integrate secure credential storage (hashing, env-driven secrets)
- [x] Implement proxy inventory service (CRUD proxies, springboard for health checks)
- [x] Implement DAT session service (create/update/delete sessions, status tracking, login metadata)
- [x] Add domain management endpoints (CRUD DAT domains, maintenance flags)
- [x] Implement audit logging for all privileged actions

## Phase 3 - Session Seeder & File Pipeline
- [x] Design Playwright/Puppeteer worker to log into DAT using master credentials on cloud server
- [x] Store Chromium profile bundles securely (encrypt, upload to object storage, metadata persistence)
- [x] Expose APIs to retrieve signed URLs for session bundle download/upload
- [x] Implement upload endpoints for clients to push updated session archives
- [ ] Build background jobs to rotate sessions, refresh expired tokens, clean stale zips
- [x] Add monitoring hooks for failed logins, DAT maintenance detection, proxy failures (event ingestion)

## Phase 4 - Security & Compliance
- [ ] Enforce input validation, rate limiting, IP allowlists on admin APIs
- [ ] Implement secrets rotation, encrypted storage (KMS or libsodium) for sensitive fields
- [ ] Add comprehensive audit trail (who pulled which session, when)
- [ ] Conduct threat modeling and privacy review
- [ ] Implement alerting for anomalous activity (multiple downloads, failed decryptions)

## Phase 5 - Ops & Tooling
- [ ] Containerize services (Dockerfiles, multi-stage builds)
- [ ] Write docker-compose for local dev (API, Postgres, Redis, MinIO, worker)
- [ ] Create GitHub Actions/CI pipeline (lint, test, security scan, build images)
- [ ] Prepare IaC (Terraform/DOCTL) for DigitalOcean resources (Droplets/K8s, databases, spaces)
- [ ] Implement centralized logging and metrics collection
- [ ] Document deployment playbooks and rollback procedures

## Phase 6 - Testing & QA
- [ ] Write unit tests for services/controllers
- [ ] Write integration tests covering API flows with test DB
- [ ] Mock DAT endpoints for automated tests
- [ ] Execute manual QA for session seeding + Electron client integration
- [ ] Perform load testing on critical endpoints (session download/upload)

## Phase 7 - Documentation & Handover
- [ ] Document API (OpenAPI/Swagger), data models, and client integration steps
- [ ] Provide runbooks for support (reset session, rotate proxy, revoke user)
- [ ] Create security guidelines for operators and customer admins
- [ ] Plan future roadmap (multi-master accounts, analytics dashboard, billing integration)

