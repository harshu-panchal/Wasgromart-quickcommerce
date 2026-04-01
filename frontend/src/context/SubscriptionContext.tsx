import { createContext, useContext, useState, ReactNode, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────
export interface SubscriptionFeature {
  id: string;
  name: string;
  enabled: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  duration: string;
  price: number;
  features: SubscriptionFeature[];
  isActive: boolean;
}

export interface CurrentSubscription {
  planId: string;
  planName: string;
  status: "Active" | "Expired";
  expiryDate: string;
}

// ── NEW: Seller subscription record (for Admin tracking) ───────────────
export interface SellerSubscriptionRecord {
  id: string;
  sellerName: string;
  planId: string;
  planName: string;
  status: "Active" | "Expired";
  startDate: string;
  expiryDate: string;
}

export interface ChatMessage {
  id: string;
  sender: "seller" | "admin";
  text: string;
  timestamp: string;
}

interface SubscriptionContextType {
  // Admin controls
  subscriptionEnabled: boolean;
  toggleSubscriptionSystem: () => void;
  plans: SubscriptionPlan[];
  updatePlanPrice: (planId: string, price: number) => void;
  togglePlanActive: (planId: string) => void;
  togglePlanFeature: (planId: string, featureId: string) => void;

  // Admin: seller subscriptions tracking
  sellerSubscriptions: SellerSubscriptionRecord[];
  deactivateSellerSubscription: (recordId: string) => void;

  // Chat System
  chatMessages: Record<string, ChatMessage[]>;
  sendChatMessage: (sellerId: string, text: string, isFromAdmin: boolean) => void;

  // Seller state
  currentSubscription: CurrentSubscription | null;
  subscribeToPlan: (planId: string) => void;
  cancelSubscription: () => void;
  isSubscribed: boolean;
}

// ── Default Features ───────────────────────────────────────────────────
const createDefaultFeatures = (): SubscriptionFeature[] => [
  { id: "chat_support", name: "24/7 Chat Support", enabled: true },
  { id: "banner_access", name: "Promotion Banner Access", enabled: true },
  { id: "reduced_commission", name: "Reduced Commission", enabled: true },
];

// ── Default Plans ──────────────────────────────────────────────────────
const defaultPlans: SubscriptionPlan[] = [
  {
    id: "weekly",
    name: "Weekly",
    duration: "7 days",
    price: 199,
    features: createDefaultFeatures(),
    isActive: true,
  },
  {
    id: "monthly",
    name: "Monthly",
    duration: "30 days",
    price: 499,
    features: createDefaultFeatures(),
    isActive: true,
  },
  {
    id: "yearly",
    name: "Yearly",
    duration: "365 days",
    price: 3999,
    features: createDefaultFeatures(),
    isActive: true,
  },
];

// ── Mock seller subscription records (for demo) ────────────────────────
const mockSellerSubscriptions: SellerSubscriptionRecord[] = [
  {
    id: "rec_001",
    sellerName: "Krishna Stores",
    planId: "monthly",
    planName: "Monthly",
    status: "Active",
    startDate: "1 March 2026",
    expiryDate: "31 March 2026",
  },
  {
    id: "rec_002",
    sellerName: "Raj Electronics",
    planId: "yearly",
    planName: "Yearly",
    status: "Active",
    startDate: "15 February 2026",
    expiryDate: "14 February 2027",
  },
  {
    id: "rec_003",
    sellerName: "Meera Fashion",
    planId: "weekly",
    planName: "Weekly",
    status: "Expired",
    startDate: "10 March 2026",
    expiryDate: "17 March 2026",
  },
  {
    id: "rec_004",
    sellerName: "Shree Grocers",
    planId: "monthly",
    planName: "Monthly",
    status: "Active",
    startDate: "20 March 2026",
    expiryDate: "19 April 2026",
  },
];

// ── Initial Mock Messages ──────────────────────────────────────────────
const initialChatMessages: Record<string, ChatMessage[]> = {
  rec_001: [
    { id: "1", sender: "seller", text: "Hello, I need help with my banner.", timestamp: "10:30 AM" },
    { id: "2", sender: "admin", text: "Hi Krishna Stores! How can we help?", timestamp: "10:32 AM" },
  ],
  rec_002: [
    { id: "1", sender: "seller", text: "Is the yearly plan commission reduced automatically?", timestamp: "yesterday" },
    { id: "2", sender: "admin", text: "Yes, it is applied on every order.", timestamp: "yesterday" },
  ],
  "rec_current_seller": [
    { id: "1", sender: "admin", text: "Welcome to Premium Support! How can we help you today?", timestamp: "Just now" },
  ],
};

// ── Context ────────────────────────────────────────────────────────────
const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Shared record ID for "current seller" so admin deactivation syncs back
const CURRENT_SELLER_RECORD_ID = "rec_current_seller";

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>(defaultPlans);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [sellerSubscriptions, setSellerSubscriptions] = useState<SellerSubscriptionRecord[]>(
    mockSellerSubscriptions
  );
  const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>(
    initialChatMessages
  );

  const toggleSubscriptionSystem = useCallback(() => {
    setSubscriptionEnabled((prev) => !prev);
  }, []);

  const updatePlanPrice = useCallback((planId: string, price: number) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, price } : p))
    );
  }, []);

  const togglePlanActive = useCallback((planId: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === planId ? { ...p, isActive: !p.isActive } : p))
    );
  }, []);

  const togglePlanFeature = useCallback((planId: string, featureId: string) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              features: p.features.map((f) =>
                f.id === featureId ? { ...f, enabled: !f.enabled } : f
              ),
            }
          : p
      )
    );
  }, []);

  const subscribeToPlan = useCallback(
    (planId: string) => {
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return;

      const daysMap: Record<string, number> = {
        weekly: 7,
        monthly: 30,
        yearly: 365,
      };
      const days = daysMap[planId] || 30;
      const start = new Date();
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);

      const startStr = start.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const expiryStr = expiry.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      setCurrentSubscription({
        planId: plan.id,
        planName: plan.name,
        status: "Active",
        expiryDate: expiryStr,
      });

      // Add / update the current seller's record in the admin tracking list
      setSellerSubscriptions((prev) => {
        const existing = prev.find((r) => r.id === CURRENT_SELLER_RECORD_ID);
        if (existing) {
          return prev.map((r) =>
            r.id === CURRENT_SELLER_RECORD_ID
              ? { ...r, planId: plan.id, planName: plan.name, status: "Active", startDate: startStr, expiryDate: expiryStr }
              : r
          );
        }
        return [
          ...prev,
          {
            id: CURRENT_SELLER_RECORD_ID,
            sellerName: "You (Current Seller)",
            planId: plan.id,
            planName: plan.name,
            status: "Active",
            startDate: startStr,
            expiryDate: expiryStr,
          },
        ];
      });
    },
    [plans]
  );

  const cancelSubscription = useCallback(() => {
    setCurrentSubscription(null);
    // Mark the current seller's admin record as Expired
    setSellerSubscriptions((prev) =>
      prev.map((r) =>
        r.id === CURRENT_SELLER_RECORD_ID ? { ...r, status: "Expired" } : r
      )
    );
  }, []);

  // Admin action: deactivate any seller
  const deactivateSellerSubscription = useCallback((recordId: string) => {
    setSellerSubscriptions((prev) =>
      prev.map((r) =>
        r.id === recordId ? { ...r, status: "Expired" } : r
      )
    );
    // If admin deactivates the current seller, clear their active subscription
    if (recordId === CURRENT_SELLER_RECORD_ID) {
      setCurrentSubscription((prev) =>
        prev ? { ...prev, status: "Expired" } : prev
      );
    }
  }, []);

  const sendChatMessage = useCallback(
    (sellerId: string, text: string, isFromAdmin: boolean) => {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        sender: isFromAdmin ? "admin" : "seller",
        text,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setChatMessages((prev) => ({
        ...prev,
        [sellerId]: [...(prev[sellerId] || []), newMessage],
      }));
    },
    []
  );

  const isSubscribed =
    currentSubscription !== null && currentSubscription.status === "Active";

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptionEnabled,
        toggleSubscriptionSystem,
        plans,
        updatePlanPrice,
        togglePlanActive,
        togglePlanFeature,
        sellerSubscriptions,
        deactivateSellerSubscription,
        chatMessages,
        sendChatMessage,
        currentSubscription,
        subscribeToPlan,
        cancelSubscription,
        isSubscribed,
      }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
