-- my_tps SQLite Schema
-- Run this on database initialization

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  birth_date TEXT,
  gender TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS studies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  study_instance_uid TEXT UNIQUE NOT NULL,
  study_date TEXT,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dicom_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  series_instance_uid TEXT NOT NULL,
  sop_instance_uid TEXT UNIQUE NOT NULL,
  modality TEXT,
  instance_number INTEGER,
  file_path TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  -- Image positioning for coordinate transformation (DICOM tags 0020,0032 and 0028,0030)
  image_position_x REAL,
  image_position_y REAL,
  image_position_z REAL,
  pixel_spacing_x REAL,
  pixel_spacing_y REAL,
  rows INTEGER,
  columns INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
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

-- User-painted segments (contouring module). One row = one painted structure
-- (ROI); its per-slice contours live in segmentation_slices.
CREATE TABLE IF NOT EXISTS segmentations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- One row per painted slice: contours stored as JSON array of polygons,
-- each polygon a flat [x,y,z, ...] array in patient mm (RTSTRUCT-compatible).
CREATE TABLE IF NOT EXISTS segmentation_slices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  segmentation_id INTEGER NOT NULL REFERENCES segmentations(id) ON DELETE CASCADE,
  sop_instance_uid TEXT NOT NULL,
  instance_number INTEGER,
  points_json TEXT NOT NULL,
  UNIQUE(segmentation_id, sop_instance_uid)
);

CREATE INDEX IF NOT EXISTS idx_segmentations_study ON segmentations(study_id);
CREATE INDEX IF NOT EXISTS idx_segmentation_slices_seg ON segmentation_slices(segmentation_id);

-- External-beam planning: user-created plans (or editable copies imported
-- from an RTPLAN file). One row = one plan with a single isocenter.
CREATE TABLE IF NOT EXISTS ebrt_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  machine_name TEXT,
  energy_mv REAL,
  prescription_dose_gy REAL,
  number_of_fractions INTEGER,
  normalization TEXT,
  optimization_algorithm TEXT,
  dose_algorithm TEXT,
  grid_size_mm REAL,
  heterogeneity_correction INTEGER DEFAULT 0,
  approval_status TEXT DEFAULT 'UNAPPROVED',
  isocenter_x REAL,
  isocenter_y REAL,
  isocenter_z REAL,
  -- JSON array of {name, x, y, z} patient-mm reference points
  reference_points TEXT,
  -- Plan templates: is_template=1 rows are reusable prototypes; a plan
  -- instantiated from one records its origin in source_plan_id.
  is_template INTEGER NOT NULL DEFAULT 0,
  source_plan_id INTEGER REFERENCES ebrt_plans(id),
  source_rtplan_file_id INTEGER REFERENCES dicom_files(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Beams of an EBRT plan. VMAT fields carry gantry_angle_stop in addition to
-- the start angle; jaw coordinates are at the isocenter plane (mm).
CREATE TABLE IF NOT EXISTS ebrt_beams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES ebrt_plans(id) ON DELETE CASCADE,
  beam_number INTEGER NOT NULL,
  name TEXT,
  beam_type TEXT,
  energy_mv REAL,
  gantry_angle REAL,
  gantry_angle_stop REAL,
  collimator_angle REAL,
  couch_angle REAL,
  jaw_x1 REAL,
  jaw_x2 REAL,
  jaw_y1 REAL,
  jaw_y2 REAL,
  weight REAL DEFAULT 1,
  wedge_angle REAL,
  bolus TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, beam_number)
);

CREATE INDEX IF NOT EXISTS idx_ebrt_plans_study ON ebrt_plans(study_id);
CREATE INDEX IF NOT EXISTS idx_ebrt_beams_plan ON ebrt_beams(plan_id);

CREATE INDEX IF NOT EXISTS idx_dicom_files_study ON dicom_files(study_id);
CREATE INDEX IF NOT EXISTS idx_dicom_files_series ON dicom_files(series_instance_uid);
CREATE INDEX IF NOT EXISTS idx_dicom_files_sop ON dicom_files(sop_instance_uid);
CREATE INDEX IF NOT EXISTS idx_studies_patient ON studies(patient_id);
CREATE INDEX IF NOT EXISTS idx_studies_uid ON studies(study_instance_uid);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
