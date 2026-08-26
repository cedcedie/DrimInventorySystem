import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBlobStore } from "@/lib/storage";
import { revalidateAfterMutation } from "@/lib/revalidate";
import { validateImageUpload } from "@/lib/imageUpload";

// Self-service profile picture — any logged-in user may set their own, no
// module permission beyond being authenticated (mirrors /api/me's PATCH).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const avatarKey = await getBlobStore().put(buffer, file.type, extension, "avatars");
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarKey },
      select: { id: true, avatarKey: true },
    });

    revalidateAfterMutation(["users"]);
    return NextResponse.json(updated);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarKey: null },
  });

  revalidateAfterMutation(["users"]);
  return NextResponse.json({ ok: true });
}
