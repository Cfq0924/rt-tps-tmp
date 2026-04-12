<!-- AUTO-GENERATED from .env.example and source code - DO NOT EDIT manually -->
# Environment Variables

Source: `my_tps_workspace/backend/.env.example`

<!-- AUTO-GENERATED START -->

## Backend Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Express server port |
| `NODE_ENV` | No | `development` | Environment mode (`development`, `production`) |
| `DB_PATH` | No | `./data/tps.db` | SQLite database file path |
| `UPLOAD_DIR` | No | `./uploads` | Directory for uploaded DICOM files |
| `JWT_SECRET` | Yes | - | Secret key for JWT token signing (change in production) |
| `HMAC_SECRET` | Yes | - | Secret key for HMAC-signed file download URLs |
| `FRONTEND_URL` | No | `http://localhost:5173` | CORS allowed origin |
| `LOG_LEVEL` | No | `info` | Logging level (`debug`, `info`, `warn`, `error`) |
| `AI_CONTOURING_ENDPOINT` | No | `http://localhost:8080/segment` | AI auto-contouring service endpoint (Phase 4) |

## Setup

1. Copy the example file:
   ```bash
   cp my_tps_workspace/backend/.env.example my_tps_workspace/backend/.env
   ```

2. Update required values in `.env`:
   - `JWT_SECRET` - generate a secure random string
   - `HMAC_SECRET` - generate a secure random string

## Production Considerations

- Set `NODE_ENV=production`
- Use strong, unique secrets for `JWT_SECRET` and `HMAC_SECRET`
- Configure `FRONTEND_URL` to your production frontend URL
- Consider using a managed database instead of SQLite for production

<!-- AUTO-GENERATED END -->
