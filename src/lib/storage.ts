import path from "path";
import fs from "fs/promises";

// Where uploaded audio + poster files are stored on disk. Defaults to ./data/uploads.
// Override with UPLOAD_DIR (useful for pointing at a mounted volume on a VPS).
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "data", "uploads");

/** Absolute path for a stored file. `basename` guards against path traversal. */
export function uploadPath(file: string): string {
  return path.join(UPLOAD_DIR, path.basename(file));
}

/** Ensure the upload directory exists before writing. */
export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/** Extract a safe lowercase file extension (with dot) from an original name. */
export function safeExt(name: string): string {
  const i = name.lastIndexOf(".");
  const ext = i >= 0 ? name.slice(i) : "";
  return /^\.[a-zA-Z0-9]{1,5}$/.test(ext) ? ext.toLowerCase() : "";
}
