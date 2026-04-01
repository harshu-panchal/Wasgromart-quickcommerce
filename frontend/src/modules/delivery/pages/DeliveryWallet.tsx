import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "../../../context/ToastContext";
import {
    getDeliveryWalletBalance,
    getDeliveryWalletTransactions,
    requestDeliveryWithdrawal,
    getDeliveryWithdrawals,
    getDeliveryCommissions,
    createAdminPayoutOrder,
    verifyAdminPayout,
} from "../../../services/api/deliveryWalletService";
import { useAuth } from "../../../context/AuthContext";

type Tab = "transactions" | "withdrawals" | "commissions";

export default function DeliveryWallet() {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>("transactions");
    const [balance, setBalance] = useState(0);
    const [pendingAdminPayout, setPendingAdminPayout] = useState(0);
    const [cashCollected, setCashCollected] = useState(0);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [commissions, setCommissions] = useState<any>({
        commissions: [],
        total: 0,
        paid: 0,
        pending: 0,
    });
    const [loading, setLoading] = useState(true);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showPayoutModal, setShowPayoutModal] = useState(false);
    const [payoutAmount, setPayoutAmount] = useState("");
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"Bank Transfer" | "UPI">(
        "Bank Transfer",
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchWalletData();
    }, []);

    const fetchWalletData = async () => {
        try {
            setLoading(true);
            const [balanceRes, transactionsRes, withdrawalsRes, commissionsRes] =
                await Promise.all([
                    getDeliveryWalletBalance(),
                    getDeliveryWalletTransactions(),
                    getDeliveryWithdrawals(),
                    getDeliveryCommissions(),
                ]);

            if (balanceRes.success) {
                setBalance(balanceRes.data.balance);
                setPendingAdminPayout(balanceRes.data.pendingAdminPayout || 0);
                setCashCollected(balanceRes.data.cashCollected || 0);
            }
            if (transactionsRes.success)
                setTransactions(transactionsRes.data.transactions || []);
            if (withdrawalsRes.success) setWithdrawals(withdrawalsRes.data || []);
            if (commissionsRes.success) setCommissions(commissionsRes.data);
        } catch (error: any) {
            showToast(
                error.response?.data?.message || "Failed to load wallet data",
                "error",
            );
        } finally {
            setLoading(false);
        }
    };

    const handleAdminPayout = async () => {
        try {
            const amount = parseFloat(payoutAmount);
            if (isNaN(amount) || amount <= 0) {
                showToast("Please enter a valid amount", "error");
                return;
            }

            if (amount > pendingAdminPayout) {
                showToast(`Amount exceeds pending payout (₹${pendingAdminPayout})`, "error");
                return;
            }

            setIsSubmitting(true);

            // Load Razorpay
            const loadRazorpay = () => {
                return new Promise((resolve) => {
                    const script = document.createElement("script");
                    script.src = "https://checkout.razorpay.com/v1/checkout.js";
                    script.onload = () => resolve(true);
                    script.onerror = () => resolve(false);
                    document.body.appendChild(script);
                });
            };

            const scriptLoaded = await loadRazorpay();
            if (!scriptLoaded) {
                showToast("Failed to load Razorpay SDK", "error");
                setIsSubmitting(false);
                return;
            }

            // Create Order
            const orderRes = await createAdminPayoutOrder(amount);
            if (!orderRes.success) {
                showToast(orderRes.message || "Failed to create payout order", "error");
                setIsSubmitting(false);
                return;
            }

            const { razorpayOrderId, razorpayKey } = orderRes.data;

            const options = {
                key: razorpayKey,
                amount: amount * 100,
                currency: "INR",
                name: "Wasgro Mart Admin Payout",
                description: "Settling collected COD cash",
                order_id: razorpayOrderId,
                prefill: {
                    name: user?.name || "Delivery Boy",
                    email: user?.email || "",
                    contact: user?.phone || "",
                },
                theme: { color: "#16a34a" },
                handler: async function (response: any) {
                    try {
                        const verifyRes = await verifyAdminPayout({
                            razorpayOrderId: response.razorpay_order_id,
                            razorpayPaymentId: response.razorpay_payment_id,
                            razorpaySignature: response.razorpay_signature,
                            amount: amount,
                        });

                        if (verifyRes.success) {
                            showToast("Payout successful", "success");
                            setShowPayoutModal(false);
                            setPayoutAmount("");
                            fetchWalletData();
                        } else {
                            showToast(verifyRes.message || "Verification failed", "error");
                        }
                    } catch (err: any) {
                        showToast(err.response?.data?.message || "Verification failed", "error");
                    } finally {
                        setIsSubmitting(false);
                    }
                },
                modal: {
                    ondismiss: function () {
                        setIsSubmitting(false);
                    }
                }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (error: any) {
            showToast(error.response?.data?.message || "Failed to initiate payout", "error");
            setIsSubmitting(false);
        }
    };

    const handleWithdrawRequest = async () => {
        try {
            const amount = parseFloat(withdrawAmount);
            if (isNaN(amount) || amount <= 0) {
                showToast("Please enter a valid amount", "error");
                return;
            }

            if (amount > balance) {
                showToast("Insufficient balance", "error");
                return;
            }

            setIsSubmitting(true);
            const response = await requestDeliveryWithdrawal(amount, paymentMethod);
            if (response.success) {
                showToast("Withdrawal request submitted successfully", "success");
                setShowWithdrawModal(false);
                setWithdrawAmount("");
                fetchWalletData();
            }
        } catch (error: any) {
            showToast(
                error.response?.data?.message || "Failed to request withdrawal",
                "error",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10">
                <div className="px-4 py-3 flex items-center">
                    <button
                        onClick={() => navigate(-1)}
                        className="mr-3 p-2 hover:bg-neutral-100 rounded-full transition-colors">
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M15 18L9 12L15 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold text-gray-900">Wallet</h1>
                </div>
            </div>

            {/* Balance Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="m-4 bg-gradient-to-br from-green-500 to-green-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-green-100 text-sm font-medium">
                            Available Balance
                        </p>
                        <div className="bg-green-400/30 p-2 rounded-xl">
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <rect x="2" y="5" width="20" height="14" rx="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-5xl font-extrabold mb-6">
                        ₹{balance.toFixed(2)}
                    </h1>
                    <button
                        onClick={() => setShowWithdrawModal(true)}
                        className="w-full bg-white text-green-700 py-3.5 rounded-xl font-bold hover:bg-green-50 transition-all shadow-md active:scale-[0.98]">
                        Request Withdrawal
                    </button>
                </div>
                {/* Decorative background circle */}
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-green-400/20 rounded-full blur-3xl"></div>
            </motion.div>

            {/* COD & Admin Payout Section */}
            <div className="mx-4 mb-4 grid grid-cols-2 gap-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 flex flex-col justify-between">
                    <div>
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-3">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                                <line x1="7" y1="15" x2="7.01" y2="15" />
                                <line x1="12" y1="15" x2="12.01" y2="15" />
                            </svg>
                        </div>
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-tight">Total COD Collected</p>
                        <h3 className="text-xl font-black text-neutral-900 mt-1">₹{cashCollected.toLocaleString('en-IN')}</h3>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 flex flex-col justify-between relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mb-3">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        </div>
                        <p className="text-xs font-bold text-neutral-500 uppercase tracking-tight">Owed to Admin</p>
                        <h3 className="text-xl font-black text-orange-600 mt-1">₹{pendingAdminPayout.toLocaleString('en-IN')}</h3>

                        <button
                            onClick={() => {
                                setPayoutAmount(pendingAdminPayout.toString());
                                setShowPayoutModal(true);
                            }}
                            disabled={pendingAdminPayout <= 0}
                            className={`mt-4 w-full py-2 rounded-lg text-xs font-bold transition-all ${pendingAdminPayout > 0
                                ? "bg-orange-600 text-white hover:bg-orange-700 active:scale-95 shadow-lg shadow-orange-200"
                                : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                                }`}>
                            Pay to Admin
                        </button>
                    </div>
                </motion.div>
            </div>

            {/* Commission Summary */}
            <div className="mx-4 mb-4 grid grid-cols-3 gap-3">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-600 mb-1">Total Earned</p>
                    <p className="text-lg font-bold text-gray-900">
                        ₹{commissions.total?.toFixed(2) || "0.00"}
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-600 mb-1">Paid</p>
                    <p className="text-lg font-bold text-green-600">
                        ₹{commissions.paid?.toFixed(2) || "0.00"}
                    </p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-xs text-gray-600 mb-1">Pending</p>
                    <p className="text-lg font-bold text-orange-600">
                        ₹{commissions.pending?.toFixed(2) || "0.00"}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white mx-4 rounded-xl shadow-sm overflow-hidden">
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab("transactions")}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === "transactions"
                            ? "text-green-600 border-b-2 border-green-600"
                            : "text-gray-600"
                            }`}>
                        Transactions
                    </button>
                    <button
                        onClick={() => setActiveTab("withdrawals")}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === "withdrawals"
                            ? "text-green-600 border-b-2 border-green-600"
                            : "text-gray-600"
                            }`}>
                        Withdrawals
                    </button>
                    <button
                        onClick={() => setActiveTab("commissions")}
                        className={`flex-1 py-3 text-sm font-semibold transition-colors ${activeTab === "commissions"
                            ? "text-green-600 border-b-2 border-green-600"
                            : "text-gray-600"
                            }`}>
                        Commissions
                    </button>
                </div>

                <div className="p-4">
                    {/* Transactions Tab */}
                    {activeTab === "transactions" && (
                        <div className="space-y-3">
                            {transactions.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">
                                    No transactions yet
                                </p>
                            ) : (
                                transactions.map((txn: any) => (
                                    <div
                                        key={txn._id}
                                        className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">
                                                {txn.description}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {new Date(txn.createdAt).toLocaleDateString("en-IN", {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </p>
                                        </div>
                                        <p
                                            className={`font-bold text-lg ${txn.type === "Credit" ? "text-green-600" : "text-red-600"}`}>
                                            {txn.type === "Credit" ? "+" : "-"}₹
                                            {txn.amount.toFixed(2)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Withdrawals Tab */}
                    {activeTab === "withdrawals" && (
                        <div className="space-y-3">
                            {withdrawals.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">
                                    No withdrawal requests yet
                                </p>
                            ) : (
                                withdrawals.map((withdrawal: any) => (
                                    <div
                                        key={withdrawal._id}
                                        className="p-3 bg-gray-50 rounded-lg">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold text-gray-900">
                                                    ₹{withdrawal.amount.toFixed(2)}
                                                </p>
                                                <p className="text-xs text-gray-600">
                                                    {withdrawal.paymentMethod}
                                                </p>
                                            </div>
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-semibold ${withdrawal.status === "Completed"
                                                    ? "bg-green-100 text-green-700"
                                                    : withdrawal.status === "Approved"
                                                        ? "bg-blue-100 text-blue-700"
                                                        : withdrawal.status === "Rejected"
                                                            ? "bg-red-100 text-red-700"
                                                            : "bg-yellow-100 text-yellow-700"
                                                    }`}>
                                                {withdrawal.status}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {new Date(withdrawal.createdAt).toLocaleDateString(
                                                "en-IN",
                                                {
                                                    day: "numeric",
                                                    month: "short",
                                                    year: "numeric",
                                                },
                                            )}
                                        </p>
                                        {withdrawal.remarks && (
                                            <p className="text-xs text-gray-600 mt-2 italic">
                                                {withdrawal.remarks}
                                            </p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Commissions Tab */}
                    {activeTab === "commissions" && (
                        <div className="space-y-3">
                            {commissions.commissions?.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">
                                    No commissions yet
                                </p>
                            ) : (
                                commissions.commissions?.map((comm: any) => (
                                    <div key={comm.id} className="p-3 bg-gray-50 rounded-lg">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    Delivery Commission
                                                </p>
                                                <p className="text-xs text-gray-600">
                                                    Rate: {comm.rate}%
                                                </p>
                                            </div>
                                            <p className="font-bold text-green-600">
                                                ₹{comm.amount.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="flex justify-between text-xs text-gray-500">
                                            <span>Order Amount: ₹{comm.orderAmount.toFixed(2)}</span>
                                            <span>
                                                {new Date(comm.createdAt).toLocaleDateString("en-IN")}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Withdrawal Modal */}
            {showWithdrawModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl p-6 max-w-md w-full">
                        <h2 className="text-2xl font-bold mb-4">Request Withdrawal</h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                    ₹
                                </span>
                                <input
                                    type="number"
                                    value={withdrawAmount}
                                    onChange={(e) => setWithdrawAmount(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg pl-8 pr-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                    placeholder="Enter amount"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Available: ₹{balance.toFixed(2)}
                            </p>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Payment Method
                            </label>
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value as any)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-green-500 focus:border-transparent">
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="UPI">UPI</option>
                            </select>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowWithdrawModal(false);
                                    setWithdrawAmount("");
                                }}
                                className="flex-1 border border-gray-300 rounded-lg py-2.5 font-semibold hover:bg-gray-50 transition"
                                disabled={isSubmitting}>
                                Cancel
                            </button>
                            <button
                                onClick={handleWithdrawRequest}
                                className="flex-1 bg-green-600 text-white rounded-lg py-2.5 font-semibold hover:bg-green-700 transition disabled:opacity-50"
                                disabled={isSubmitting}>
                                {isSubmitting ? "Submitting..." : "Submit Request"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
            {/* Admin Payout Modal */}
            {showPayoutModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-neutral-900">Admin Payout</h2>
                            <button onClick={() => setShowPayoutModal(false)} className="text-neutral-400 hover:text-neutral-900">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="bg-orange-50 rounded-2xl p-4 mb-6 border border-orange-100">
                            <p className="text-sm text-orange-800 font-medium leading-relaxed">
                                You are settling the COD cash collected from customers. This amount will be paid directly to the platform admin.
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-bold text-neutral-700 mb-2">
                                Settlement Amount
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">₹</span>
                                <input
                                    type="number"
                                    value={payoutAmount}
                                    onChange={(e) => setPayoutAmount(e.target.value)}
                                    className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-2xl pl-10 pr-4 py-4 font-bold text-xl focus:border-orange-500 focus:bg-white transition-all outline-none"
                                    placeholder="0.00"
                                />
                            </div>
                            <p className="text-xs text-neutral-500 mt-2 font-medium">
                                Max available: <span className="font-bold text-orange-600">₹{pendingAdminPayout.toLocaleString('en-IN')}</span>
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowPayoutModal(false)}
                                className="flex-1 py-4 rounded-2xl font-bold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-all"
                                disabled={isSubmitting}>
                                Cancel
                            </button>
                            <button
                                onClick={handleAdminPayout}
                                className="flex-1 bg-neutral-900 text-white rounded-2xl py-4 font-bold hover:bg-black transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                                disabled={isSubmitting || !payoutAmount || parseFloat(payoutAmount) <= 0}>
                                {isSubmitting ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Processing...</span>
                                    </div>
                                ) : "Pay Now"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
