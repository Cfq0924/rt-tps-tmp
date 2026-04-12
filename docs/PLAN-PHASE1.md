# Phase 1 Implementation Plan — my_tps Treatment Planning System

**Status:** ENG REVIEW COMPLETE — All decisions incorporated, 2026-04-05
**Date:** 2026-04-05
**Branch:** main (greenfield)
**CEO Review Date:** 2026-04-05
**Eng Review Date:** 2026-04-05
**Review Mode:** SELECTIVE EXPANSION

---

## Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | SQLite for Phase 1 | Avoids Docker/postgres complexity; schema migratable to PostgreSQL in Phase 2 |
| 2 | Add basic JWT auth to Phase 1 | Closes critical PHI exposure gap; ~1 day effort with `jsonwebtoken` + `bcryptjs` |
| 3 | Reject DICOM on parse failure (not silent) | Silent failures create orphaned files with no series association — user-visible 422 error |
| 4 | **ACCEPTED EXPANSION:** Cornerstone3D Segmentation Service | Use Cornerstone3D labelmap API instead of Canvas2D overlay for contouring — enables Phase 2 DICOM SEG export without re-architecture |
| 5 | **ACCEPTED EXPANSION:** Full AI HTTP interface | Design `contouringService.js` + `POST /api/contouring/auto` as real HTTP hook, not console.log stub |
| 6 | UUID-rename uploaded files | Prevent file path traversal (`../etc/passwd`); always rename to UUID, never use original filename |
| 7 | Explicit CORS policy | `cors` middleware with explicit allowed origins (`:5173` for dev) |
| 8 | 500MB file size limit + per-patient study count | Prevent abuse; `multer({ limits: { fileSize: 500 * 1024 * 1024 } })` → 413 error |
| 9 | **ACCEPTED EXPANSION:** Synthetic DICOM test fixtures | Programmatic DICOM fixtures covering edge cases (empty structures, duplicate SOPInstanceUID, zero-dose RTDOSE) alongside TEST849 |
| 10 | Fix N+1 in patient list | Return `study_count` in initial `GET /api/patients` via SQL JOIN — single round-trip |
| 11 | Morgan + Winston logging | HTTP request logs (Morgan) + structured application logs (Winston) for audit trail |
| 12 | Phase 2 deployment architecture documented | Phase 1: separate dev servers. Phase 2: Express serves built frontend as static, single-origin |
| **13** | **HMAC-signed Blob URLs** | `GET /api/files/download/:fileId?expires=...&sig=...` — 15-min expiry, HMAC-SHA256 signature |
| **14** | **60s AI endpoint timeout** | `POST /api/contouring/auto` fetch has 60s timeout → 504 "AI service timed out" toast |
| **15** | **Audit log: Auth + DICOM ops** | Log: login/logout, patient CRUD, study CRUD, file upload/delete/access |
| **16** | **SegmentationService in M1** | Initialize `SegmentationService` in `initCornerstone.js` during Milestone 1 — load-bearing for M3/M4 |
| **17** | **RT Dose: Cornerstone3D with Canvas2D fallback** | Use Cornerstone3D built-in dose overlay; if it doesn't handle Dose→CT coordinate transform, fall back to custom Canvas2D (RT-VIEWER pattern) |

---

## Context: What We're Building

A browser-based **Treatment Planning System (TPS)** for radiation oncology — a B/S (Browser/Server) clinical application. Phase 1 delivers a working end-to-end prototype covering all four stated goals:

1. **DICOM import/export** — Upload DICOM files, parse metadata, associate with patients
2. **Patient list management** — Create, browse, search patients; link DICOM studies
3. **DICOM visualization** — Display CT/MRI with RT Dose and RT Structure overlays
4. **Contouring interface** — Display RT Structure, manual brush/eraser tools, AI auto-contour hook

