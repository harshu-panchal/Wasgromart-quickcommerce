import React, { useState } from "react";
import { transferFunds } from "../../../services/api/admin/adminWalletService";

interface Seller {
  _id: string;
  sellerName: string;
  storeName: string;
  balance?: number;
}

interface FundTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sellers: Seller[];
}

export default function FundTransferModal({
  isOpen,
  onClose,
  onSuccess,
  sellers,
}: FundTransferModalProps) {
  const [selectedSeller, setSelectedSeller] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"Credit" | "Debit">("Credit");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeller || !amount || !description) {
      setError("Please fill in all fields.");
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Amount must be a valid number greater than 0.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await transferFunds({
        userId: selectedSeller,
        userType: "SELLER",
        amount: numAmount,
        type,
        description,
      });

      if (result.success) {
        // Reset form and close
        setSelectedSeller("");
        setAmount("");
        setType("Credit");
        setDescription("");
        onSuccess();
        onClose();
      } else {
        setError(result.message || "Failed to transfer funds.");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to transfer funds.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-xl font-semibold text-neutral-800">Add Fund Transfer</h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-700 focus:outline-none"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Seller <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              className="w-full rounded border border-neutral-300 p-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            >
              <option value="" disabled>
                Select a seller
              </option>
              {sellers.map((seller) => (
                <option key={seller._id} value={seller._id}>
                  {seller.storeName || seller.sellerName} (₹{seller.balance?.toFixed(2) || "0.00"})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Transaction Type <span className="text-red-500">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "Credit" | "Debit")}
              className="w-full rounded border border-neutral-300 p-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            >
              <option value="Credit">Credit (Add Funds)</option>
              <option value="Debit">Debit (Deduct Funds)</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full rounded border border-neutral-300 p-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            />
          </div>

          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Remark / Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Reason for transfer"
              className="w-full rounded border border-neutral-300 p-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              rows={3}
              required
            ></textarea>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:bg-teal-400"
            >
              {loading ? "Processing..." : "Transfer Funds"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
