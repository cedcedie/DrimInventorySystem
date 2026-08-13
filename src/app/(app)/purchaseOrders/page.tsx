import type { Metadata } from "next";
import { ScreenBody } from "@/components/ScreenBody";
import { PurchaseOrdersScreen } from "@/components/screens/PurchaseOrdersScreen";
import { getPurchaseOrdersData } from "@/lib/data/purchaseOrders";

export const metadata: Metadata = {
  title: "Purchase Orders — DRIM Inventory System",
};

export default async function PurchaseOrdersPage() {
  const data = await getPurchaseOrdersData({ page: 1 });

  return (
    <ScreenBody>
      <PurchaseOrdersScreen initialData={data} />
    </ScreenBody>
  );
}