**Reference implementations studied:**
- `test_module/RT-VIEWER-main/` — React + MUI + cornerstone-core (legacy), file-based DICOM loading, Canvas2D overlays
- `test_module/Viewers-master/` — OHIF medical image viewer, Cornerstone3D, enterprise architecture, monorepo

**Design system:** See `DESIGN.md` — IBM Plex Sans + IBM Plex Mono, dark clinical navy, teal primary, amber dose accent.

---

## Tech Stack Decisions

### Frontend
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 18 + Vite | Faster dev server than CRA, better TypeScript support |
| UI Library | MUI v5 (Material UI) | Matches OHIF and RT-VIEWER references; pre-built dark clinical theme |
| Imaging | `@cornerstonejs/core` + `@cornerstonejs/tools` | Current Cornerstone3D API (OHIF uses 4.20.0); significantly better than legacy cornerstone-core |
| **Segmentation** | `@cornerstonejs/segmentation` | **Decision 4:** Use Cornerstone3D Segmentation Service for labelmap-first contouring (not Canvas2D) |
| DICOM Parsing | `dcmjs` | JavaScript DICOM toolkit; OHIF uses 0.49.4 |
| State | Zustand | Lightweight, OHIF uses it; simpler than Redux |
| Build | Vite | Fast HMR, native ESM, standard React tooling |

### Backend
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js 20 LTS | JavaScript end-to-end reduces cognitive load |
| Framework | Express.js | Familiar, well-documented, extensive middleware |
| Database | SQLite via `better-sqlite3` | Phase 1 only; no separate DB server; synchronous for simplicity; migrate to PostgreSQL in Phase 2 |
| File Storage | Local disk via `multer` | Phase 1: files in `uploads/` (UUID-renamed); S3-compatible in Phase 2 |
| DICOM Validation | `dcmjs` (server-side) | Parse and validate DICOM headers on upload; **Decision 3:** reject on parse failure → 422 |
| **Auth** | JWT (HttpOnly cookie) + bcrypt | **Decision 2:** Basic session auth; `jsonwebtoken` + `bcryptjs` |
| **Logging** | Morgan + Winston | **Decision 11:** HTTP request logs + structured app logs |
| **Rate Limiting** | `express-rate-limit` | Per-IP rate limiting on upload and auth endpoints |

### Key Architectural Decisions

**A. Client-side DICOM rendering** — Cornerstone3D's `wadouri` image loader loads DICOM files directly in the browser via Blob URLs (fetched from the backend). The backend does NOT act as a WADO server. Correct for Phase 1.

**B. Cornerstone3D Segmentation Service (not Canvas2D)** — **Decision 4:** Structure editing uses the Cornerstone3D Segmentation Service which manages labelmap volumes as first-class objects. Brush strokes are semantic edits to labelmap data, not raw canvas pixels. Enables Phase 2 DICOM SEG export without re-architecture.

**C. AI Auto-Contouring as HTTP API** — **Decision 5:** `POST /api/contouring/auto` is a real HTTP endpoint (stub returns 501 "not configured"). The interface is designed so Phase 2 can point it at any AI inference service.

**D. Monorepo** — Single git repository with `frontend/` and `backend/` directories. npm workspaces. Phase 2: Express serves built frontend as static → single-origin, no CORS.

---

## Directory Structure

