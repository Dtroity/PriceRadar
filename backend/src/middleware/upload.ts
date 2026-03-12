import multer from 'multer';
import path from 'path';
import { mkdir } from 'fs/promises';
import { config } from '../config.js';
import { v4 as uuidv4 } from 'uuid';

export async function ensureUploadDir() {
  await mkdir(config.upload.dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.upload.dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/heic',
    ];
    const ok = allowed.includes(file.mimetype) || file.mimetype.startsWith('image/');
    if (ok) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
}).single('file');
