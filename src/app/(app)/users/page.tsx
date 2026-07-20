import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { UsersScreen } from "@/components/screens/UsersScreen";
import { screenTitleForRole, screenSubtitleForRole, PERM_SUMMARY } from "@/lib/navConfig";
import { getUsersData } from "@/lib/data/users";

export const metadata: Metadata = {
  title: "Users — DRIM Inventory System",
};

export default async function UsersPage() {
  const [session, data] = await Promise.all([auth(), getUsersData({})]);
  const role = session!.user.role as Role;

  return (
    <>
      <ScreenHeader
        title={screenTitleForRole("users", role)}
        subtitle={screenSubtitleForRole("users", role)}
        permSummary={PERM_SUMMARY[role]}
      />
      <ScreenBody>
        <UsersScreen initialData={data} />
      </ScreenBody>
    </>
  );
}
