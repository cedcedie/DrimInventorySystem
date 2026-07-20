import { ScreenHeaderSkeleton } from "@/components/ScreenHeaderSkeleton";
import { ScreenBody } from "@/components/ScreenBody";
import { CenteredLoading } from "@/components/CenteredLoading";

export default function SuppliersLoading() {
  return (
    <>
      <ScreenHeaderSkeleton />
      <ScreenBody>
        <CenteredLoading description="Loading supplier registry…" />
      </ScreenBody>
    </>
  );
}