```
my_tps_workspace/
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/
│   │   │   ├── auth.js           # POST /api/auth/login, POST /api/auth/logout
│   │   │   ├── patients.js       # GET/POST/DELETE /api/patients
│   │   │   ├── studies.js        # GET/POST /api/studies
│   │   │   ├── files.js          # POST /api/files/upload, GET /api/files/:studyId
│   │   │   └── contouring.js     # POST /api/contouring/auto (AI hook)
│   │   ├── services/
│   │   │   ├── authService.js
│   │   │   ├── patientService.js
│   │   │   ├── studyService.js
│   │   │   ├── dicomService.js   # dcmjs parse + metadata extraction
│   │   │   └── contouringService.js  # AI auto-contour HTTP interface
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   ├── init.js
│   │   │   └── queries.js        # Parameterized SQL
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT verification middleware
│   │   │   ├── errorHandler.js
│   │   │   ├── validateDicom.js   # dcmjs parse → reject on failure (422)
│   │   │   └── upload.js          # multer + UUID rename + 500MB limit
│   │   └── logging/
│   │       └── index.js           # Winston logger instance
│   ├── uploads/                    # DICOM files, UUID-renamed (gitignored)
│   ├── tests/
│   │   ├── fixtures/              # Synthetic DICOM test files (Decision 9)
│   │   └── api.test.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── theme.js
│   │   ├── features/
│   │   │   ├── auth/             # Login/logout pages
│   │   │   ├── patients/
│   │   │   │   ├── PatientListPage.jsx
│   │   │   │   ├── PatientDetailPage.jsx
│   │   │   │   ├── PatientSearch.jsx
│   │   │   │   └── hooks/
│   │   │   │       └── usePatients.js
│   │   │   ├── viewer/
│   │   │   │   ├── ViewerPage.jsx
│   │   │   │   ├── ViewerViewport.jsx    # Cornerstone3D rendering
│   │   │   │   ├── StructurePanel.jsx
│   │   │   │   ├── DosePanel.jsx
│   │   │   │   ├── Toolbar.jsx
│   │   │   │   └── hooks/
│   │   │   │       ├── useCornerstoneInit.js
│   │   │   │       ├── useDicomLoader.js
│   │   │   │       ├── useRTStructures.js   # dcmjs RT Structure parsing
│   │   │   │       ├── useRTDose.js         # dcmjs RT Dose parsing
│   │   │   │       └── useSegmentationService.js  # Labelmap CRUD
│   │   │   └── contouring/
│   │   │       ├── ContouringPanel.jsx      # Tool selector + AI auto-contour button
│   │   │       ├── BrushTool.js            # Cornerstone3D BrushSegmentTool
│   │   │       ├── EraserTool.js          # Cornerstone3D EraserSegmentTool
│   │   │       ├── FillTool.js            # Cornerstone3D PaintFillSegmentTool
│   │   │       └── hooks/
│   │   │           └── useContouring.js   # Segmentation state + undo/redo
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── AppBar.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── FileDropzone.jsx
│   │   │   ├── LoadingSpinner.jsx
│   │   │   └── ErrorBoundary.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   └── lib/
│   │       ├── cornerstone/
│   │       │   └── initCornerstone.js  # Register image loader + tools
│   │       └── dicom/
│   │           └── seriesGrouper.js
│   ├── public/
│   │   └── sample-data/          # Bundled TEST849
│   ├── tests/
│   │   ├── fixtures/             # Synthetic DICOM fixtures (Decision 9)
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── package.json
│   └── vite.config.js
│
├── shared/
│   └── types/
│       └── index.js
│
└── package.json
```

---

## Milestone 1: Project Scaffold + Auth + DICOM Viewer Shell
**Goal:** Working React app with Cornerstone3D rendering CT images; JWT auth protecting all API routes

### Auth (Decision 2)
- [ ] `POST /api/auth/register` — create user (name, email, password)
- [ ] `POST /api/auth/login` — verify credentials → set HttpOnly JWT cookie
- [ ] `POST /api/auth/logout` — clear cookie
- [ ] `auth.js` middleware — verify JWT on all `/api/*` routes except `/api/auth/*` and `/api/health`
- [ ] Frontend: login page, auth state in Zustand, redirect to login if unauthenticated

