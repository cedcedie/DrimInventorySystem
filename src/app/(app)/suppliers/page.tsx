import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@/generated/prisma";
import { ScreenBody } from "@/components/ScreenBody";
import { SuppliersScreen } from "@/components/screens/SuppliersScreen";
import { getSuppliersData } from "@/lib/data/suppliers";

export const metadata: Metadata = {
  title: "Suppliers — DRIM Inventory System",
};

export default async function SuppliersPage() {
  const [session, data] = await Promise.all([auth(), getSuppliersData()]);
  const role = session!.user.role as Role;

  return (
    <ScreenBody>
      <SuppliersScreen role={role} initialData={data} />
    </ScreenBody>
  );
}
