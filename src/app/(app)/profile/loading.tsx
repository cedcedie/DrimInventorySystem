import { ScreenHeaderSkeleton } from "@/components/ScreenHeaderSkeleton";
import { ScreenBody } from "@/components/ScreenBody";
import { CenteredLoading } from "@/components/CenteredLoading";

export default function ProfileLoading() {
  return (
    <>
      <ScreenHeaderSkeleton />
      <ScreenBody>
        <CenteredLoading description="Loading your account…" />
      </ScreenBody>
    </>
  );
}
