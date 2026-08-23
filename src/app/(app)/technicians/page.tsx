import type { Metadata } from "next";
import { ScreenBody } from "@/components/ScreenBody";
import { TechniciansScreen } from "@/components/screens/TechniciansScreen";
import { getTechniciansData } from "@/lib/data/technicians";

export const metadata: Metadata = {
  title: "Technicians — DRIM Inventory System",
};

export default async function TechniciansPage() {
  const data = await getTechniciansData();

  return (
    <ScreenBody>
      <TechniciansScreen initialData={data} />
    </ScreenBody>
  );
}
