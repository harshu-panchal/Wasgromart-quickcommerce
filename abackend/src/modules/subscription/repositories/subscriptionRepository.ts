import Seller from "../../../models/Seller";

export class SubscriptionRepository {
  async getSellerSubscription(sellerId: string) {
    return Seller.findById(sellerId).select("subscription").lean<any>();
  }

  async setSellerSubscription(sellerId: string, update: Record<string, any>) {
    const $set: Record<string, any> = {};
    for (const [key, value] of Object.entries(update)) {
      if (value === undefined) continue;
      $set[`subscription.${key}`] = value;
    }

    if (Object.keys($set).length === 0) return;
    await Seller.updateOne({ _id: sellerId }, { $set }, { strict: true });
  }

  async findSellerIdByRazorpaySubscriptionId(razorpaySubscriptionId: string): Promise<string | null> {
    const seller = await Seller.findOne({
      "subscription.razorpaySubscriptionId": razorpaySubscriptionId,
    })
      .select("_id")
      .lean<{ _id: any }>();

    return seller?._id ? String(seller._id) : null;
  }
}

