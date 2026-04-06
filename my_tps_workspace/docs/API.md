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
