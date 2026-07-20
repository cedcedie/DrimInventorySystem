import { NextResponse } from "next/server";
import type { ZodType, z } from "zod";

type ValidationResult<T> = { data: T } | { error: NextResponse };

export async function parseBody<S extends ZodType>(
  req: Request,
  schema: S
): Promise<ValidationResult<z.infer<S>>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid request body";
    return { error: NextResponse.json({ error: message }, { status: 400 }) };
  }

  return { data: result.data };
}
