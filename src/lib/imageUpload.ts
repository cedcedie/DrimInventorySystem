/** Shared by every image-upload route (product photos, avatars). Both
 * previously validated only the client-supplied `file.type` string, which is
 * whatever the browser's multipart encoder wrote — trivially spoofable by
 * renaming any file and re-labeling its part. Checking the actual leading
 * bytes (a "magic number") closes that gap without a new dependency: JPEG,
 * PNG, and WebP each have a short, fixed signature. */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const SIGNATURES: Record<(typeof ALLOWED_IMAGE_TYPES)[number], (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) =>
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a,
  // WebP: "RIFF" .... "WEBP" — the size field in bytes 4-7 varies, so it's skipped.
  "image/webp": (b) =>
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

export interface ImageValidationError {
  error: string;
}

/** Validates an uploaded image's declared type, actual byte signature, and
 * size. Returns an error object to return as-is, or null if the file passes. */
export function validateImageUpload(file: File, buffer: Buffer): ImageValidationError | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Only JPEG, PNG, or WebP images are allowed" };
  }
  const check = SIGNATURES[file.type as (typeof ALLOWED_IMAGE_TYPES)[number]];
  if (!check(buffer)) {
    return { error: "File content doesn't match its declared image type" };
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { error: "Image must be under 5MB" };
  }
  return null;
}
