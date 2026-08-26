import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { getBlobStore } from "@/lib/storage";
import { validateImageUpload } from "@/lib/imageUpload";

export async function POST(req: Request) {
  const auth = await requireModuleAccess("products", "canCreate");
  if ("error" in auth) return auth.error;

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validationError = validateImageUpload(file, buffer);
  if (validationError) {
    return NextResponse.json(validationError, { status: 400 });
  }

  const extension = file.type.split("/")[1];

  try {
    // Backing store (Postgres vs R2) is decided by getBlobStore(), not here.
    const imageKey = await getBlobStore().put(buffer, file.type, extension);
    return NextResponse.json({ imageKey });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
