import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { ProductsScreen } from "@/components/screens/ProductsScreen";
import { screenTitleForRole, screenSubtitleForRole, PERM_SUMMARY } from "@/lib/navConfig";
import { getProductsData } from "@/lib/data/products";

export default async function ProductsPage() {
  const [session, data] = await Promise.all([auth(), getProductsData({})]);
  const role = session!.user.role as Role;

  return (
    <>
      <ScreenHeader
        title={screenTitleForRole("products", role)}
        subtitle={screenSubtitleForRole("products", role)}
        permSummary={PERM_SUMMARY[role]}
      />
      <ScreenBody>
        <ProductsScreen role={role} initialData={data} />
      </ScreenBody>
    </>
  );
}
