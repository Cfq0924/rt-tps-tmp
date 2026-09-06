# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Web-based **Treatment Planning System (TPS)** for radiation therapy (Phase 1): DICOM import, patient management, CT / RT Structure / RT Dose visualization, and contouring. All application code lives in `my_tps_workspace/` — an npm-workspaces monorepo with `backend/` and `frontend/`. There is no package.json at the repo root; run npm commands from `my_tps_workspace/`.

- `my_tps_workspace/backend/` — Express.js API in ESM (Node >= 20): better-sqlite3, dcmjs, JWT auth, HMAC-signed file URLs. Layers: `src/routes/` (thin handlers) → `src/services/` (business logic) → `src/db/` (SQLite). Entry: `src/index.js`.
- `my_tps_workspace/frontend/` — React 18 + Vite SPA: Zustand for state (no Redux), MUI 5, Cornerstone3D 4.x (`@cornerstonejs/core|tools|dicom-image-loader`) for imaging.
- `test_module/` (RT-VIEWER-main, OHIF Viewers-master, cornerstone3D-main) and `src-doc/` (Orthanc docs) are **read-only reference material — never modify or build them**.

## Commands

```bash
cd my_tps_workspace
npm run dev           # backend (port 3001) + frontend (port 5173) concurrently
npm run test          # backend: node --test;  frontend: vitest
cd frontend && npx vitest run   # frontend tests in one-shot mode ("test" alone starts watch mode)
cd backend && node --test       # backend tests only
```

- `npm run test:e2e` is referenced in README/CLAUDE.md but **does not work** — the frontend has no `test:e2e` script and no Playwright config. Don't rely on it.
- `npm run build` builds the frontend only; the backend is no-build ESM.
- Backend env: copy `backend/.env.example` → `backend/.env` (PORT, DB_PATH, UPLOAD_DIR, JWT_SECRET, HMAC_SECRET, FRONTEND_URL, LOG_LEVEL, AI_CONTOURING_ENDPOINT).
- No ESLint/Prettier is configured for `my_tps_workspace/` — lint configs found elsewhere belong to the reference repos in `test_module/`. Match the existing code style.

## Must-read docs before specific work

- `my_tps_workspace/WISSEN.md` — accumulated troubleshooting knowledge (in Chinese) for Cornerstone3D/DICOM issues. **Read before touching viewer/rendering code; append solutions to non-trivial problems there when you solve one.**
- `DESIGN.md` (repo root) — design system; **read before any visual/UI change**: IBM Plex Sans (UI) + IBM Plex Mono (data), dark navy `#07111f` base, teal `#58c4dc` primary, amber `#f6c177` dose accent, MUI, minimal-functional motion only.
- `my_tps_workspace/SPEC.md`, `my_tps_workspace/docs/API.md`, `my_tps_workspace/docs/CONTRIBUTING.md`, `docs/COMMANDS.md`, `docs/ENVIRONMENT.md`.

## Cornerstone3D / DICOM gotchas

- Packages pinned to **4.22.13** (upgraded from 4.20.4 during the volume-viewport debugging).
- CT display uses **StackViewport** on purpose: the VolumeViewport (ORTHOGRAPHIC) migration is on hold because the volume texture never receives data on real (hardware) GL — viewport stays black while the identical code renders under software GL. Full diagnosis and resume checklist in WISSEN.md §9. Read it before retrying the volume path.
- **Never call `volume.voxelManager.getMinMax()` (or any whole-volume iteration) on a streaming volume** — with the image-cache-backed voxel manager it can emit tens of millions of console.warn calls and crash the renderer tab (this took the whole app down once). See WISSEN.md §9.
- React StrictMode double-invokes effects in dev — guard cornerstone loading effects by imageId (see `ViewerViewport.jsx` `loadedStackForRef`) or you get every DICOM file downloaded twice and racy double init.
- Init order in `frontend/src/initCornerstone.js`: `dicomImageLoader.init()` → `cornerstone.init()` → `wadouri.register()` → tools. Don't manually register the wadouri image loader twice.
- **RT contour rendering requires cached datasets** for metadata queries; but do NOT block contour attachment on a bulk preload — the image load pool can stall. Attach immediately, preload in the background. See `useRTContourSegmentation.js` and WISSEN.md §1/§9.
- Image IDs are signed URLs wrapped in the wadouri scheme: `wadouri:{origin}/api/files/public/download/{fileId}?...`. RT contour geometry IDs follow `rtstruct-geometry-roi-{roiNumber}`.
- Contour visibility toggles are per-segment via `cornerstoneTools.segmentation.config.visibility.setSegmentIndexVisibility(viewportId, …, segmentIndex, visible)`, and the hook's toggle function reaches `StudyViewerPage` through a **ref callback** (`onSegmentVisibilityRef`), not props — React state setters can't be passed down directly. See WISSEN.md §8.
- Coordinates: contour data is in patient space (mm); RT Dose → patient → CT via matrix inversion; dose value = PixelData × Dose Grid Scaling (3004,000e).
- Repeat `addSegmentations` calls throw "Segmentation already exists" — guard with `getSegmentation` / `isInitializedRef`.
- One-off DB/debug scripts live in `backend/scripts/` (gitignored) — check there before writing new DB tooling.
- Signed download URLs default to 900 s; raise `SIGNED_URL_EXPIRY_SECONDS` in development or slices fail to load in long sessions.
