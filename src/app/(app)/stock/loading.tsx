import { ScreenHeaderSkeleton } from "@/components/ScreenHeaderSkeleton";
import { ScreenBody } from "@/components/ScreenBody";
import { CenteredLoading } from "@/components/CenteredLoading";

export default function StockLoading() {
  return (
    <>
      <ScreenHeaderSkeleton />
      <ScreenBody>
        <CenteredLoading description="Loading stock movements…" />
      </ScreenBody>
    </>
  );
}
