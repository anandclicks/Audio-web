// Media files (audio + posters) are stored in Vercel Blob, not on the local disk,
// because Vercel's runtime filesystem is read-only. The DB stores each file's public
// Blob URL. See src/app/api/admin/blob-upload/route.ts for the upload token flow.

/** Extract a safe lowercase file extension (with dot) from an original name. */
export function safeExt(name: string): string {
  const i = name.lastIndexOf(".");
  const ext = i >= 0 ? name.slice(i) : "";
  return /^\.[a-zA-Z0-9]{1,5}$/.test(ext) ? ext.toLowerCase() : "";
}
