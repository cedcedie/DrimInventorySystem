import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Serves bytes held by the Postgres BlobStore adapter. Catch-all because
 * keys contain a slash (products/<uuid>.webp) to match R2's key shape.
 *
 * Auth-gated like every other route: product images are behind the login,
 * and an unauthenticated URL would be a way to read them without one. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  const blob = await prisma.storedBlob.findUnique({ where: { key: key.join("/") } });
  if (!blob) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(blob.bytes), {
    status: 200,
    headers: {
      "Content-Type": blob.contentType,
      "Content-Length": String(blob.size),
      // Content at a given key never changes — the key is a fresh UUID per
      // upload — so this can be cached hard and privately.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
