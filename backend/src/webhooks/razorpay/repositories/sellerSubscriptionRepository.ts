import Seller from "../../../models/Seller";

export type SellerSubscriptionStatus = "Active" | "Cancelled" | "Expired";

export interface SellerSubscriptionUpdate {
  isActive?: boolean;
  status?: SellerSubscriptionStatus;
  planId?: string;
  startDate?: Date;
  expiryDate?: Date;
  razorpaySubscriptionId?: string;
  razorpayCustomerId?: string;
  lastPaymentId?: string;
  lastInvoiceId?: string;
  cancelledAt?: Date | null;
}

export class SellerSubscriptionRepository {
  async findSellerIdByRazorpaySubscriptionId(razorpaySubscriptionId: string): Promise<string | null> {
    const seller = await Seller.findOne({
      "subscription.razorpaySubscriptionId": razorpaySubscriptionId,
    })
      .select("_id")
      .lean<{ _id: any }>();

    return seller?._id ? String(seller._id) : null;
  }

  async updateBySellerId(sellerId: string, update: SellerSubscriptionUpdate) {
    // This writes to Seller.subscription (schema path is added in src/models/Seller.ts).
    const $set: Record<string, any> = {};
    for (const [key, value] of Object.entries(update)) {
      if (value === undefined) continue;
      $set[`subscription.${key}`] = value;
    }

    if (Object.keys($set).length === 0) return;

    await Seller.updateOne(
      { _id: sellerId },
      { $set },
      { strict: true } // keep schema-enforced updates
    );
  }
}
