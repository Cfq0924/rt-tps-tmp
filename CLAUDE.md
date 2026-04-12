# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Development of a **Treatment Planning System (TPS)** for radiation therapy using B/S (Browser/Server) architecture.

**Phase 1 Goals:**
1. DICOM import/export - Load and export DICOM files
2. Patient list management - Create, browse patients and associate with DICOM data
3. DICOM visualization - Display CT, MRI and radiation therapy data (RT Dose, RT Structure)
4. Contouring interface - Display RT Structure, support AI auto-contouring and manual tools (brush, eraser, paint)

## Directory Structure

```
my_tps_workspace/       # Main project code
├── backend/             # Express.js API server (Node.js)
│   ├── src/
│   │   ├── index.js           # Express app entry point
│   │   ├── routes/            # API route handlers (auth, patients, studies, files, contouring)
│   │   ├── services/           # Business logic (patientService, dicomService, contouringService)
│   │   ├── middleware/        # Auth, upload, validation, error handling
│   │   ├── db/                 # SQLite initialization
│   │   └── logging/            # Winston logger setup
│   ├── uploads/                # Uploaded DICOM files
│   └── data/                   # SQLite database
├── frontend/             # React + Vite SPA
│   ├── src/
│   │   ├── App.jsx             # Root component with routing
│   │   ├── initCornerstone.js  # Cornerstone3D initialization
│   │   ├── theme.js            # MUI theme (dark clinical palette)
│   │   ├── components/         # Shared components (LoginPage, Toolbar, ViewerViewport)
│   │   └── pages/              # Route pages (PatientListPage, StudyViewerPage)
│   └── index.html
src-doc/                # Reference documentation
├── orthanc-docs/        # Orthanc DICOM server docs
test_module/            # Reference implementations (do NOT modify)
├── RT-VIEWER-main/     # React + Cornerstone lightweight RT viewer
└── Viewers-master/     # OHIF medical image viewer (enterprise reference)
```

## Architecture

### Tech Stack
- **Frontend:** React 18, Vite, React Router, Zustand (state), MUI 5, Cornerstone3D 4.x
- **Backend:** Express.js, better-sqlite3, dcmjs, JWT auth, HMAC signatures
- **DICOM:** dcmjs for parsing/building, dicom-parser for tag extraction

### Backend Architecture
```
Request → Rate Limiter → CORS → Auth Middleware → Routes → Services → Database
```
- **Auth:** JWT tokens with bcrypt password hashing; HMAC signatures for public file downloads
- **Routes:** Modular - auth, patients, studies, files, contouring
- **Services:** Business logic separated from routes (patientService, dicomService, contouringService)
- **Database:** SQLite with better-sqlite3; foreign key relationships between patients, studies, series, instances

### Frontend Architecture
- **State:** Zustand stores (no Redux); components subscribe directly
- **Routing:** React Router v6; protected routes with auth check
- **Cornerstone:** Initialized in initCornerstone.js; tools registered (Pan, Zoom, WindowLevel, StackScroll, Length, Angle, Probe)
- **DICOM Parsing:** dcmjs for building DICOM objects; dicom-parser for raw tag extraction

### Key Reference Files

**RT-VIEWER-main** (lightweight, single-purpose):
- `src/features/viewer/` - Main viewer with CT + RT Structure/Dose overlay
- `src/features/structure/` - RT Structure parsing (ROI/Contour extraction)
- `src/features/dose/` - RT Dose coordinate transformation and rendering

**OHIF Viewers** (comprehensive, enterprise-grade):
- `platform/core/` - Business logic, services, DICOM metadata store
- `extensions/cornerstone/` - 2D/3D rendering, tool groups, segmentation
- `extensions/cornerstone-dicom-rt/` - RTSTRUCT rendering
- `modes/` - Workflow configurations

### DICOM Coordinate System

RT Dose to CT coordinate transformation:
```
Dose → Patient (Dose→Patient matrix) → CT (invert CT→Patient matrix)
```
Dose value: `Pixel Data × Dose Grid Scaling (3004,000e)`

## Commands

```bash
# Root workspace (monorepo with workspaces)
npm run dev          # Start both backend and frontend concurrently
npm run dev:backend  # Backend only: node --watch src/index.js (port 3001)
npm run dev:frontend # Frontend only: vite (port 5173)
npm run build        # Build both frontend and backend
npm run test         # Run backend tests (node --test)

# Frontend tests
npm run test:e2e      # E2E tests (Playwright)

# Direct backend test
cd backend && node --test
```

### Environment Variables
See `.env.example` for required configuration:
- `PORT` (default 3001), `JWT_SECRET`, `HMAC_SECRET`
- `DB_PATH`, `UPLOAD_DIR`
- `AI_CONTOURING_ENDPOINT` (Milestone 4)

## Common DICOM Tags

| Data Type | Key Tags |
|-----------|----------|
| RT Structure | 3006,0020 (Structure Set ROI), 3006,0026 (ROI Name), 3006,0050 (Contour Data), 3006,002a (Display Color) |
| RT Dose | 7fe0,0010 (Pixel Data), 3004,000e (Dose Grid Scaling) |
| CT Image | 0008,0060 (Modality), 0028,0010 (Rows), 0028,0011 (Columns) |

## Design System

Always read DESIGN.md before making visual or UI decisions.

Key decisions:
- **Font:** IBM Plex Sans (UI/body) + IBM Plex Mono (data/measurements)
- **Color:** Dark navy base (#07111f), teal primary (#58c4dc), amber dose accent (#f6c177)
- **Component library:** MUI (Material UI)
- **Motion:** Minimal-functional — only state transitions, no decorative animations

## Knowledge Base

**IMPORTANT:** Before working on complex features, check `my_tps_workspace/WISSEN.md` for documented solutions to difficult problems. This file contains accumulated knowledge about:

- RT Structure/Dose rendering with cornerstone3D
- Cornerstone3D initialization and metadata management
- DICOM coordinate system and image loading patterns
- Common errors and their root causes

When you solve a non-trivial problem, document it in WISSEN.md for future reference.