### Frontend Scaffold
- [ ] Vite + React 18 + TypeScript
- [ ] MUI dark clinical theme per `DESIGN.md`
- [ ] Install Cornerstone3D: `@cornerstonejs/core`, `@cornerstonejs/tools`, `@cornerstonejs/segmentation`, `@cornerstonejs/dicom-image-loader`
- [ ] `initCornerstone.js` — register dicom-image-loader + tools (WWWC, Zoom, Pan, StackScroll, BrushSegmentTool) **+ SegmentationService** (Decision 16: SegmentationService must be initialized in Milestone 1 — it is load-bearing for Milestones 3 and 4)
- [ ] `ViewerViewport.jsx` — Cornerstone3D rendering surface
- [ ] `Toolbar.jsx` — layout presets (1x1–4x4), WW/WC presets
- [ ] Route: `/login` + `/viewer`

### Backend Scaffold
- [ ] Express + `better-sqlite3` + `multer` + `cors` + `express-rate-limit`
- [ ] SQLite schema — **full DDL below** (users + patients + studies + dicom_files + audit_log)
- [ ] `uploads/` middleware: UUID-rename all files, 500MB limit, `LIMIT_FILE_SIZE` → 413
- [ ] `GET /api/health` — no auth required

### Database Schema
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  birth_date TEXT,
  gender TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE studies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  study_instance_uid TEXT UNIQUE NOT NULL,
  study_date TEXT,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dicom_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  series_instance_uid TEXT NOT NULL,
  sop_instance_uid TEXT UNIQUE NOT NULL,
  modality TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id TEXT,
  user_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id INTEGER,
  metadata TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dicom_files_study ON dicom_files(study_id);
