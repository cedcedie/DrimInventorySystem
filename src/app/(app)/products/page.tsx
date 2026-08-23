import type { Metadata } from "next";
import { ScreenBody } from "@/components/ScreenBody";
import { ProductsScreen } from "@/components/screens/ProductsScreen";
import { getProductsData } from "@/lib/data/products";

export const metadata: Metadata = {
  title: "Products — DRIM Inventory System",
};

export default async function ProductsPage() {
  const data = await getProductsData({});

  return (
    <ScreenBody>
      <ProductsScreen initialData={data} />
    </ScreenBody>
  );
}
