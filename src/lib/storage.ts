import { prisma } from "@/lib/prisma";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";

/** Where uploaded bytes live. Two methods, because that's all any caller
 * needs: hand over bytes, get back an opaque reference; hand back the
 * reference, get a URL a browser can fetch.
 *
 * Callers never learn whether the bytes are in Postgres or R2, nor anything
 * about buckets, object keys, presigning, or expiry — swapping adapters is a
 * config change, not a code change. */
export interface BlobStore {
  put(bytes: Buffer, contentType: string, extension: string): Promise<string>;
  url(ref: string): Promise<string>;
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

/** Bytes in Postgres, served back through /api/blobs/[key]. Adequate for a
 * single-warehouse catalog; Neon's free tier is 0.5GB total, so this is the
 * thing to move off first if the catalog grows. */
const postgresBlobStore: BlobStore = {
  async put(bytes, contentType, extension) {
    const key = `products/${crypto.randomUUID()}.${extension}`;
    await prisma.storedBlob.create({
      // Prisma's Bytes maps to Uint8Array; a Buffer is one, but TS wants the
      // narrower ArrayBuffer-backed form spelled out.
      data: { key, contentType, size: bytes.length, bytes: new Uint8Array(bytes) },
    });
    return key;
  },
  async url(ref) {
    return `/api/blobs/${ref}`;
  },
};

/** Bytes in Cloudflare R2. Activates automatically once the R2_* vars are
 * set — no code change required. */
const r2BlobStore: BlobStore = {
  async put(bytes, contentType, extension) {
    const key = `products/${crypto.randomUUID()}.${extension}`;
    await uploadToR2(key, bytes, contentType);
    return key;
  },
  async url(ref) {
    const base = process.env.R2_PUBLIC_URL;
    if (base) return `${base.replace(/\/$/, "")}/${ref}`;
    return getSignedR2Url(ref);
  },
};

export function getBlobStore(): BlobStore {
  return r2IsConfigured() ? r2BlobStore : postgresBlobStore;
}

/** True when bytes are being served out of Postgres — used to keep next/image
 * pointed at a same-origin route rather than a remote host. */
export function blobStoreIsLocal(): boolean {
  return !r2IsConfigured();
}
