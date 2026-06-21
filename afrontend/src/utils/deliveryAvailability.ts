export type DeliveryAvailability = "Available" | "Not Available";

/** Mirror backend getDeliveryAvailability for client-side fallback. */
export function resolveDeliveryAvailability(deliveryBoy: {
  available?: string;
  isOnline?: boolean;
}): DeliveryAvailability {
  if (deliveryBoy.available === "Not Available") {
    return "Not Available";
  }
  if (deliveryBoy.isOnline === true) {
    return "Available";
  }
  if (deliveryBoy.available === "Available") {
    return "Available";
  }
  return "Not Available";
}
