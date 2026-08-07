import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ScreenBody } from "@/components/ScreenBody";
import { InventoryScreen } from "@/components/screens/InventoryScreen";
import { getInventoryData } from "@/lib/data/inventory";

export const metadata: Metadata = {
  title: "Inventory — DRIM Inventory System",
};

export default async function InventoryPage() {
  const [session, data] = await Promise.all([auth(), getInventoryData({})]);
  const role = session!.user.role as Role;

  return (
    <ScreenBody>
      <InventoryScreen role={role} initialData={data} />
    </ScreenBody>
  );
}
