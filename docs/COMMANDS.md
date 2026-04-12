<!-- AUTO-GENERATED from package.json - DO NOT EDIT manually -->
# Commands Reference

Source: `my_tps_workspace/package.json`

<!-- AUTO-GENERATED START -->
| Command | Description |
|---------|-------------|
| `npm run dev` | Start both backend and frontend concurrently |
| `npm run dev:backend` | Backend only: node --watch src/index.js (port 3001) |
| `npm run dev:frontend` | Frontend only: vite dev server (port 5173) |
| `npm run build` | Build both frontend and backend |
| `npm run test` | Run backend and frontend tests |
| `npm run test:e2e` | Run Playwright E2E tests (frontend) |

<!-- AUTO-GENERATED END -->

## Direct Commands

```bash
# Backend (from backend directory)
cd my_tps_workspace/backend
node src/index.js           # Start server
node --watch src/index.js   # Start with hot reload
node --test                 # Run tests

# Frontend (from frontend directory)
cd my_tps_workspace/frontend
npx vite                    # Start dev server
npx vite build              # Production build
```
