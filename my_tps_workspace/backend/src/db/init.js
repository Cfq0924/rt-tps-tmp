import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fileURLToPath as fileURLToPathDir } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, '../../data/tps.db');

let db;

export function getDb() {
  if (!db) {
    // Ensure data directory exists
    import('fs').then(({ mkdirSync }) => {
      mkdirSync(join(__dirname, '../../data'), { recursive: true });
    });

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
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDb;
