import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import type { Role } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ScreenBody } from "@/components/ScreenBody";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { screenTitleForRole, screenSubtitleForRole, PERM_SUMMARY } from "@/lib/navConfig";

export const metadata: Metadata = {
  title: "My Account — DRIM Inventory System",
};

export default async function ProfilePage() {
  const session = await auth();
  const role = session!.user.role as Role;

  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      technician: { select: { empNo: true, position: true } },
    },
  });

  return (
    <>
      <ScreenHeader
        title={screenTitleForRole("profile", role)}
        subtitle={screenSubtitleForRole("profile", role)}
        permSummary={PERM_SUMMARY[role]}
      />
      <ScreenBody>
        <ProfileScreen
          initialData={user ? { ...user, createdAt: user.createdAt.toISOString() } : undefined}
        />
      </ScreenBody>
    </>
  );
}
