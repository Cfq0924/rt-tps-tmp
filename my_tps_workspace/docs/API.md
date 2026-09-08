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

### `GET /auth/mode`

Report whether authentication is enforced. Auth enforcement is controlled by
the `AUTH_DISABLED` env var: `true` (default, development) → every request runs
as the dev user; `false` (production) → JWT cookie required, `401` otherwise.
The frontend uses this to decide between showing the login flow and going
straight to the patient list.

**Response** `200`
```json
{ "authDisabled": true }
```

---

## Patients

### `DELETE /patients/:id`

Delete a patient together with all of its studies, DICOM records
(segmentations/plans cascade at the DB level) and best-effort unlink of the
physical files. The UI asks for confirmation before calling this.

**Response** `200`
```json
{ "ok": true, "deletedFiles": 90 }
```

**Errors**: `404` Patient not found

---

### `DELETE /studies/:id`

Delete a single study and its files (best-effort physical unlink).

**Response** `200`
```json
{ "ok": true, "deletedFiles": 87 }
```

**Errors**: `404` Study not found

---

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

## RT PLAN

### `GET /rtplan/:fileId`

Parse an RTPLAN file and return plan metadata, prescription, fractionation
and per-beam geometry summaries. Requires auth (cookie).

**Response** (abridged):
```json
{
  "fileId": 88,
  "rtPlanLabel": "test 9f",
  "approvalStatus": "UNAPPROVED",
  "referencedStructureSetSOPInstanceUID": "1.2.246.352...",
  "prescription": {
    "doseReferenceNumber": 1,
    "structureType": "SITE",
    "description": "PGTVnx",
    "doseReferenceType": "TARGET",
    "targetPrescriptionDoseGy": 73.92
  },
  "fractionation": {
    "numberOfFractions": 33,
    "numberOfBeams": 9,
    "beamDosesGy": [0.249, "..."],
    "beamMetersetsMU": [449.7, "..."]
  },
  "beams": [
    {
      "beamNumber": 1,
      "beamName": "Field 1",
      "treatmentMachineName": "EclipseCAP_TB",
      "radiationType": "PHOTON",
      "beamType": "DYNAMIC",
      "nominalBeamEnergyMV": 6,
      "sourceAxisDistanceMm": 1000,
      "numberOfControlPoints": 166,
      "gantryAngleDeg": 0,
      "gantryArc": null,
      "beamLimitingDeviceAngleDeg": 0,
      "patientSupportAngleDeg": 0,
      "isocenterPosition": { "x": -13.79, "y": -223.78, "z": -886.16 },
      "jawPosition": { "x1": -111.125, "x2": 23.875, "y1": -152, "y2": 52 },
      "finalCumulativeMetersetWeight": 1
    }
  ]
}
```

Notes:
- Beam geometry (angles, jaws, isocenter) is taken from control point 0 —
  static-gantry fields carry all geometry there.
- `gantryArc` is non-null when the gantry moves between the first and last
  control point (arc/VMAT delivery).
- MLC leaf positions are not extracted in v1.

**Errors**:
- `400` File is not an RTPLAN
- `404` File not found

---

## Segmentations (painted segments)

User-painted contours from the contouring module.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/segmentations/study/:studyId` | List segments (with sliceCount) |
| `POST` | `/segmentations/study/:studyId` | Create segment (`{name, color}`) |
| `GET` | `/segmentations/:id` | Segment metadata |
| `PATCH` | `/segmentations/:id` | Rename / recolor / approve (`{name?, color?, approved?}`) |
| `DELETE` | `/segmentations/:id` | Delete segment (slices cascade) |
| `GET` | `/segmentations/:id/contours` | All contours (`slices[].contours` = flat patient-mm polys) |
| `PUT` | `/segmentations/:id/contours` | Replace all contours (`{slices: [{sopInstanceUID, instanceNumber?, contours}]}`) |

`approved` locks a segment: the UI disables editing/deleting and the paint
layer rejects strokes on it.

---

## EBRT Plans

User-created external-beam plans (or editable copies imported from RTPLAN).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/ebrt/study/:studyId/plans` | List plans (with beam counts) |
| `POST` | `/ebrt/study/:studyId/plans` | Create plan |
| `POST` | `/ebrt/study/:studyId/plans/from-rtplan/:fileId` | Import RTPLAN as editable copy |
| `GET` | `/ebrt/plans/:id` | Plan with full beams array |
| `PATCH` | `/ebrt/plans/:id` | Update plan fields (incl. approval_status) |
| `DELETE` | `/ebrt/plans/:id` | Delete plan (beams cascade) |
| `POST` | `/ebrt/plans/:id/beams` | Add beam (beam_number auto-increments) |
| `PATCH` | `/ebrt/beams/:beamId` | Update beam (response = whole plan) |
| `DELETE` | `/ebrt/beams/:beamId` | Delete beam (response = whole plan) |
| `GET` | `/ebrt/templates` | List reusable plan templates |
| `POST` | `/ebrt/plans/:id/save-as-template` | Copy plan+beams into a template (`{name?}`) |
| `POST` | `/ebrt/templates/:id/instantiate` | Create editable plan from template (`{studyId, name?}`) |

