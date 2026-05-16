import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useToast } from '../../../context/ToastContext';
import {
  getSellerWalletBalance,
  getSellerWalletTransactions,
  requestSellerWithdrawal,
  getSellerWithdrawals,
  getSellerCommissions,
} from '../../../services/api/sellerWalletService';

type Tab = 'transactions' | 'withdrawals' | 'commissions';

export default function SellerWallet() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('transactions');
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any>({ commissions: [], total: 0, paid: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'UPI'>('Bank Transfer');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const [balanceRes, transactionsRes, withdrawalsRes, commissionsRes] = await Promise.all([
        getSellerWalletBalance(),
        getSellerWalletTransactions(),
        getSellerWithdrawals(),
        getSellerCommissions(),
      ]);

      if (balanceRes.success) setBalance(balanceRes.data.balance);
      if (transactionsRes.success) setTransactions(transactionsRes.data.transactions || []);
      if (withdrawalsRes.success) setWithdrawals(withdrawalsRes.data || []);
      if (commissionsRes.success) setCommissions(commissionsRes.data);
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to load wallet data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawRequest = async () => {
    try {
      const amount = parseFloat(withdrawAmount);
      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
      }

      if (amount > balance) {
        showToast('Insufficient balance', 'error');
        return;
      }

      setIsSubmitting(true);
      const response = await requestSellerWithdrawal(amount, paymentMethod);
      if (response.success) {
        showToast('Withdrawal request submitted successfully', 'success');
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        fetchWalletData();
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to request withdrawal', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-gray-900">Wallet</h1>
        </div>
      </div>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="m-3 sm:m-4 bg-gradient-to-br from-teal-700 via-teal-800 to-teal-900 rounded-2xl p-5 sm:p-8 text-white shadow-xl relative overflow-hidden"
      >
        <div className="relative z-10">
          <p className="text-xs sm:text-sm font-medium opacity-80 mb-1 uppercase tracking-wider">Available Balance</p>
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-5 flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-semibold opacity-70">₹</span>
            {balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h1>
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="w-full sm:w-auto bg-white text-teal-800 px-8 py-3 rounded-xl font-bold hover:bg-teal-50 transition-all shadow-lg active:scale-95 text-sm sm:text-base"
          >
            Request Withdrawal
          </button>
        </div>
        {/* Subtle background decoration */}
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -left-10 -top-10 w-40 h-40 bg-teal-400/10 rounded-full blur-3xl" />
      </motion.div>


      {/* Tabs */}
      <div className="bg-white mx-3 sm:mx-4 rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
        <div className="flex border-b border-neutral-100 p-1">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-3 text-[11px] sm:text-sm font-bold rounded-xl transition-all ${activeTab === 'transactions'
              ? 'bg-teal-50 text-teal-700 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`flex-1 py-3 text-[11px] sm:text-sm font-bold rounded-xl transition-all ${activeTab === 'withdrawals'
              ? 'bg-teal-50 text-teal-700 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            Withdrawals
          </button>
          <button
            onClick={() => setActiveTab('commissions')}
            className={`flex-1 py-3 text-[11px] sm:text-sm font-bold rounded-xl transition-all ${activeTab === 'commissions'
              ? 'bg-teal-50 text-teal-700 shadow-sm'
              : 'text-neutral-500 hover:text-neutral-700'
              }`}
          >
            Commissions
          </button>
        </div>

        <div className="p-4">
          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="space-y-3">
              {(() => {
                // Combine transactions and pending commissions
                const allItems = [
                  ...transactions.map((t: any) => ({ ...t, source: 'transaction' })),
                  ...(commissions.commissions || [])
                    .filter((c: any) => c.status === 'Pending')
                    .map((c: any) => ({
                      _id: c.id || c._id,
                      description: `Order #${c.orderId?.substring(0, 8) || 'Unknown'} (Pending)`,
                      amount: c.orderAmount - c.amount, // Calculate Net Earning: Order Amount - Commission Fee
                      type: 'Credit',
                      createdAt: c.createdAt,
                      status: 'Pending',
                      source: 'commission'
                    }))
                ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                if (allItems.length === 0) {
                  return <p className="text-center text-gray-500 py-8">No transactions yet</p>;
                }

                return allItems.map((item: any) => (
                  <div key={item._id} className="flex justify-between items-center p-4 bg-neutral-50 hover:bg-neutral-100/80 transition-colors rounded-xl border border-neutral-100/50">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                        <p className="font-bold text-neutral-800 text-sm sm:text-base truncate">{item.description}</p>
                        {item.status === 'Pending' && (
                          <span className="bg-amber-100 text-amber-700 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Pending
                          </span>
                        )}
                        {item.status === 'Completed' && (
                          <span className="bg-emerald-100 text-emerald-700 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Success
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-xs text-neutral-400 mt-1 font-medium">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <p className={`font-black text-base sm:text-lg whitespace-nowrap ${item.type === 'Credit' ? 'text-emerald-600' : 'text-rose-600'} ${item.status === 'Pending' ? 'opacity-50' : ''}`}>
                      {item.type === 'Credit' ? '+' : '-'}₹{item.amount.toFixed(2)}
                    </p>
                  </div>
                ));
              })()}
            </div>
          )}

          {/* Withdrawals Tab */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-3">
              {withdrawals.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No withdrawal requests yet</p>
              ) : (
                withdrawals.map((withdrawal: any) => (
                  <div key={withdrawal._id} className="p-4 bg-neutral-50 hover:bg-neutral-100/80 transition-colors rounded-xl border border-neutral-100/50">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div className="min-w-0">
                        <p className="font-extrabold text-neutral-800 text-lg">₹{withdrawal.amount.toFixed(2)}</p>
                        <p className="text-xs text-neutral-500 font-medium flex items-center gap-1.5 mt-0.5">
                           <span className="w-1 h-1 rounded-full bg-neutral-300"></span>
                           {withdrawal.paymentMethod}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${withdrawal.status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : withdrawal.status === 'Approved'
                            ? 'bg-teal-100 text-teal-700'
                            : withdrawal.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                      >
                        {withdrawal.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                        <p className="text-[10px] text-neutral-400 font-medium">
                        {new Date(withdrawal.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                        })}
                        </p>
                        {withdrawal.remarks && (
                        <p className="text-[10px] text-neutral-400 italic">Info available</p>
                        )}
                    </div>
                    {withdrawal.remarks && (
                      <p className="text-[11px] text-neutral-600 mt-3 p-2 bg-white/50 rounded-lg border border-neutral-100 italic">“{withdrawal.remarks}”</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Commissions Tab */}
          {activeTab === 'commissions' && (
            <div className="space-y-3">
              {commissions.commissions?.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No commissions yet</p>
              ) : (
                commissions.commissions?.map((comm: any) => (
                  <div key={comm.id} className="p-4 bg-neutral-50 hover:bg-neutral-100/80 transition-colors rounded-xl border border-neutral-100/50">
                    <div className="flex justify-between items-start gap-4 mb-3">
                      <div className="min-w-0">
                        <p className="font-bold text-neutral-800 text-sm">Order Commission</p>
                        <p className="text-[10px] text-neutral-500 font-medium">Rate: {comm.rate}%</p>
                      </div>
                      <p className="font-black text-emerald-600 text-base">₹{comm.amount.toFixed(2)}</p>
                    </div>
                    <div className="flex justify-between items-end text-[10px] text-emerald-800/60 font-bold uppercase tracking-tighter">
                      <span className="bg-emerald-50 px-2 py-0.5 rounded">Amount: ₹{comm.orderAmount.toFixed(2)}</span>
                      <span className="opacity-50">{new Date(comm.createdAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Withdrawal Modal */}
      {
        showWithdrawModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-6 sm:p-10 max-w-md w-full relative sm:bottom-auto bottom-0 mt-auto sm:mt-0 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-neutral-200 rounded-full mx-auto mb-6 sm:hidden" />
              <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 mb-6">Request Withdrawal</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black text-neutral-500 uppercase tracking-widest mb-3">Amount to withdraw</label>
                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-xl group-focus-within:text-teal-600 transition-colors">₹</span>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-neutral-50 border-2 border-neutral-100 rounded-2xl pl-12 pr-6 py-4 text-xl font-bold focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 outline-none transition-all"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="flex justify-between mt-3 px-1">
                    <p className="text-xs text-neutral-400 font-medium">Available: <span className="text-neutral-600 font-bold">₹{balance.toFixed(2)}</span></p>
                    <button 
                        onClick={() => setWithdrawAmount(balance.toString())}
                        className="text-xs text-teal-600 font-bold hover:underline"
                    >
                        Withdraw All
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-neutral-500 uppercase tracking-widest mb-3">Preferred Method</label>
                  <div className="grid grid-cols-2 gap-3">
                     <button 
                        onClick={() => setPaymentMethod('Bank Transfer')}
                        className={`py-3 rounded-2xl border-2 font-bold text-sm transition-all ${paymentMethod === 'Bank Transfer' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-neutral-100 text-neutral-500'}`}
                     >
                        Bank
                     </button>
                     <button 
                        onClick={() => setPaymentMethod('UPI')}
                        className={`py-3 rounded-2xl border-2 font-bold text-sm transition-all ${paymentMethod === 'UPI' ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-neutral-100 text-neutral-500'}`}
                     >
                        UPI
                     </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4 pb-2">
                  <button
                    onClick={() => {
                      setShowWithdrawModal(false);
                      setWithdrawAmount('');
                    }}
                    className="order-2 sm:order-1 flex-1 bg-neutral-100 text-neutral-500 rounded-2xl py-4 font-bold hover:bg-neutral-200 transition active:scale-95 shadow-sm"
                    disabled={isSubmitting}
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleWithdrawRequest}
                    className="order-1 sm:order-2 flex-[2] bg-teal-700 text-white rounded-2xl py-4 font-bold hover:bg-teal-800 transition shadow-lg shadow-teal-700/30 active:scale-95 disabled:opacity-50"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Processing...' : 'Confirm Request'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )
      }
    </div >
  );
}
