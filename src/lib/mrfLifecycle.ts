/** Pure MRF lifecycle helpers — labels, cancel policy, catalog gates. */

export type MrfDbStatus = "PENDING" | "PARTIAL" | "FULFILLED" | "CANCELLED";

export function mrfStatusLabel(status: MrfDbStatus, totalFulfilled = 0): string {
  if (status === "PENDING") return "Pending";
  if (status === "PARTIAL") return "Partial";
  if (status === "FULFILLED") return "Fulfilled";
  if (totalFulfilled > 0) return "Closed remaining";
  return "Cancelled";
}

export function mrfCancelButtonLabel(anyReleased: boolean): string {
  return anyReleased ? "Close remaining" : "Cancel request";
}

export function mrfCancelConfirmMessage(refNo: string, anyReleased: boolean): string {
  if (anyReleased) {
    return `Close remaining qty on ${refNo}? Already-released stock stays out; this cannot be undone.`;
  }
  return `Cancel request ${refNo}? This cannot be undone.`;
}

export function mrfCancelToast(refNo: string, anyReleased: boolean): string {
  return anyReleased
    ? `Closed remaining on ${refNo}. Released stock is unchanged.`
    : `Request ${refNo} cancelled.`;
}

export function mrfCancelActivityAction(
  refNo: string,
  anyReleased: boolean,
  reason?: string
): string {
  const base = anyReleased ? `Closed remaining on MRF ${refNo}` : `Cancelled MRF ${refNo}`;
  const trimmed = reason?.trim();
  return trimmed ? `${base} — ${trimmed}` : base;
}

/** Tech may cancel only untouched pending requests. */
export function techMayCancelMrf(status: MrfDbStatus, anyReleased: boolean): boolean {
  return status === "PENDING" && !anyReleased;
}

/** Warehouse may cancel pending or partial (close leftover request qty). */
export function warehouseMayCancelMrf(status: MrfDbStatus): boolean {
  return status === "PENDING" || status === "PARTIAL";
}

/** New MRF / SI must target non-archived catalog rows. */
export function isProductRequestable(archivedAt: Date | string | null | undefined): boolean {
  return archivedAt == null;
}

/**
 * Stock module view is matrix-only — technicians never inherit stock reads
 * (apiAuth hard-blocks TECHNICIAN on stock even if matrix grants canView).
 */
export function canViewStockModule(stockCanView: boolean, roleIsTechnician: boolean): boolean {
  if (roleIsTechnician) return false;
  return stockCanView;
}
