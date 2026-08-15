import type { Metadata } from "next";
import { ScreenBody } from "@/components/ScreenBody";
import { PurchaseRequestsScreen } from "@/components/screens/PurchaseRequestsScreen";
import { getPurchaseRequestsData } from "@/lib/data/purchaseRequests";

export const metadata: Metadata = {
  title: "Purchase Requests — DRIM Inventory System",
};

export default async function PurchaseRequestsPage() {
  const data = await getPurchaseRequestsData({ page: 1 });

  return (
    <ScreenBody>
      <PurchaseRequestsScreen initialData={data} />
    </ScreenBody>
  );
}
