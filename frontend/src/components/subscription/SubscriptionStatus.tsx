import { useSubscription } from "../../context/SubscriptionContext";

export default function SubscriptionStatus() {
  const { currentSubscription, cancelSubscription, subscriptionEnabled } =
    useSubscription();

  if (!subscriptionEnabled) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-amber-700">
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm font-medium">
            Subscription system is currently disabled by admin.
          </p>
        </div>
      </div>
    );
  }

  if (!currentSubscription) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-neutral-500"
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
          <div>
            <p className="text-sm font-semibold text-neutral-700">
              No Active Subscription
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              Choose a plan below to unlock premium features.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isActive = currentSubscription.status === "Active";

  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 ${
        isActive
          ? "border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50"
          : "border-red-200 bg-red-50"
      }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isActive ? "bg-teal-100" : "bg-red-100"
            }`}>
            {isActive ? (
              <svg
                className="w-5 h-5 text-teal-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-red-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-neutral-800">
                {currentSubscription.planName} Plan
              </p>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isActive
                    ? "bg-teal-100 text-teal-700"
                    : "bg-red-100 text-red-600"
                }`}>
                {currentSubscription.status}
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Expires: {currentSubscription.expiryDate}
            </p>
          </div>
        </div>

        {isActive && (
          <button
            onClick={cancelSubscription}
            className="text-xs text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors self-start sm:self-auto">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
