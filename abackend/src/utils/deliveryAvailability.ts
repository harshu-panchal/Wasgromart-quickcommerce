export type DeliveryAvailability = "Available" | "Not Available";

type AvailabilitySource = {
  available?: string | null;
  isOnline?: boolean;
};

/**
 * Resolve the availability label shown in admin UI.
 * - Admin "Not Available" always wins (manual block).
 * - Otherwise online in the delivery app => Available.
 * - Otherwise admin "Available" => Available.
 */
export function getDeliveryAvailability(
  doc: AvailabilitySource
): DeliveryAvailability {
  if (doc.available === "Not Available") {
    return "Not Available";
  }
  if (doc.isOnline === true) {
    return "Available";
  }
  if (doc.available === "Available") {
    return "Available";
  }
  return "Not Available";
}

/** Mongo filter: delivery partners considered Available for admin lists. */
export function buildAvailableFilter(): Record<string, unknown> {
  return {
    available: { $ne: "Not Available" },
    $or: [{ isOnline: true }, { available: "Available" }],
  };
}

/** Mongo filter: delivery partners considered Not Available for admin lists. */
export function buildNotAvailableFilter(): Record<string, unknown> {
  return {
    $or: [
      { available: "Not Available" },
      {
        $and: [
          { isOnline: { $ne: true } },
          { available: { $ne: "Available" } },
        ],
      },
    ],
  };
}

export function withResolvedAvailability<T extends AvailabilitySource>(
  doc: T
): T & { available: DeliveryAvailability; isOnline: boolean } {
  const plain = (doc as any)?.toObject ? (doc as any).toObject() : { ...doc };
  return {
    ...plain,
    isOnline: Boolean(plain.isOnline),
    available: getDeliveryAvailability(plain),
  };
}
