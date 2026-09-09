import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, '../../data/tps.db');
const DATA_DIR = join(__dirname, '../../data');

// Ensure data directory exists before the database is opened
mkdirSync(DATA_DIR, { recursive: true });

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(db) {
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  // CREATE TABLE IF NOT EXISTS won't touch pre-existing tables — add columns
  // introduced after initial release to older databases.
  addColumnIfMissing(db, 'segmentations', 'approved', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'ebrt_plans', 'reference_points', 'TEXT');
  addColumnIfMissing(db, 'ebrt_plans', 'is_template', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'ebrt_plans', 'source_plan_id', 'INTEGER REFERENCES ebrt_plans(id)');
  addColumnIfMissing(db, 'ebrt_beams', 'wedge_angle', 'REAL');
  addColumnIfMissing(db, 'ebrt_beams', 'bolus', 'TEXT');
  addColumnIfMissing(db, 'ebrt_beams', 'meterset', 'REAL');
  addColumnIfMissing(db, 'ebrt_beams', 'leaf_pair_count', 'INTEGER');
  addColumnIfMissing(db, 'ebrt_plans', 'course_id', 'INTEGER REFERENCES courses(id)');
  addColumnIfMissing(db, 'ebrt_plans', 'target_structure_name', 'TEXT');
  addColumnIfMissing(db, 'ebrt_plans', 'dose_per_fraction_gy', 'REAL');
  addColumnIfMissing(db, 'ebrt_plans', 'primary_point_name', 'TEXT');
  addColumnIfMissing(db, 'ebrt_plans', 'calc_models_json', 'TEXT');
  addColumnIfMissing(db, 'ebrt_plans', 'delta_couch_json', 'TEXT');
}

function addColumnIfMissing(db, table, column, definition) {
  const cols = db.pragma(`table_info(${table})`);
  if (!cols.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDb;
