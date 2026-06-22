import Razorpay from "razorpay";

export const getRazorpayKeyId = (): string | undefined =>
  process.env.RAZORPAY_KEY_ID?.trim();

export const getRazorpayClient = (): Razorpay => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials not configured - please check backend .env");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

