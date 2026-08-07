import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ScreenBody } from "@/components/ScreenBody";
import { ProductsScreen } from "@/components/screens/ProductsScreen";
import { getProductsData } from "@/lib/data/products";

export const metadata: Metadata = {
  title: "Products — DRIM Inventory System",
};

export default async function ProductsPage() {
  const [session, data] = await Promise.all([auth(), getProductsData({})]);
  const role = session!.user.role as Role;

  return (
    <ScreenBody>
      <ProductsScreen role={role} initialData={data} />
    </ScreenBody>
  );
}
