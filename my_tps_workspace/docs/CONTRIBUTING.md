# Contributing Guide

## Development Setup

### Prerequisites
- Node.js 18+
- npm 9+

### Install Dependencies

```bash
cd my_tps_workspace
npm install
```

### Start Development Servers

```bash
npm run dev          # Start both backend (:3001) and frontend (:5173)
npm run dev:backend   # Backend only, port 3001
npm run dev:frontend  # Frontend only (auto-detects port)
```

### Build

```bash
npm run build         # Production build: frontend + backend
```

### Test

```bash
npm test             # Run backend unit tests
npm run test:e2e     # Run frontend E2E tests
```

## Project Structure

```
my_tps_workspace/
├── backend/              # Express API server (ES modules)
│   ├── src/
│   │   ├── index.js          # App entry point
│   │   ├── db/
│   │   │   ├── init.js      # SQLite connection + schema init
│   │   │   └── schema.sql   # Database schema
│   │   ├── logging/
│   │   │   └── index.js     # Winston logger + auditLog helper
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT authentication
│   │   │   ├── upload.js        # Multer disk storage (UUID rename)
│   │   │   ├── validateDicom.js # dcmjs DICOM parsing
│   │   │   └── errorHandler.js  # Global error handlers
│   │   ├── routes/
│   │   │   ├── auth.js          # /api/auth/*
│   │   │   ├── files.js         # /api/files/* (protected)
│   │   │   ├── filesPublic.js   # /api/files/download/* (HMAC-signed)
│   │   │   ├── patients.js      # /api/patients/*
│   │   │   ├── studies.js       # /api/studies/*
│   │   │   └── contouring.js    # /api/contouring/*
│   │   └── services/
│   │       ├── authService.js
│   │       ├── patientService.js
│   │       ├── studyService.js
│   │       ├── dicomService.js
│   │       └── contouringService.js
│   ├── uploads/            # DICOM files (UUID-named, never original names)
│   ├── data/              # SQLite database (gitignored)
│   └── tests/
├── frontend/              # React 18 + Vite + MUI
│   ├── src/
│   │   ├── App.jsx           # Router + protected routes
│   │   ├── main.jsx          # React root
│   │   ├── theme.js          # MUI dark clinical theme (DESIGN.md)
│   │   ├── initCornerstone.js # Cornerstone3D init (Phase 2 full impl)
│   │   ├── components/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── Toolbar.jsx
│   │   │   └── ViewerViewport.jsx
│   │   └── pages/
│   │       ├── PatientListPage.jsx
│   │       └── StudyViewerPage.jsx
│   └── dist/               # Production build output
└── docs/                  # This directory
```

## Database

SQLite with WAL mode and foreign keys enabled. Database file at `backend/data/tps.db` (auto-created on first boot).

```bash
# Reset database (delete and restart)
rm backend/data/tps.db
npm run dev:backend
```

## Key Patterns

### Auth
- JWT in HttpOnly cookie (`jwt`), 24h expiry
- Public paths: `/api/auth/login`, `/api/auth/register`, `/api/health`

### DICOM Upload Flow
1. `POST /api/files/upload` — multer saves file with UUID name
2. `validateDicom` middleware — dcmjs parses metadata from disk
3. `files.js` route — findOrCreatePatient, findOrCreateStudy, registerDicomFile
4. File stored at `uploads/{uuid}.dcm`

### HMAC Download URLs
```
GET /api/files/download/:fileId?expires={ts}&sig={hmac}
```
- 15-minute expiry
- Constant-time signature comparison
- No auth required (signature is the auth mechanism)

## Code Style

- ES modules (`"type": "module"` in package.json)
- No semicolons
- Use `async/await` over raw Promises
- All errors thrown with `status` property for errorHandler mapping