Plan-level extras: `reference_points` (PATCH/create) accepts an array of
`{name, x, y, z}` patient-mm points (max 20) and is returned parsed as
`referencePoints`; beams accept optional `wedge_angle` (0..360°) and `bolus`
(free text, e.g. "5mm gel"). Templates are excluded from study plan lists.

**Plan object** (GET/PATCH/POST responses):
```json
{
  "id": 2, "studyId": 1, "name": "test 9f",
  "machineName": "EclipseCAP_TB", "energyMv": 6,
  "prescriptionDoseGy": 73.92, "numberOfFractions": 33,
  "normalization": "ISOCENTER",
  "optimizationAlgorithm": "IMPORTED", "doseAlgorithm": "IMPORTED_RTDOSE",
  "gridSizeMm": 2, "heterogeneityCorrection": 0,
  "approvalStatus": "UNAPPROVED",
  "isocenterX": -13.79, "isocenterY": -223.78, "isocenterZ": -886.16,
  "sourceRtplanFileId": 88,
  "beams": [ { "beamNumber": 1, "name": "Field 1", "beamType": "DMLC",
               "gantryAngle": 0, "gantryAngleStop": null,
               "collimatorAngle": 0, "couchAngle": 0,
               "jawX1": -111.125, "jawX2": 23.875, "jawY1": -152, "jawY2": 52,
               "weight": 0.111 } ]
}
```

Notes:
- `beam_type`: `STATIC` | `DMLC` | `VMAT`; VMAT carries `gantry_angle_stop`.
- Angles within ±360°, jaws within ±400mm, max 32 beams per plan.
- List rows include `beamCount` but not the beams array — fetch the single
  plan to get beams.

**Errors**: `400` validation, `404` plan/beam not found.

---

## Export

DICOM RT export (M1). All endpoints return `application/dicom` attachment
downloads and write an audit log entry.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/export/study/:studyId/rtstruct` | Painted segmentations → RTSTRUCT (`?segmentationIds=1,2` optional filter) |
| `GET` | `/export/ebrt/plan/:planId/rtplan` | Workspace EBRT plan → minimal RTPLAN |
| `GET` | `/export/file/:fileId` | Byte-level passthrough of an imported file |

Notes:
- RTSTRUCT: one ROI per segmentation, InterpretedType inferred from naming
  (PTV/GTV/CTV prefix, BOLUS → EXTERNAL, else ORGAN); frame of reference and
  ContourImage references come from the study's CT series.
- RTPLAN minimal: geometry only (gantry/collimator/couch/jaws/wedge/bolus) —
  no MLC leaf positions or meterset exist in the workspace model; VMAT arcs
  exported as DYNAMIC beams with start/stop control points.

---

## Peer Review

RT peer review sessions on workspace plans (Eclipse Ch5). A session can be
opened on a REVIEWED plan; closing it with a decision updates the plan's
approval status. One OPEN session per plan; all actions are audited.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/peer-review/plans/:planId/sessions` | Open a review session (plan must be REVIEWED) |
| `GET` | `/peer-review/sessions?planId=&status=` | List sessions (with comment counts) |
| `GET` | `/peer-review/sessions/:id` | Session with comments |
| `POST` | `/peer-review/sessions/:id/comments` | Add comment (`{text, location?}`) |
| `POST` | `/peer-review/sessions/:id/close` | Close with `{decision: APPROVED\|UNAPPROVED}` |

`location` optionally pins a comment to `{sliceIdx, structureId, beamNumber}`
(integers, unknown keys rejected). Closed sessions are read-only.

---

## Registration

Rigid image registrations between series (Eclipse Ch7). The matrix is 4x4
row-major, mapping moving-series patient coordinates onto the fixed series.
The latest row per (fixed, moving) pair is the current registration.

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/registration/study/:studyId` | Save registration (`{fixedSeriesUid, movingSeriesUid, matrix, method?, notes?}`) |
| `GET` | `/registration/study/:studyId` | List registrations (newest first) |
| `GET` | `/registration/study/:studyId/latest?fixed=&moving=` | Latest for a pair (or `null`) |
| `GET` | `/registration/:id` | Fetch one |

`method` is `MANUAL` or `AUTO_CENTROID`.

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
