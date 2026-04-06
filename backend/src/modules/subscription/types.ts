export interface CreateSubscriptionBody {
  planId: string;
  totalCount?: number;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface CancelSubscriptionBody {
  subscriptionId?: string;
  cancelAtCycleEnd?: boolean;
}

export interface GetSubscriptionParams {
  id: string;
}

export interface RazorpaySubscriptionResponse {
  id: string; // sub_*
  plan_id?: string;
  status?: string;
  customer_id?: string;
  current_start?: number;
  current_end?: number;
  start_at?: number;
  ended_at?: number;
  cancelled_at?: number;
  notes?: Record<string, any>;
}

