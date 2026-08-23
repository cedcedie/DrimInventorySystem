import type { Metadata } from "next";
import { ScreenBody } from "@/components/ScreenBody";
import { InventoryScreen } from "@/components/screens/InventoryScreen";
import { getInventoryData } from "@/lib/data/inventory";

export const metadata: Metadata = {
  title: "Inventory — DRIM Inventory System",
};

export default async function InventoryPage() {
  const data = await getInventoryData({});

  return (
    <ScreenBody>
      <InventoryScreen initialData={data} />
    </ScreenBody>
  );
}
