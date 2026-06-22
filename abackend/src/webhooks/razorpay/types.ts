export type RazorpayEventType =
  | "payment.captured"
  | "subscription.activated"
  | "subscription.cancelled"
  | "invoice.paid";

export interface RazorpayWebhookEnvelope {
  event: string;
  contains?: string[];
  payload: Record<string, any>;
  created_at?: number;
}

export interface RazorpayPaymentEntity {
  id: string; // pay_*
  order_id?: string; // order_*
  status?: string;
  amount?: number;
  currency?: string;
  notes?: Record<string, any>;
  created_at?: number;
}

export interface RazorpaySubscriptionEntity {
  id: string; // sub_*
  status?: string;
  plan_id?: string;
  customer_id?: string;
  current_start?: number;
  current_end?: number;
  start_at?: number;
  ended_at?: number;
  cancelled_at?: number;
  notes?: Record<string, any>;
}

export interface RazorpayInvoiceEntity {
  id: string; // inv_*
  payment_id?: string; // pay_*
  subscription_id?: string; // sub_*
  status?: string;
  notes?: Record<string, any>;
  issued_at?: number;
  paid_at?: number;
}

