import { NextResponse } from "next/server";

/** Every mutation route repeated the same catch-block shape by hand: turn a
 * caught error into a JSON `{ error }` response. `status` is a required
 * choice (not defaulted) — routes differ on 400 (validation-shaped failure)
 * vs 500 (genuine server error) by design. */
export function apiErrorResponse(e: unknown, opts: { fallback: string; status: 400 | 500 }): NextResponse {
  const message = e instanceof Error ? e.message : opts.fallback;
  return NextResponse.json({ error: message }, { status: opts.status });
}

/** Maps a Prisma unique-constraint violation to a friendly 409, or returns
 * null so the caller can re-throw / fall through to its own handling —
 * some routes want the conflict case only and let everything else bubble
 * to Next's error boundary rather than mask it as a generic 500. */
export function uniqueConstraintResponse(e: unknown, conflictMessage: string): NextResponse | null {
  if (e instanceof Error && e.message.includes("Unique constraint")) {
    return NextResponse.json({ error: conflictMessage }, { status: 409 });
  }
  return null;
}
