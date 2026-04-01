import BannerUpload from "../../../components/subscription/BannerUpload";
import FeatureGate from "../../../components/subscription/FeatureGate";

export default function SellerPromotions() {
  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-4 sm:px-6 py-6 sm:py-8 shadow-md">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 0 1 0 2.828l-7 7c-.39.391-.902.586-1.414.586H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" />
                </svg>
            </div>
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  Promotion Banners
                </h1>
                <p className="text-teal-100 text-xs sm:text-sm mt-0.5">
                  Boost your store visibility with custom banners
                </p>
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <FeatureGate featureName="Promotion Banner Campaigns">
          <div className="grid grid-cols-1 gap-6">
            {/* Upload Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
                 <h2 className="text-sm font-bold text-neutral-800 mb-4 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                    Upload New Banner
                 </h2>
                 <div className="max-w-2xl">
                    <BannerUpload />
                 </div>
                 <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/50">
                        <h3 className="text-xs font-bold text-teal-800 mb-1 italic">Best Practice</h3>
                        <p className="text-[11px] text-teal-700 leading-relaxed">
                            Use high-quality images (1200x400px) with clear text for better customer engagement.
                        </p>
                    </div>
                    <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
                        <h3 className="text-xs font-bold text-emerald-800 mb-1 italic">Placement</h3>
                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                            Your active banner will appear on the store homepage and brand collection sections.
                        </p>
                    </div>
                 </div>
            </div>

            {/* Campaign History / Active Banner Preview */}
            <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full"></span>
                        Active Campaign
                    </h2>
                    <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">Coming Soon: Analytics</span>
                </div>
                
                <div className="border border-neutral-100 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-neutral-50/50">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3 text-neutral-300">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xs font-semibold text-neutral-500">No active campaign history found</h3>
                    <p className="text-[10px] text-neutral-400 mt-1">Upload a banner above to start your first promotion.</p>
                </div>
            </div>
          </div>
        </FeatureGate>
      </div>
    </div>
  );
}