CREATE INDEX idx_dicom_files_series ON dicom_files(series_instance_uid);
CREATE INDEX idx_dicom_files_sop ON dicom_files(sop_instance_uid);
CREATE INDEX idx_studies_patient ON studies(patient_id);
CREATE INDEX idx_studies_uid ON studies(study_instance_uid);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
```

### Auth Strategy (Decision 2)
- JWT expiry: **24 hours** — simple for Phase 1
- On app load: silent verify → if valid, continue; if expired/invalid, redirect to `/login`
- On 401 from any API: frontend interceptor redirects to `/login`
- Audit log: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `TOKEN_EXPIRED`

### DICOM Upload
- [ ] `validateDicom.js` — parse with dcmjs; **Decision 3:** on failure → DELETE temp file → 422 `{ error: "Invalid DICOM", detail }`
- [ ] `POST /api/files/upload` — store UUID-renamed file, extract metadata, insert record
- [ ] **Duplicate SOPInstanceUID:** silently skip → return `{ fileId: null, skipped: true }`
- [ ] `GET /api/files/:studyId` — return file metadata + **HMAC-signed download URL** (Decision 13):
  - Path: `/api/files/download/:fileId?expires=<unix_ts>&sig=<hmac_sha256>`
  - Signature validity: 15 minutes
  - Signature: `HMAC-SHA256(fileId + expires, SECRET_KEY)`

### Client-Side Loading
- [ ] After upload, fetch file list from backend
- [ ] `wadouri.fileManager.add(blob)` → Cornerstone
- [ ] Group files by `SeriesInstanceUID` using dcmjs metadata
- [ ] **Lazy loading (Decision 4A):** Load only the active slice + 2 adjacent slices. Do not load all slices into memory simultaneously. This prevents memory pressure for large studies (500+ slices).
- [ ] Display first CT series

### Verification
- [ ] Login → create patient → upload files → see CT in viewer
- [ ] Unauthenticated requests return 401
- [ ] Invalid DICOM upload returns 422 (not silent)

---

## Milestone 2: Patient List + Study Management
**Goal:** Patient CRUD with auth; DICOM file association; `study_count` in patient list (Decision 10)

### Backend
- [ ] `GET /api/patients` — paginated, search by name/ID, **include `study_count` via SQL JOIN** (Decision 10)
- [ ] `POST /api/patients` — create (auth required)
- [ ] `GET /api/patients/:id` — patient + studies
- [ ] `DELETE /api/patients/:id` — cascade delete studies + files + delete physical files
- [ ] `POST /api/studies` — create study (auto-created on DICOM upload)
- [ ] `GET /api/studies/:id/files` — list files with metadata
- [ ] On DICOM upload: auto-detect StudyInstanceUID, create study if not exists, link files

### Frontend
- [ ] `PatientListPage.jsx` — table: Name, ID, DOB, Study Count, Created, Actions
- [ ] `PatientSearch.jsx` — debounced search
- [ ] `PatientDetailPage.jsx` — patient info + study list + upload dropzone
- [ ] `usePatients.js` — Zustand store + API hooks
- [ ] Navigate to viewer with selected study

### Verification
- [ ] 100 patients → list shows `study_count` without N+1
- [ ] Upload same StudyInstanceUID → files grouped into existing study

---

## Milestone 3: RT Structure + RT Dose Overlays
**Goal:** Parse RT Structure and RT Dose DICOM files; render using Cornerstone3D overlays

### RT Structure
- [ ] `useRTStructures.js` — find RTSTRUCT file in study: query `GET /api/studies/:id/files` → filter by `modality === "RTSTRUCT"` (modality-based, not filename-based)
- [ ] Parse RT Structure using dcmjs `RTStructure` — extract ROI list (name, number, color, contour arrays)
- [ ] `StructurePanel.jsx` — ROI list with visibility toggles, color chips
- [ ] Cornerstone3D `SegmentationService` — import RT Structure as labelmap
- [ ] `CornerstoneViewport` with segmentation overlay enabled
- [ ] Slice change → update active slice in labelmap

### RT Dose
- [ ] `useRTDose.js` — find RTDOSE file: query `GET /api/studies/:id/files` → filter by `modality === "RTDOSE"`
- [ ] Extract: pixel data (7fe0,0010) × DoseGridScaling (3004,000e)
- [ ] `DosePanel.jsx` — toggle overlay, opacity slider (0–100%), color scale
- [ ] `DoseToCT` coordinate transform (Dose→Patient→CT chain)
- [ ] Cornerstone3D `CornerstoneViewport` with dose overlay
- [ ] **Decision 17:** Attempt Cornerstone3D built-in dose overlay. If Dose→CT coordinate transform is incorrect → fall back to custom Canvas2D heatmap rendering (RT-VIEWER pattern)

### Key DICOM Parsing
```
RT Structure (3006,*):
  ROI Sequence → ROI Number, ROI Name, Display Color (3006,002A)
  Contour Sequence → Contour Data [x,y,z triplets] (3006,0050)
RT Dose (3004,* + 7fe0,*):
  Pixel Data × DoseGridScaling
  Dose→Patient matrix × invert(CT→Patient matrix)
