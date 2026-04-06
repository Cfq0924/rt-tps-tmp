import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(__dirname, '../../../uploads');

// Ensure upload directory exists before multer writes to it
mkdirSync(UPLOAD_DIR, { recursive: true });

// UUID rename: never use original filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // UUID filename — prevents path traversal and filename collisions
    const ext = getExtension(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

// 500MB file size limit
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    // Accept all files — validation happens in validateDicom.js
    cb(null, true);
  }
});

function getExtension(filename) {
  const ext = filename.slice(filename.lastIndexOf('.'));
  return ext.toLowerCase() || '';
}

export function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large', detail: 'Maximum file size is 500MB' });
    }
    return res.status(400).json({ error: 'Upload error', detail: err.message });
  }
  next(err);
}

export default upload;
