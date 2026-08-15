export type PurchaseRequestDbStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export function purchaseRequestStatusLabel(status: PurchaseRequestDbStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
  }
}
