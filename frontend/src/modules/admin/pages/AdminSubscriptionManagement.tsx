import { useEffect, useState } from "react";
import { useSubscription } from "../../../context/SubscriptionContext";
import {
  listPromotionRequests,
  approvePromotionRequest,
  rejectPromotionRequest,
  updatePromotionStatus,
  PromotionRequest,
} from "../../../services/api/promotionService";
import { useToast } from "../../../context/ToastContext";

export default function AdminSubscriptionManagement() {
  const {
    subscriptionEnabled,
    toggleSubscriptionSystem,
    plans,
    updatePlanPrice,
    togglePlanActive,
    togglePlanFeature,
  } = useSubscription();
  const { showToast } = useToast();

  const [promotionRequests, setPromotionRequests] = useState<PromotionRequest[]>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoadingPromotions(true);
    listPromotionRequests()
      .then((data) => {
        if (mounted) setPromotionRequests(data);
      })
      .catch((error) => {
        console.error("Failed to load promotion requests", error);
        showToast("Unable to fetch promotion requests", "error");
      })
      .finally(() => mounted && setLoadingPromotions(false));
    return () => {
      mounted = false;
    };
  }, [showToast]);

  const updateLocalRequest = (updated: PromotionRequest) => {
    setPromotionRequests((prev) =>
      prev.map((req) => (req._id === updated._id ? updated : req))
    );
  };

  const handleApprove = async (req: PromotionRequest) => {
    setActionId(req._id);
    try {
      const updated = await approvePromotionRequest(req._id, {
        order: req.order,
        link: req.link,
        title: req.title,
      });
      updateLocalRequest(updated);
      showToast("Promotion approved and activated", "success");
    } catch (error: any) {
      console.error("Approve failed", error);
      showToast(
        error?.response?.data?.message || "Failed to approve promotion",
        "error"
      );
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionId(id);
    try {
      const updated = await rejectPromotionRequest(id);
      updateLocalRequest(updated);
      showToast("Promotion rejected", "info");
    } catch (error: any) {
      console.error("Reject failed", error);
      showToast(
        error?.response?.data?.message || "Failed to reject promotion",
        "error"
      );
    } finally {
      setActionId(null);
    }
  };

  const handleToggleActive = async (req: PromotionRequest) => {
    setActionId(req._id);
    try {
      const updated = await updatePromotionStatus(req._id, {
        isActive: !req.isActive,
        order: req.order,
      });
      updateLocalRequest(updated);
      showToast(
        updated.isActive ? "Promotion activated" : "Promotion paused",
        "success"
      );
    } catch (error: any) {
      console.error("Toggle active failed", error);
      showToast(
        error?.response?.data?.message || "Failed to update promotion",
        "error"
      );
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          Subscription Management
        </h1>
        <p className="text-teal-100 text-sm mt-1">
          Configure and manage seller subscription plans
        </p>
      </div>

      <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-6">
        {/* Global Toggle */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-neutral-800">
                Subscription System
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Enable or disable the subscription system for all sellers
              </p>
            </div>
            <button
              onClick={toggleSubscriptionSystem}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                subscriptionEnabled ? "bg-teal-600" : "bg-neutral-300"
              }`}>
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                  subscriptionEnabled ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>
          <div className="mt-3">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                subscriptionEnabled
                  ? "bg-teal-50 text-teal-700"
                  : "bg-red-50 text-red-600"
              }`}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  subscriptionEnabled ? "bg-teal-500" : "bg-red-500"
                }`}
              />
              {subscriptionEnabled ? "Active" : "Disabled"}
            </span>
          </div>
        </div>

        {/* Plans Management */}
        <div>
          <h2 className="text-base font-bold text-neutral-800 mb-4">
            Manage Plans
          </h2>
          <div className="space-y-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden transition-opacity ${
                  !subscriptionEnabled ? "opacity-50 pointer-events-none" : ""
                }`}>
                {/* Plan Header */}
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        plan.isActive
                          ? "bg-teal-100 text-teal-600"
                          : "bg-neutral-200 text-neutral-400"
                      }`}>
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-neutral-800">
                        {plan.name} Plan
                      </h3>
                      <p className="text-xs text-neutral-500">{plan.duration}</p>
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide ${
                        plan.isActive ? "text-teal-600" : "text-neutral-400"
                      }`}>
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() => togglePlanActive(plan.id)}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${
                        plan.isActive ? "bg-teal-600" : "bg-neutral-300"
                      }`}>
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                          plan.isActive ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Plan Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* Price Input */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                      Price (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400 font-medium">
                        ₹
                      </span>
                      <input
                        type="number"
                        value={plan.price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            updatePlanPrice(plan.id, val);
                          }
                        }}
                        className="w-full pl-7 pr-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                        min="0"
                        step="1"
                      />
                    </div>
                  </div>

                  {/* Features Toggles */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-2">
                      Features
                    </label>
                    <div className="space-y-2">
                      {plan.features.map((feature) => (
                        <div
                          key={feature.id}
                          className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-neutral-50 transition-colors">
                          <span className="text-sm text-neutral-700">
                            {feature.name}
                          </span>
                          <button
                            onClick={() =>
                              togglePlanFeature(plan.id, feature.id)
                            }
                            className={`relative w-9 h-5 rounded-full transition-colors duration-300 ${
                              feature.enabled ? "bg-teal-600" : "bg-neutral-300"
                            }`}>
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                                feature.enabled
                                  ? "translate-x-4"
                                  : "translate-x-0"
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Promotion Requests from Sellers */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-neutral-50 border-b border-neutral-100">
            <div>
              <h2 className="text-sm font-bold text-neutral-800">
                Promotion Banner Requests
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Approve seller banners to show on the user homepage
              </p>
            </div>
            <span className="text-[11px] font-semibold text-neutral-500">
              {promotionRequests.filter((p) => p.status === "Pending").length} pending
            </span>
          </div>

          {loadingPromotions ? (
            <div className="p-6 text-sm text-neutral-500">Loading requests...</div>
          ) : promotionRequests.length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">
              No promotion requests yet.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {promotionRequests.map((req) => (
                <div key={req._id} className="flex flex-col sm:flex-row sm:items-center gap-4 px-4 sm:px-5 py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                      <img src={req.image} alt={req.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-800 line-clamp-1">{req.title}</p>
                      <p className="text-[11px] text-neutral-500 line-clamp-1">
                        {req.seller?.storeName || req.seller?.sellerName || "Seller"} • Link: {req.link || "auto store"}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${
                          req.status === "Approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : req.status === "Rejected"
                              ? "bg-red-50 text-red-600"
                              : "bg-amber-50 text-amber-700"
                        }`}>
                          {req.status}
                        </span>
                        {typeof req.order === "number" && (
                          <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-semibold">
                            Order {req.order}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:w-64">
                    <input
                      type="number"
                      min={0}
                      value={req.order ?? ""}
                      onChange={(e) => {
                        const value = e.target.value === "" ? 999 : Number(e.target.value);
                        setPromotionRequests((prev) =>
                          prev.map((p) =>
                            p._id === req._id ? { ...p, order: value } : p
                          )
                        );
                      }}
                      className="w-20 border border-neutral-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Order"
                    />
                    {req.status === "Pending" ? (
                      <>
                        <button
                          onClick={() => handleApprove(req)}
                          disabled={actionId === req._id}
                          className={`px-3 py-2 rounded-lg text-sm font-semibold text-white ${
                            actionId === req._id
                              ? "bg-teal-300 cursor-not-allowed"
                              : "bg-teal-600 hover:bg-teal-700"
                          }`}>
                          {actionId === req._id ? "Saving..." : "Approve"}
                        </button>
                        <button
                          onClick={() => handleReject(req._id)}
                          disabled={actionId === req._id}
                          className="px-3 py-2 rounded-lg text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100">
                          Reject
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleToggleActive(req)}
                        disabled={actionId === req._id}
                        className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                          req.isActive
                            ? "text-neutral-700 bg-neutral-100 hover:bg-neutral-200"
                            : "text-white bg-teal-600 hover:bg-teal-700"
                        }`}>
                        {req.isActive ? "Pause" : "Activate"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
