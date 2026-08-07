import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ScreenBody } from "@/components/ScreenBody";
import { TechniciansScreen } from "@/components/screens/TechniciansScreen";
import { getTechniciansData } from "@/lib/data/technicians";

export const metadata: Metadata = {
  title: "Technicians — DRIM Inventory System",
};

export default async function TechniciansPage() {
  const [session, data] = await Promise.all([auth(), getTechniciansData()]);
  const role = session!.user.role as Role;

  return (
    <ScreenBody>
      <TechniciansScreen role={role} initialData={data} />
    </ScreenBody>
  );
}
