import type { Metadata } from "next";
import { ScreenBody } from "@/components/ScreenBody";
import { AdjustmentsScreen } from "@/components/screens/AdjustmentsScreen";
import { getStockAdjustmentsData } from "@/lib/data/adjustments";

export const metadata: Metadata = {
  title: "Adjustments — DRIM Inventory System",
};

export default async function AdjustmentsPage() {
  const initialData = await getStockAdjustmentsData({ page: 1 });

  // Title/breadcrumb come from AdjustmentsScreen's PageChrome.
  return (
    <ScreenBody>
      <AdjustmentsScreen initialData={initialData} />
    </ScreenBody>
  );
}
