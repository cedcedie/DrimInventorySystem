import { prisma } from "@/lib/prisma";
import { uploadToR2, deleteFromR2, getSignedR2Url } from "@/lib/r2";

/** Callers never learn whether bytes live in Postgres or R2 — swapping adapters is
 * a config change, not a code change. */
export interface BlobStore {
  put(bytes: Buffer, contentType: string, extension: string, prefix?: string): Promise<string>;
  url(ref: string): Promise<string>;
  /** Best-effort — callers should call this *after* a replacement upload/reference
   * change has already committed successfully, and treat a failure here as
   * non-fatal (log and move on, don't fail the request over a cleanup step). */
  delete(ref: string): Promise<void>;
}

const R2_VARS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

function r2IsConfigured(): boolean {
  return R2_VARS.every((v) => !!process.env[v]);
}

/** Bytes in Postgres, served through /api/blobs/[key]; Neon's free tier is 0.5GB total,
 * so this is the first thing to move off if the catalog grows. */
const postgresBlobStore: BlobStore = {
  async put(bytes, contentType, extension, prefix = "products") {
    const key = `${prefix}/${crypto.randomUUID()}.${extension}`;
    await prisma.storedBlob.create({
      // Buffer is a Uint8Array, but TS wants the narrower form spelled out.
      data: { key, contentType, size: bytes.length, bytes: new Uint8Array(bytes) },
    });
    return key;
  },
  async url(ref) {
    return `/api/blobs/${ref}`;
  },
  async delete(ref) {
    await prisma.storedBlob.deleteMany({ where: { key: ref } });
  },
};

/** Activates automatically once the R2_* vars are set — no code change required. */
const r2BlobStore: BlobStore = {
  async put(bytes, contentType, extension, prefix = "products") {
    const key = `${prefix}/${crypto.randomUUID()}.${extension}`;
    await uploadToR2(key, bytes, contentType);
    return key;
  },
  async url(ref) {
    const base = process.env.R2_PUBLIC_URL;
    if (base) return `${base.replace(/\/$/, "")}/${ref}`;
    return getSignedR2Url(ref);
  },
  async delete(ref) {
    await deleteFromR2(ref);
  },
};

export function getBlobStore(): BlobStore {
  return r2IsConfigured() ? r2BlobStore : postgresBlobStore;
}

/** Used to keep next/image pointed at a same-origin route rather than a remote host. */
export function blobStoreIsLocal(): boolean {
  return !r2IsConfigured();
}

/** Call *after* the new reference is already committed (a replaced/cleared
 * imageKey or avatarKey), never before — if the delete races ahead of a
 * failed update, a still-referenced blob could vanish out from under it.
 * A no-op when there was no previous key. Never throws: losing an orphaned
 * blob to a transient failure is nothing compared to failing the user's
 * actual upload over a cleanup step, so this only logs and moves on. */
export async function deleteOldBlob(ref: string | null | undefined): Promise<void> {
  if (!ref) return;
  try {
    await getBlobStore().delete(ref);
  } catch (e) {
    console.error(`Failed to delete orphaned blob "${ref}":`, e);
  }
}
