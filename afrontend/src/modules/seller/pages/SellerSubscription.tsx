import { useState } from "react";
import { useSubscription } from "../../../context/SubscriptionContext";
import PlanCard from "../../../components/subscription/PlanCard";
import SubscriptionStatus from "../../../components/subscription/SubscriptionStatus";
import FeatureGate from "../../../components/subscription/FeatureGate";
import { Link } from "react-router-dom";

export default function SellerSubscription() {
  const { plans, currentSubscription, subscriptionEnabled } = useSubscription();

  const activePlans = plans.filter((p) => p.isActive);

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 sm:pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          Subscription Plans
        </h1>
        <p className="text-teal-100 text-sm mt-1">
          Unlock premium features for your store
        </p>
      </div>

      <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-6">
        {/* Current Subscription Status */}
        <SubscriptionStatus />

        {/* Plans Grid */}
        {subscriptionEnabled && activePlans.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-neutral-800 mb-4">
              Choose a Plan
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePlans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isCurrentPlan={currentSubscription?.planId === plan.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Feature Gating Demo Section */}
        <div>
          <h2 className="text-base font-bold text-neutral-800 mb-4">
            Premium Features
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Banner Promotion Link */}
            <FeatureGate featureName="Promotion Banner Campaigns">
              <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm h-full flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-teal-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-800">
                    Promotion Banners
                  </h3>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-4 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-teal-700 font-medium px-2">
                    Upload and manage your store's promotional banners.
                  </p>
                  <Link
                    to="/seller/promotions"
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2 rounded-lg transition-all text-center shadow-sm">
                    Manage Banners
                  </Link>
                </div>
              </div>
            </FeatureGate>

            {/* Functional Support Badge */}
            <FeatureGate featureName="24/7 Support Badge">
              <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm h-full flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-teal-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-neutral-800">
                    Premium Support
                  </h3>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-4 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-teal-600 flex items-center justify-center shadow-md shadow-teal-600/30">
                      <svg
                        className="w-6 h-6 text-white"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-teal-700 leading-none">
                        Premium Support Active
                      </p>
                      <span className="inline-block mt-1 text-[10px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded uppercase">
                        24/7 Priority
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/seller/support"
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-2 rounded-lg transition-all text-center shadow-sm">
                    Open Support Inbox
                  </Link>
                </div>
              </div>
            </FeatureGate>
          </div>
        </div>
      </div>
    </div>
  );
}
