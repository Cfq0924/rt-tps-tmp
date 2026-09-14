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
  interpreted_type TEXT,
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

-- Treatment courses (Eclipse): a course groups one or more plans.
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  intent TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  start_date TEXT,
  completed_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courses_study ON courses(study_id);

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
  course_id INTEGER REFERENCES courses(id),
  target_structure_name TEXT,
  mlc_model TEXT,
  optimization_settings_json TEXT,
  dose_per_fraction_gy REAL,
  primary_point_name TEXT,
  calc_models_json TEXT,
  delta_couch_json TEXT,
  optimization_objectives_json TEXT,
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
  purpose TEXT DEFAULT 'TREATMENT',
  use_in_opt INTEGER NOT NULL DEFAULT 1,
  x_smooth REAL DEFAULT 40,
  y_smooth REAL DEFAULT 30,
  fixed_jaw INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, beam_number)
);

CREATE INDEX IF NOT EXISTS idx_ebrt_plans_study ON ebrt_plans(study_id);
CREATE INDEX IF NOT EXISTS idx_ebrt_beams_plan ON ebrt_beams(plan_id);

-- Beam control points (Eclipse: per-CP gantry/collimator/couch/meterset and
-- MLC leaf positions). MLC json: [{leafPair, x1, x2}] per leaf pair.
CREATE TABLE IF NOT EXISTS beam_control_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  beam_id INTEGER NOT NULL REFERENCES ebrt_beams(id) ON DELETE CASCADE,
  cp_index INTEGER NOT NULL,
  gantry_angle REAL,
  collimator_angle REAL,
  couch_angle REAL,
  cumulative_meterset_weight REAL,
  mlc_json TEXT,
  UNIQUE(beam_id, cp_index)
);

-- Field-in-Field subfields: shaped segments of a parent beam.
CREATE TABLE IF NOT EXISTS beam_subfields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  beam_id INTEGER NOT NULL REFERENCES ebrt_beams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight REAL DEFAULT 1,
  mlc_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Plan revisions (Eclipse Revisions): full snapshots of a plan (scalars +
-- beams + reference points) captured at approval time or manually.
CREATE TABLE IF NOT EXISTS plan_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES ebrt_plans(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(plan_id, revision_no)
);

CREATE INDEX IF NOT EXISTS idx_plan_revisions_plan ON plan_revisions(plan_id);

-- RT Peer Review (Eclipse Ch5): a review session collects reviewer comments
-- on a workspace plan; closing it records the decision (which also updates
-- the plan's approval status). One OPEN session per plan, enforced in service.
CREATE TABLE IF NOT EXISTS peer_review_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES ebrt_plans(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'OPEN',
  decision TEXT,
  opened_by INTEGER,
  opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
  closed_by INTEGER,
  closed_at TEXT
);

-- Reviewer comments with an optional location pin (slice / structure / beam).
CREATE TABLE IF NOT EXISTS review_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES peer_review_sessions(id) ON DELETE CASCADE,
  author_user_id INTEGER,
  author_name TEXT,
  comment_text TEXT NOT NULL,
  location_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_review_sessions_plan ON peer_review_sessions(plan_id);
CREATE INDEX IF NOT EXISTS idx_review_comments_session ON review_comments(session_id);

-- Image registration (Eclipse Ch7): rigid transforms mapping a moving
-- series onto a fixed series in patient space (4x4 row-major, JSON).
-- The latest row per (fixed, moving) pair is the current registration.
CREATE TABLE IF NOT EXISTS series_registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  fixed_series_uid TEXT NOT NULL,
  moving_series_uid TEXT NOT NULL,
  matrix_json TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'MANUAL',
  notes TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_series_registrations_study ON series_registrations(study_id);

-- Derived series (Phase 4 M1): provenance of volumes generated in-browser
-- from a registration (e.g. a rigidly resampled moving series). v1 stores
-- metadata only — pixel-level DICOM files are written in a later step.
CREATE TABLE IF NOT EXISTS derived_series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  registration_id INTEGER REFERENCES series_registrations(id),
  kind TEXT NOT NULL DEFAULT 'REGISTERED_SERIES',
  fixed_series_uid TEXT,
  moving_series_uid TEXT,
  series_uid TEXT NOT NULL,
  description TEXT,
  geometry_json TEXT,
  matrix_json TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_derived_series_study ON derived_series(study_id);

-- PACS destinations (Phase 4 M5): C-STORE targets for the "send to PACS" flow
CREATE TABLE IF NOT EXISTS pacs_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  aet TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Plan sums (Eclipse Ch4.16): a derived RTDOSE file produced by voxel-wise
-- addition of two or more same-geometry dose grids. input_file_ids_json is a
-- JSON array of the source dicom_files ids.
CREATE TABLE IF NOT EXISTS dose_sums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  output_file_id INTEGER REFERENCES dicom_files(id),
  input_file_ids_json TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dose_sums_study ON dose_sums(study_id);

CREATE INDEX IF NOT EXISTS idx_dicom_files_study ON dicom_files(study_id);
CREATE INDEX IF NOT EXISTS idx_dicom_files_series ON dicom_files(series_instance_uid);
CREATE INDEX IF NOT EXISTS idx_dicom_files_sop ON dicom_files(sop_instance_uid);
CREATE INDEX IF NOT EXISTS idx_studies_patient ON studies(patient_id);
CREATE INDEX IF NOT EXISTS idx_studies_uid ON studies(study_instance_uid);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
