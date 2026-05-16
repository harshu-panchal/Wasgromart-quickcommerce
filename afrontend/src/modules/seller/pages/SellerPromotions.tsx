import { useEffect, useMemo, useState } from "react";
import BannerUpload from "../../../components/subscription/BannerUpload";
import FeatureGate from "../../../components/subscription/FeatureGate";
import { uploadImage } from "../../../services/api/uploadService";
import {
  submitPromotionRequest,
  getMyPromotionRequests,
  PromotionRequest,
} from "../../../services/api/promotionService";
import { useToast } from "../../../context/ToastContext";

export default function SellerPromotions() {
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [order, setOrder] = useState<number | undefined>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PromotionRequest[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getMyPromotionRequests();
        if (mounted) setRequests(data);
      } catch (error) {
        console.error("Failed to load promotion requests", error);
        showToast("Unable to fetch promotion history", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showToast]);

  const resetForm = () => {
    setTitle("");
    setLink("");
    setOrder(undefined);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast("Please enter a campaign title", "error");
      return;
    }
    if (!selectedFile) {
      showToast("Please select a banner image", "error");
      return;
    }

    setSubmitting(true);
    try {
      const uploadResult = await uploadImage(
        selectedFile,
        "Wasgro mart/promotion-banners"
      );
      const imageUrl = uploadResult.secureUrl || uploadResult.url;

      const created = await submitPromotionRequest({
        title: title.trim(),
        image: imageUrl,
        link: link.trim() || undefined,
        order,
      });

      setRequests((prev) => [created, ...prev]);
      showToast("Promotion request submitted for approval", "success");
      resetForm();
    } catch (error: any) {
      console.error("Failed to submit promotion", error);
      showToast(
        error?.response?.data?.message || "Failed to submit promotion request",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "Pending").length,
    [requests]
  );

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-4 sm:px-6 py-6 sm:py-8 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7c-.39.391-.902.586-1.414.586H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">
              Promotion Banners
            </h1>
            <p className="text-teal-100 text-xs sm:text-sm mt-0.5">
              Upload a banner and request admin approval for homepage visibility
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <FeatureGate featureName="Promotion Banner Campaigns">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Upload Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                  Submit Promotion Banner
                </h2>
                <span className="text-[11px] font-semibold text-neutral-500 bg-neutral-100 px-2 py-1 rounded-full">
                  {pendingCount} pending
                </span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                      Campaign Title *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={120}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="e.g. Summer Flash Sale"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-600 mb-1.5">
                      Redirect Link (optional)
                    </label>
                    <input
                      type="text"
                      value={link}
                      onChange={(e) => setLink(e.target.value)}
                      className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="/store/your-store or full URL"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div className="md:col-span-2">
                    <BannerUpload
                      previewUrl={previewUrl}
                      uploading={submitting}
                      onFileSelected={(file, preview) => {
                        setSelectedFile(file);
                        setPreviewUrl(preview);
                      }}
                      onRemove={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                      }}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl border border-teal-100 bg-teal-50/60">
                      <h3 className="text-xs font-bold text-teal-800 mb-1">
                        Upload Tips
                      </h3>
                      <p className="text-[11px] text-teal-700 leading-relaxed">
                        Use 1200×400px, less than 5MB. Keep text minimal and
                        high contrast.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50">
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        Display Order (optional)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={order ?? ""}
                        onChange={(e) =>
                          setOrder(
                            e.target.value === "" ? undefined : Number(e.target.value)
                          )
                        }
                        className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Lower number shows earlier"
                      />
                    </div>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors ${
                        submitting
                          ? "bg-teal-300 cursor-not-allowed"
                          : "bg-teal-600 hover:bg-teal-700"
                      }`}>
                      {submitting ? "Submitting..." : "Submit for Approval"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Status / History */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full"></span>
                  Request History
                </h2>
                <span className="text-[10px] font-semibold text-neutral-500">
                  Updated live
                </span>
              </div>

              {loading ? (
                <div className="text-xs text-neutral-500">Loading...</div>
              ) : requests.length === 0 ? (
                <div className="border border-neutral-100 rounded-xl p-6 text-center text-sm text-neutral-500 bg-neutral-50/60">
                  No promotion requests yet. Submit your first banner to appear
                  on the homepage after approval.
                </div>
              ) : (
                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {requests.map((req) => (
                    <div
                      key={req._id}
                      className="border border-neutral-100 rounded-xl p-3 flex items-start gap-3 bg-neutral-50/40">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                        <img
                          src={req.image}
                          alt={req.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-neutral-800 line-clamp-1">
                            {req.title}
                          </p>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              req.status === "Approved"
                                ? "bg-emerald-50 text-emerald-700"
                                : req.status === "Rejected"
                                  ? "bg-red-50 text-red-600"
                                  : "bg-amber-50 text-amber-700"
                            }`}>
                            {req.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
                          Link: {req.link || "Auto store link"}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-500">
                          <span>
                            {req.createdAt
                              ? new Date(req.createdAt).toLocaleDateString()
                              : "Just now"}
                          </span>
                          {typeof req.order === "number" && (
                            <span className="inline-flex items-center gap-1 bg-neutral-100 px-2 py-0.5 rounded-full text-[10px] font-semibold text-neutral-600">
                              Order {req.order}
                            </span>
                          )}
                          {req.rejectionReason && (
                            <span className="text-red-500">
                              Reason: {req.rejectionReason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </FeatureGate>
      </div>
    </div>
  );
}
