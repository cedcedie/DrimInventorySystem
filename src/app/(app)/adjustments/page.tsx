import type { Metadata } from "next";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { AdjustmentsScreen } from "@/components/screens/AdjustmentsScreen";
import { getStockAdjustmentsData } from "@/lib/data/adjustments";

export const metadata: Metadata = {
  title: "Adjustments — DRIM Inventory System",
};

export default async function AdjustmentsPage() {
  const initialData = await getStockAdjustmentsData({ page: 1 });

  return (
    <>
      <ScreenHeader
        title="Stock Adjustments"
        subtitle="Manual count corrections — every change is logged with reason and user"
      />
      <ScreenBody>
        <AdjustmentsScreen initialData={initialData} />
      </ScreenBody>
    </>
  );
}