```

### Verification
- [ ] TEST849: RT Structure contours overlay CT slices accurately
- [ ] TEST849: RT Dose heatmap at correct anatomical location
- [ ] Empty RT Structure (0 ROIs) handled gracefully — no crash

---

## Milestone 4: Contouring Interface
**Goal:** Manual brush/eraser tools via Cornerstone3D Segmentation Service; AI auto-contour HTTP hook

### Cornerstone3D Segmentation (Decision 4)
- [ ] `useSegmentationService.js` — initialize `SegmentationService`, register brush/eraser/fill tools
- [ ] `BrushSegmentTool` — paint labelmap with selected ROI index
- [ ] `EraserSegmentTool` — erase from labelmap
- [ ] `PaintFillSegmentTool` — flood-fill region within current contour
- [ ] Brush size: 1–20px slider
- [ ] Active structure selector in `ContouringPanel`
- [ ] Undo/Redo stack — `SegmentationService` has native state; implement as last-20-states ring buffer per slice

### AI Auto-Contouring Interface (Decision 5)
- [ ] `POST /api/contouring/auto` — HTTP request to AI inference endpoint
  - Request: `{ studyId, seriesInstanceUid, roiName }`
  - Response: `{ mask: base64, dimensions: [x, y, z] }`
  - Phase 1: endpoint returns `501 { error: "AI service not configured" }`
  - **60s timeout (Decision 14):** fetch has 60s AbortSignal timeout → returns 504 `{ error: "AI service timed out" }`
- [ ] `contouringService.js` — HTTP client calling AI endpoint
- [ ] `AutoContourButton.jsx` — triggers service, shows loading state, renders result as new structure
- [ ] Result: new labelmap imported into `SegmentationService` → appears in `StructurePanel`

### Verification
- [ ] Brush strokes on CT slice are reflected in labelmap
- [ ] Undo reverts last brush stroke
- [ ] AI auto-contour button shows "not configured" in Phase 1 (not a silent failure)

---

## Testing Strategy

### Synthetic DICOM Fixtures (Decision 9)
`tests/fixtures/generateFixtures.js` — programmatically generate DICOM files using dcmjs:
- `valid_ct.dcm` — valid CT with minimal pixel data
- `empty_rtstructure.dcm` — RT Structure with 0 ROIs
- `single_pixel_dose.rtdose.dcm` — RT Dose with single-pixel dose value
- `duplicate_sop_uid.dcm` — SOPInstanceUID matching existing file
- `wrong_modality.dcm` — MR file uploaded as CT

### Unit Tests (Vitest)
- `backend/services/dicomService.test.js` — parse valid + invalid DICOM → expected error codes
- `backend/services/patientService.test.js` — CRUD against in-memory SQLite
- `frontend/features/viewer/hooks/useDicomLoader.test.js` — series grouping edge cases
- **Updated:** `backend/services/contouringService.test.js` — AI endpoint returns 501 when not configured **+ 60s timeout → `AIContouringTimeoutError` thrown → 504 response**

### Integration Tests (Supertest)
- `backend/tests/api.test.js` — full flow: login → create patient → upload → list
- All tests use synthetic fixtures; no external network required

### E2E Tests (Playwright)
- `e2e/auth.spec.js` — login, logout, JWT expiry
- `e2e/patient-workflow.spec.js` — create patient → upload files → view CT in viewer
- `e2e/contouring.spec.js` — load CT+RTSTRUCT → brush tool → undo → AI auto-contour stub

---

## Error & Rescue Registry

| Code Path | Failure | Exception | Rescued? | User Sees |
|-----------|---------|-----------|----------|-----------|
| `validateDicom.js` | dcmjs parse failure | `SyntaxError` / `TypeError` | **Y** | 422 "Invalid DICOM" |
| `POST /api/files/upload` | File > 500MB | `LIMIT_FILE_SIZE` | **Y** | 413 "File too large" |
| `POST /api/files/upload` | File path traversal attempt | N/A | **Y** (UUID rename) | File stored normally |
| `POST /api/files/upload` | Disk full | `ENOSPC` | **Y** | 507 "Storage error" |
| `dicomService.parse()` | Corrupt DICOM (partial parse) | `Error` | **Y** | 422 with detail |
| `contouringService.autoSegment()` | AI endpoint unreachable | `FetchError` | **Y** | Toast: "AI service unavailable" |
| `contouringService.autoSegment()` | AI returns non-200 | `Error` | **Y** | Toast: "AI inference failed" |
| All DB queries | SQLite locked | `SqliteBusyError` | **Y** | 503 "Service temporarily unavailable" |
| All DB queries | SQL syntax error | N/A | **N** ← GAP | 500 "Internal error" — **must log full query** |

---

## Security Posture

| Threat | Mitigation | Status |
|--------|-----------|--------|
| Unauthenticated API access | JWT in HttpOnly cookie + `auth` middleware on all routes | ✅ Implemented |
| File path traversal | UUID rename on upload; never use original filename | ✅ Implemented |
| DICOM parse failure → orphan files | Reject + delete temp file on parse failure | ✅ Implemented |
| Large file DoS | `multer({ limits: { fileSize: 500MB } })` → 413 | ✅ Implemented |
| CORS misconfiguration | Explicit `cors` middleware with allowed origins | ✅ Implemented |
| SQL injection | Parameterized queries via `better-sqlite3` | ✅ Implemented |
| Brute force auth | `express-rate-limit` on `/api/auth/*` (10 req/min) | ✅ Implemented |
| Audit trail | Morgan (HTTP) + Winston (structured app logs) | ✅ Implemented |

---

## Logging Architecture (Decision 11)

All log entries include: timestamp, level, request ID (UUID), user ID (if authenticated), operation, duration_ms.

```
Morgan:            GET /api/patients 200 45ms [userId: 3]
Winston (info):    { reqId, userId, action: "PATIENT_CREATED", patientId: 42 }
Winston (error):   { reqId, userId, action: "DICOM_UPLOAD_FAILED", error: "corrupt file", stack }
Winston (warn):    { reqId, action: "RATE_LIMIT_EXCEEDED", ip: "..." }
```

Audit log table (SQLite):
```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  req_id TEXT,
  user_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id INTEGER,
  metadata TEXT,         -- JSON
  ip_address TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

## Non-Goals (Deferred to Phase 2+)

- DICOM WADO server (WADO-RS / DICOMweb)
- RT Plan (RTPLAN) visualization and dose calculation
- 3D / MPR views
- Multi-user concurrent editing
- Docker / Kubernetes deployment
- PostgreSQL migration (SQLite Phase 1 only)
- AI model training or hosting (Phase 2: inference endpoint only)
- Audit log UI (admin panel to query audit_log table)

---

## Phase 2: Deployment Architecture

**Phase 1:** Separate dev servers (Vite :5173, Express :3000). CORS configured.

**Phase 2:** `frontend/` builds to `backend/public/`. Express serves static files. Single origin. No CORS needed.

```
# Phase 2 deployment
backend/src/index.js:
  app.use(express.static(path.join(__dirname, 'public')))
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))
```

**Phase 2 storage:** `uploads/` → S3-compatible object storage. Multer configured with `s3` multer storage engine.

---

## Implementation Order

```
Week 1-2: Milestone 1 (Scaffold + Auth + Viewer Shell)
  → Workspace setup (npm workspaces, packages)
  → Express scaffold + SQLite + auth (JWT + bcrypt)
  → MUI dark theme + Cornerstone3D init
  → Upload + validateDicom middleware (reject on parse failure)
  → End-to-end: login → upload → see CT

Week 3-4: Milestone 2 (Patient Management)
  → Patient/Study CRUD with auth
  → study_count in patient list query (no N+1)
  → Frontend patient list + search + detail page
  → End-to-end: patient workflow

Week 5-6: Milestone 3 (RT Structure + RT Dose)
  → dcmjs RT Structure parsing → Cornerstone3D SegmentationService import
  → RT Structure overlay on CT viewport
  → dcmjs RT Dose parsing + coordinate transform
  → RT Dose heatmap overlay
  → End-to-end: TEST849 case — contours and dose display

Week 7-8: Milestone 4 (Contouring + AI Interface)
  → Cornerstone3D BrushSegmentTool + EraserTool + FillTool
  → Undo/redo stack
  → AI HTTP interface (POST /api/contouring/auto) — real endpoint, 501 stub
  → End-to-end: brush edit + AI auto-contour button

Week 9: Synthetic fixtures + Integration tests + Polish
  → Programmatic DICOM fixtures (empty structure, edge cases)
  → Full E2E test suite (Playwright)
  → Logging verification
  → Bug fixes
```

**Human estimate:** ~9 weeks (architect + 2 developers)
**CC+gstack estimate:** ~1 week implementation + ~1 week testing
