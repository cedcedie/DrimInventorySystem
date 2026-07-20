import { ScreenHeaderSkeleton } from "@/components/ScreenHeaderSkeleton";
import { ScreenBody } from "@/components/ScreenBody";
import { CenteredLoading } from "@/components/CenteredLoading";

export default function InventoryLoading() {
  return (
    <>
      <ScreenHeaderSkeleton />
      <ScreenBody>
        <CenteredLoading description="Loading inventory…" />
      </ScreenBody>
    </>
  );
}
