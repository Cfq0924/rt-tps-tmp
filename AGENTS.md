# AGENTS.md

Guidance for AI coding agents in this repository.

## Layout

No `package.json` at the repo root. All app code and npm workspaces live under `my_tps_workspace/` — run every npm command from there.

| Path | Role |
|------|------|
| `my_tps_workspace/backend/` | Express API, ESM (`"type": "module"`), entry `src/index.js` |
| `my_tps_workspace/frontend/` | React 18 + Vite + MUI 5 + Cornerstone3D 4.22.x + Zustand |
| `my_tps_workspace/docs/` | API.md, CONTRIBUTING.md (structure is partly stale — trust the code) |
| `docs/` | Phase plans (`PLAN-PHASE*.md`), auto-generated COMMANDS.md / ENVIRONMENT.md |
| `DESIGN.md` | Design system — read before any UI change |
| `WISSEN.md` | **Gitignored local knowledge base** — read if present; append non-trivial viewer/DICOM solutions. Often absent on a fresh clone. |
| `test_module/`, `src-doc/`, `test_data/` | **Gitignored** local references / DICOM fixtures — may be missing; never commit or depend on them |
| `backend/scripts/` | **Gitignored** one-off DB/debug scripts — look here before writing new tooling |

No ESLint/Prettier/CI config for the workspace. Match surrounding style.

## Commands

```bash
cd my_tps_workspace
npm install
npm run dev          # backend :3001 + frontend :5173 (Vite proxies /api → 3001)
npm run test         # backend node --test, then frontend vitest
```

Focused:

```bash
cd my_tps_workspace/backend && node --test
cd my_tps_workspace/backend && node --test tests/doseEngineService.test.js
cd my_tps_workspace/frontend && npx vitest run          # one-shot ("npm test" alone starts watch mode)
cd my_tps_workspace/frontend && npx vitest run src/lib/dvh.test.js
```

- `npm run test:e2e` (root script) is **broken** — frontend has no `test:e2e` script and no Playwright config. Ignore README/CONTRIBUTING mentions of E2E.
- `npm run build` builds the frontend; backend build is a no-op echo.
- Frontend Vite config **must** keep `optimizeDeps.exclude: ['@cornerstonejs/dicom-image-loader']` and `viteCommonjs` for `dicom-parser`.

## Environment

Backend reads `process.env` directly with safe local defaults — **there is no dotenv / `--env-file`**. Copying `.env.example` → `.env` does nothing unless you export those vars in the shell or change the start script.

Useful overrides (see `backend/.env.example`):

- `AUTH_DISABLED` — **default `true`**: every request is a mock user `{ userId: 1 }`. Set `false` to enforce JWT cookie auth. Frontend polls `/api/auth/mode`.
- `SIGNED_URL_EXPIRY_SECONDS` — default 900; raise for long viewer sessions (every CT slice goes through one signed URL).
- `CORS_ORIGINS` / `FRONTEND_URL` — CORS; backend already allows localhost:5173–5179 for Vite port bumps.
- `DB_PATH` (default `backend/data/tps.db`), `UPLOAD_DIR`, `HMAC_SECRET`, `JWT_SECRET`.

Schema: `CREATE TABLE IF NOT EXISTS` plus `addColumnIfMissing` in `backend/src/db/init.js` — add new columns there, do not expect destructive migrations.

## Architecture (non-obvious)

- **Request path:** rate-limit/CORS → `requestIdMiddleware` → routes. ` /api/files/public` (HMAC) is mounted **before** auth-protected `/api/files` and must stay that way (`backend/src/index.js`).
- **Routes → services → SQLite** (`better-sqlite3`, synchronous). New APIs: thin route file + service + mount in `index.js`.
- **Viewer modules** (`StudyViewerPage` tabs): IMAGES / CONTOURING / REGISTRATION / EBRT PLAN / EVALUATION. Feature code lives in `frontend/src/modules/{contouring,registration,ebrt,evaluation,mpr,doseSum}/`, not only `components/`.
- **CT display uses StackViewport on purpose.** VolumeViewport (ORTHOGRAPHIC) migration is on hold: volume texture stays black on hardware GL while software GL works. Comment in `ViewerViewport.jsx` references WISSEN §9 — do not “fix” by casually switching viewport type.
- **RTSTRUCT overlay is `RTStructSVGOverlay`**, not Cornerstone contour-segmentation. The cornerstone path is intentionally disabled (`viewportForSeg = null`) — fragile across StrictMode remounts and upgrades. Contours are patient-space mm → image pixels → canvas via viewport camera.
- **StrictMode:** guard stack loads by imageId (`loadedStackForRef` in `ViewerViewport.jsx`) or every DICOM downloads twice.
- **Init order** (`initCornerstone.js`): `dicomImageLoader.init()` → `cornerstone.init()` → `wadouri.register()` → tools. Do not register wadouri twice.
- Image IDs: `wadouri:{origin}/api/files/public/download/{fileId}?expires&sig`.

## DICOM / dose facts

- Contours: patient coordinates (mm). RT Dose → patient → CT via matrix inversion; dose value = PixelData × Dose Grid Scaling `(3004,000e)`.
- Key tags: RTSTRUCT ROI/contour `(3006,0020/0026/0050/002a)`, RTDOSE `(7fe0,0010, 3004,000e)`.
- Never call whole-volume `voxelManager.getMinMax()` (or similar) on a streaming volume — can flood console and kill the tab.

## UI

Read `DESIGN.md` first: IBM Plex Sans + Mono, dark navy `#07111f`, teal `#58c4dc`, amber dose `#f6c177`, MUI, minimal-functional motion only (no decorative animation).
