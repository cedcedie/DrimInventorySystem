import { ScreenHeaderSkeleton } from "@/components/ScreenHeaderSkeleton";
import { ScreenBody } from "@/components/ScreenBody";
import { CenteredLoading } from "@/components/CenteredLoading";

export default function ActivityLoading() {
  return (
    <>
      <ScreenHeaderSkeleton />
      <ScreenBody>
        <CenteredLoading description="Loading activity log…" />
      </ScreenBody>
    </>
  );
}
