import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PermissionsScreen } from "@/components/screens/PermissionsScreen";

export const metadata = {
  title: "Role Permissions - DRIM",
};

export default async function PermissionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role !== "OWNER") {
    redirect("/dashboard");
  }

  return (
    <>
      <ScreenHeader
        title="Permissions"
        subtitle="Configure what each role can do. Changes save automatically."
      />
      <PermissionsScreen />
    </>
  );
}
