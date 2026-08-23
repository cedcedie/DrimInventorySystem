import type { Metadata } from "next";
import { ScreenBody } from "@/components/ScreenBody";
import { SuppliersScreen } from "@/components/screens/SuppliersScreen";
import { getSuppliersData } from "@/lib/data/suppliers";

export const metadata: Metadata = {
  title: "Suppliers — DRIM Inventory System",
};

export default async function SuppliersPage() {
  const data = await getSuppliersData();

  return (
    <ScreenBody>
      <SuppliersScreen initialData={data} />
    </ScreenBody>
  );
}
