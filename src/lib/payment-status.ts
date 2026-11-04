// Only these database results confirm a stored, amount-matched payment.
export function confirmationStatus(result: unknown): "Paid" | "Pending" {
  return result === "Paid" || result === "Already" ? "Paid" : "Pending";
}
