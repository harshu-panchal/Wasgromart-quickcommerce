import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "../../context/SubscriptionContext";

interface FeatureGateProps {
  featureName: string;
  children: ReactNode;
}

export default function FeatureGate({ featureName, children }: FeatureGateProps) {
  const { isSubscribed } = useSubscription();
  const navigate = useNavigate();

  if (isSubscribed) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-6 sm:p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-neutral-200 flex items-center justify-center mx-auto mb-3">
        <svg
          className="w-6 h-6 text-neutral-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-neutral-700 mb-1">
        {featureName}
      </p>
      <p className="text-xs text-neutral-500 mb-4">
        Upgrade to unlock this feature
      </p>
      <button
        onClick={() => navigate("/seller/subscription")}
        className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm">
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        Upgrade Now
      </button>
    </div>
  );
}
