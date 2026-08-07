import type { Metadata } from "next";
import { ScreenBody } from "@/components/ScreenBody";
import { UsersScreen } from "@/components/screens/UsersScreen";
import { getUsersData } from "@/lib/data/users";

export const metadata: Metadata = {
  title: "Users — DRIM Inventory System",
};

export default async function UsersPage() {
  const data = await getUsersData({});

  return (
    <ScreenBody>
      <UsersScreen initialData={data} />
    </ScreenBody>
  );
}
