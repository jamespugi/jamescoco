import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultUploadsRoot = path.resolve(__dirname, '../../../frontend/public/uploads');

export const uploadsRoot = path.resolve(process.env.UPLOADS_DIR || defaultUploadsRoot);

export function getUploadDirectory(name) {
  return path.join(uploadsRoot, name);
}
