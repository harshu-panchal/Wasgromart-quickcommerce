import { useState } from "react";
import { useSubscription } from "../../context/SubscriptionContext";
import type { SubscriptionPlan } from "../../context/SubscriptionContext";
import PaymentModal from "./PaymentModal";

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrentPlan?: boolean;
}

const popularBadge = (planId: string) => planId === "monthly";

export default function PlanCard({ plan, isCurrentPlan }: PlanCardProps) {
  const { subscribeToPlan, subscriptionEnabled } = useSubscription();
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const enabledFeatures = plan.features.filter((f) => f.enabled);

  const handleSubscribe = () => {
    setIsPaymentOpen(true);
  };

  const handlePaymentSuccess = () => {
    setIsPaymentOpen(false);
    subscribeToPlan(plan.id);
  };

  return (
    <>
      <div
        className={`relative rounded-2xl border-2 transition-all duration-300 overflow-hidden ${
          isCurrentPlan
            ? "border-teal-500 shadow-lg shadow-teal-500/20 scale-[1.02]"
            : "border-neutral-200 hover:border-teal-300 hover:shadow-md"
        } ${!plan.isActive ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Popular badge */}
        {popularBadge(plan.id) && (
          <div className="absolute top-0 right-0">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Most Popular
            </div>
          </div>
        )}

        {/* Current plan indicator */}
        {isCurrentPlan && (
          <div className="bg-teal-500 text-white text-center text-xs font-semibold py-1.5 tracking-wide">
            ✓ CURRENT PLAN
          </div>
        )}

        <div className="p-5 sm:p-6">
          {/* Plan Header */}
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold text-neutral-800">{plan.name}</h3>
            <p className="text-xs text-neutral-500 mt-0.5">{plan.duration}</p>
          </div>

          {/* Price */}
          <div className="text-center mb-5">
            <span className="text-3xl sm:text-4xl font-extrabold text-teal-700">
              ₹{plan.price.toLocaleString("en-IN")}
            </span>
            <span className="text-sm text-neutral-500 ml-1">
              /{plan.id === "weekly" ? "wk" : plan.id === "monthly" ? "mo" : "yr"}
            </span>
          </div>

          {/* Divider */}
          <div className="border-t border-neutral-100 mb-4" />

          {/* Features */}
          <ul className="space-y-2.5 mb-6">
            {enabledFeatures.map((feature) => (
              <li key={feature.id} className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 mt-0.5 text-teal-500 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-sm text-neutral-600">{feature.name}</span>
              </li>
            ))}
            {enabledFeatures.length === 0 && (
              <li className="text-xs text-neutral-400 text-center italic">
                No features enabled
              </li>
            )}
          </ul>

          {/* Action Button */}
          <button
            onClick={handleSubscribe}
            disabled={isCurrentPlan || !subscriptionEnabled}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              isCurrentPlan
                ? "bg-teal-50 text-teal-600 cursor-default"
                : "bg-teal-600 hover:bg-teal-700 text-white active:scale-[0.97] shadow-sm hover:shadow-md"
            } disabled:opacity-60 disabled:cursor-not-allowed`}>
            {isCurrentPlan ? "Active Plan" : "Buy / Activate"}
          </button>
        </div>
      </div>

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        onSuccess={handlePaymentSuccess}
        planName={plan.name}
        amount={plan.price}
      />
    </>
  );
}
