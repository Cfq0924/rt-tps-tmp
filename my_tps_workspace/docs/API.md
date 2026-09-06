# API Reference

Base URL: `http://localhost:3001/api`

All endpoints except `/auth/login`, `/auth/register`, `/health` require authentication via HttpOnly JWT cookie.

---

## Health

### `GET /health`

Health check. No auth required.

**Response**
```json
{ "status": "ok", "timestamp": "2026-04-06T..." }
```

---

## Auth

### `POST /auth/register`

Create a new user account.

**Body**
```json
{ "email": "string", "password": "string", "name": "string" }
```

**Response** `201`
```json
{ "user": { "userId": 1, "email": "...", "name": "..." } }
```

---

### `POST /auth/login`

Authenticate and receive JWT in HttpOnly cookie.

**Body**
```json
{ "email": "string", "password": "string" }
```

**Response** `200`
```json
{ "user": { "userId": 1, "email": "...", "name": "..." } }
```

Sets `jwt` HttpOnly cookie (24h).

---

### `POST /auth/logout`

Clear JWT cookie.

**Response** `200`
```json
{ "ok": true }
```

---

### `GET /auth/me`

Get current authenticated user.

**Response** `200`
```json
{ "user": { "userId": 1, "email": "...", "name": "..." } }
```

---

## Patients

### `GET /patients`

List all patients with study/file counts.

**Response** `200`
```json
{
  "patients": [
    {
      "id": 1,
      "external_id": "App014",
      "name": "NPC RDS",
      "birth_date": null,
      "gender": null,
      "created_at": "2026-04-06 09:03:35",
      "study_count": 1,
      "file_count": 1
    }
  ]
}
```

---

### `GET /patients/:id`

Get patient with their studies.

**Response** `200`
```json
{
  "patient": {
    "id": 1,
    "external_id": "App014",
    "name": "NPC RDS",
    "studies": [
      { "id": 1, "study_instance_uid": "...", "file_count": 5, ... }
    ]
  }
}
```

---

### `POST /patients`

Create a new patient.

**Body**
```json
{ "externalId": "string", "name": "string", "birthDate": "YYYY-MM-DD", "gender": "M|F|O" }
```

**Response** `201`
```json
{ "patient": { "id": 1, "external_id": "...", "name": "..." } }
```

---

## Studies

### `GET /studies/:id`

Get study with all DICOM files.

**Response** `200`
```json
{
  "study": {
    "id": 1,
    "patient_id": 1,
    "study_instance_uid": "...",
    "patient_name": "NPC RDS",
    "files": [
      { "id": 1, "series_instance_uid": "...", "sop_instance_uid": "...", "modality": "CT", "file_size": 525894 }
    ]
  }
}
```

---

### `GET /studies/patient/:patientId`

List studies for a patient.

---

### `GET /studies/:id/files`

List all DICOM files in a study.

---

### `GET /studies/:id/rtstruct`

Get RTSTRUCT files for a study (used for contouring).

---

## Files

### `POST /files/upload`

Upload and parse a DICOM file. File is stored with UUID name, patient/study auto-created from DICOM metadata.

**Body**: `multipart/form-data` with `file` field

**Response** `201`
```json
{
  "fileId": 1,
  "updated": false,
  "studyId": 1,
  "patientId": 1,
  "metadata": {
    "sopClassUid": "1.2.840.10008.5.1.4.1.1.2",
    "sopInstanceUid": "...",
    "seriesInstanceUid": "...",
    "studyInstanceUid": "...",
    "modality": "CT",
    "patientName": "NPC RDS",
    "patientId": "App014",
    "fileName": "CT.1.3.12.2.1...",
    "fileSize": 525894
  }
}
```

**Errors**:
- `400` No file provided
- `413` File too large (>500MB)
- `422` Invalid DICOM file

---

### `GET /files/:studyId`

List all DICOM files for a study.

**Response** `200`
```json
{ "files": [...] }
```

---

### `GET /files/signed-url/:fileId`

Generate a HMAC-signed download URL (15 min expiry).

**Response** `200`
```json
{ "url": "/api/files/download/1?expires=...&sig=..." }
```

---

### `GET /files/download/:fileId?expires=&sig=`

Download DICOM file via HMAC-signed URL. No auth cookie required — signature is the auth mechanism.

| Query Param | Description |
|------------|-------------|
| `expires` | Unix timestamp expiry (15 min from generation) |
| `sig` | HMAC-SHA256 signature |

---

## Contouring

### `POST /contouring/auto`

Trigger AI auto-segmentation on an RTSTRUCT file.

**Body**
```json
{ "dicomFilePath": "/path/to/rtstruct.dcm", "organName": "Liver" }
```

**Response** `200`
```json
{ "result": { ... } }
```

**Errors**:
- `400` Missing required fields
- `504` AI endpoint timed out (>60s)

---

## RT Dose

### `GET /rtdose/:fileId`

Parse an RTDOSE file and return dose grid metadata. Requires auth (cookie).

**Response**:
```json
{
  "fileId": 90,
  "doseGridScalingPresent": true,
  "doseType": "PHYSICAL",
  "doseUnits": "GY",
  "doseSummationType": "PLAN",
  "rows": 94,
  "columns": 182,
  "numberOfFrames": 87,
  "imagePosition": { "x": -227.54, "y": -310.03, "z": -1060.3 },
  "imageOrientation": { "x": [1,0,0], "y": [0,1,0], "z": [0,0,1] },
  "pixelSpacing": { "i": 2.5, "j": 2.5 },
  "gridFrameOffsetVector": [0, 3, 6],
  "maxDose": 8084.84,
  "gridSize": { "rows": 94, "columns": 182, "frames": 87 }
}
```

Notes:
- `maxDose` is in **cGy** (pixel × DoseGridScaling, converted from DoseUnits).
- `pixelSpacing` is DICOM order: `i` = row spacing (y), `j` = column spacing (x).
- `gridFrameOffsetVector` holds the per-frame z offset (mm) relative to `imagePosition.z`.

**Errors**:
- `400` File is not an RTDOSE
- `404` File not found

### `GET /rtdose/:fileId/grid[?frame=k]`

Binary dose grid as **little-endian Float32, cGy** (`application/octet-stream`).
Values are already scaled (pixel × DoseGridScaling × unit factor) — clients must
not rescale. Layout is frame-major `[k][j][i]`, row-major within a frame
(x fastest). Without `frame`, returns all frames (~6MB for a typical grid);
with `frame=k`, a single frame (rows×columns×4 bytes).

**Response headers**:
- `X-Dose-Rows`, `X-Dose-Columns`, `X-Dose-Frames` — grid dimensions
- `X-Dose-Units: cGy`

**Errors**:
- `400` `frame` out of range or not an integer
- `404` File not found

---

## Error Responses

All errors follow this format:

```json
{ "error": "Error type", "detail": "Details (dev only)" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request / validation error |
| `401` | Authentication required |
| `403` | Signature invalid or expired |
| `404` | Resource not found |
| `409` | Conflict (duplicate) |
| `413` | File too large |
| `422` | Unprocessable entity (invalid DICOM) |
| `500` | Internal server error |
| `502` | AI contouring failed |
| `504` | AI contouring timeout |
