import { useState } from "react";
import { useSubscription } from "../../../context/SubscriptionContext";
import type { SellerSubscriptionRecord } from "../../../context/SubscriptionContext";

type FilterType = "All" | "Active" | "Expired";

const PLAN_COLORS: Record<string, string> = {
  weekly: "bg-blue-50 text-blue-700 border-blue-200",
  monthly: "bg-violet-50 text-violet-700 border-violet-200",
  yearly: "bg-amber-50 text-amber-700 border-amber-200",
};

export default function AdminSellerSubscriptions() {
  const { sellerSubscriptions, deactivateSellerSubscription } = useSubscription();
  const [filter, setFilter] = useState<FilterType>("All");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const filtered = sellerSubscriptions.filter((r) => {
    if (filter === "All") return true;
    return r.status === filter;
  });

  const counts = {
    All: sellerSubscriptions.length,
    Active: sellerSubscriptions.filter((r) => r.status === "Active").length,
    Expired: sellerSubscriptions.filter((r) => r.status === "Expired").length,
  };

  const handleDeactivate = (record: SellerSubscriptionRecord) => {
    if (confirmId === record.id) {
      deactivateSellerSubscription(record.id);
      setConfirmId(null);
    } else {
      setConfirmId(record.id);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="text-xl sm:text-2xl font-bold text-white">
          Seller Subscriptions
        </h1>
        <p className="text-teal-100 text-sm mt-1">
          Track and manage all seller subscription plans
        </p>

        {/* Quick Stats */}
        <div className="flex gap-3 mt-4 flex-wrap">
          {(["All", "Active", "Expired"] as FilterType[]).map((key) => (
            <div
              key={key}
              className="bg-teal-600/60 backdrop-blur-sm rounded-lg px-4 py-2 text-center min-w-[72px]">
              <p className="text-xl font-bold text-white">{counts[key]}</p>
              <p className="text-[10px] text-teal-100 uppercase tracking-wider font-medium">
                {key}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-4">
        {/* Filter Tabs */}
        <div className="flex gap-1 bg-neutral-200 rounded-xl p-1 w-fit">
          {(["All", "Active", "Expired"] as FilterType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                filter === tab
                  ? "bg-white text-teal-700 shadow-sm"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}>
              {tab}
              <span
                className={`ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  filter === tab ? "bg-teal-50 text-teal-600" : "bg-neutral-300 text-neutral-500"
                }`}>
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <p className="text-neutral-500 text-sm font-medium">No {filter !== "All" ? filter.toLowerCase() : ""} subscriptions found.</p>
          </div>
        )}

        {/* Desktop Table */}
        {filtered.length > 0 && (
          <>
            <div className="hidden sm:block bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 border-b border-neutral-200">
                    <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Seller
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Expiry Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-neutral-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtered.map((record) => (
                    <tr key={record.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-teal-700">
                              {record.sellerName.charAt(0)}
                            </span>
                          </div>
                          <span className="font-medium text-neutral-800">
                            {record.sellerName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            PLAN_COLORS[record.planId] || "bg-neutral-50 text-neutral-600 border-neutral-200"
                          }`}>
                          {record.planName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                            record.status === "Active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600"
                          }`}>
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              record.status === "Active" ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          />
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{record.startDate}</td>
                      <td className="px-4 py-3 text-neutral-600">{record.expiryDate}</td>
                      <td className="px-4 py-3 text-right">
                        {record.status === "Active" ? (
                          confirmId === record.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-neutral-500">Sure?</span>
                              <button
                                onClick={() => handleDeactivate(record)}
                                className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold px-2.5 py-1 rounded-lg transition-colors">
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmId(null)}
                                className="text-xs bg-neutral-200 hover:bg-neutral-300 text-neutral-700 font-semibold px-2.5 py-1 rounded-lg transition-colors">
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDeactivate(record)}
                              className="text-xs text-red-500 hover:text-red-600 font-semibold border border-red-200 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors">
                              Deactivate
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-neutral-400 font-medium">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="sm:hidden space-y-3">
              {filtered.map((record) => (
                <div
                  key={record.id}
                  className="bg-white rounded-xl border border-neutral-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-teal-700">
                          {record.sellerName.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-800 text-sm">
                          {record.sellerName}
                        </p>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            PLAN_COLORS[record.planId] || "bg-neutral-50 text-neutral-600 border-neutral-200"
                          }`}>
                          {record.planName}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        record.status === "Active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-600"
                      }`}>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          record.status === "Active" ? "bg-emerald-500" : "bg-red-500"
                        }`}
                      />
                      {record.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 mb-3">
                    <div>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">
                        Start
                      </p>
                      <p>{record.startDate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">
                        Expires
                      </p>
                      <p>{record.expiryDate}</p>
                    </div>
                  </div>

                  {record.status === "Active" && (
                    confirmId === record.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500">Confirm deactivate?</span>
                        <button
                          onClick={() => handleDeactivate(record)}
                          className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs bg-neutral-200 text-neutral-700 font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDeactivate(record)}
                        className="w-full text-sm text-red-500 hover:text-red-600 font-semibold border border-red-200 hover:bg-red-50 py-2 rounded-lg transition-colors">
                        Deactivate
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
