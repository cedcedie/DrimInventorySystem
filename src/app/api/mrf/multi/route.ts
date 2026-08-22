import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/apiAuth";
import { prisma } from "@/lib/prisma";
import { isProductRequestable } from "@/lib/mrfLifecycle";
import { notifyWarehouseMrfFiled } from "@/lib/notifications";
import { isUniqueRefNoError, nextRefNo, withRefNoRetry } from "@/lib/refNo";
import { getTechnicianForUser } from "@/lib/data/mrf";
import { parseBody } from "@/lib/validate";
import { z } from "zod";
import { revalidateAfterMutation } from "@/lib/revalidate";

const mrfItemSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  qty: z.number().int().positive("Quantity must be a positive number"),
});

const multiMrfSchema = z.object({
  items: z.array(mrfItemSchema).min(1, "At least one item is required"),
  project: z.string().min(1, "Project name is required"),
  externalRefNo: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: Request) {
  const auth = await requireModuleAccess("mrf", "canCreate");
  if ("error" in auth) return auth.error;
  if (auth.role !== "TECHNICIAN") {
    return NextResponse.json({ error: "Only technicians file MRFs" }, { status: 403 });
  }

  // MRFs are always requests from a technician; the account must be linked
  // to a roster entry so fulfilled stock can be attributed correctly.
  const technician = await getTechnicianForUser(auth.session.user.id);
  if (!technician) {
    return NextResponse.json(
      { error: "No technician roster entry is linked to this account" },
      { status: 404 }
    );
  }

  const parsed = await parseBody(req, multiMrfSchema);
  if ("error" in parsed) return parsed.error;

  const { items, project, externalRefNo, description } = parsed.data;

  // Verify all products exist and are not archived
  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, archivedAt: true },
  });

  if (
    products.length !== productIds.length ||
    products.some((p) => !isProductRequestable(p.archivedAt))
  ) {
    return NextResponse.json(
      { error: "One or more products not found or archived" },
      { status: 400 }
    );
  }

  try {
    const refNo = await withRefNoRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const ref = await nextRefNo(tx, "mrf", "MRF");
          const mrf = await tx.mrf.create({
            data: {
              refNo: ref,
              technicianId: technician.id,
              project,
              externalRefNo: externalRefNo || null,
              description: description || null,
              status: "PENDING",
              items: {
                create: items.map((item) => ({
                  productId: item.productId,
                  qtyRequested: item.qty,
                  qtyFulfilled: 0,
                })),
              },
            },
            include: { items: true },
          });

          const totalQty = mrf.items.reduce((sum, item) => sum + item.qtyRequested, 0);
          const itemsSummary =
            mrf.items.length === 1
              ? `${products[0]?.name ?? "1 item"} (${totalQty})`
              : `${mrf.items.length} items (${totalQty} total qty)`;

          await tx.activityLog.create({
            data: {
              userId: auth.session.user.id,
              action: `Filed MRF for ${itemsSummary}`,
              refNo: ref,
            },
          });

          return ref;
        },
        // Same guard as every other ref-number-generating route (stock-in,
        // stock-out, purchase-orders, purchase-requests, stock-adjustments)
        // — nextRefNo's read-max-then-insert pattern is a real race under
        // ReadCommitted (Prisma's default) when two requests file an MRF at
        // the same moment; Serializable + withRefNoRetry's outer retry is
        // what actually prevents two technicians colliding on the same
        // MRF-#### ref instead of relying on the unique-constraint 409 as
        // the only backstop. This route was the one write path missing it.
        { isolationLevel: "Serializable", maxWait: 10000, timeout: 15000 }
      )
    );

    revalidateAfterMutation(["mrf"], [`mrf-tech-${technician.id}`]);

    await notifyWarehouseMrfFiled({
      mrfRefNo: refNo,
      project,
      technicianName: technician.name,
      excludeUserId: auth.session.user.id,
    });

    return NextResponse.json({ refNo }, { status: 201 });
  } catch (e) {
    if (isUniqueRefNoError(e)) {
      return NextResponse.json(
        { error: "Could not assign an MRF reference number. Please try again." },
        { status: 409 }
      );
    }

    const message = e instanceof Error ? e.message : "Failed to file MRF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
