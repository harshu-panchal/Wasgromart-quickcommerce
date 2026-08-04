import React, { useState } from "react";
import { motion } from "framer-motion";

interface MaintenanceScreenProps {
  appName?: string;
  message?: string;
  supportEmail?: string;
  supportPhone?: string;
  onRefresh?: () => Promise<void>;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({
  appName = "Wasgromart",
  message = "Our app is currently undergoing scheduled maintenance to improve your experience. We'll be back online shortly!",
  supportEmail = "support@wasgromart.com",
  supportPhone = "+91 95792 57390",
  onRefresh,
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) {
      window.location.reload();
      return;
    }
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-10 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glass Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-lg bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-3xl p-8 sm:p-10 shadow-2xl shadow-emerald-950/20 text-center relative z-10"
      >
        {/* Animated Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-6">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Maintenance Underway
        </div>

        {/* Icon Illustration */}
        <div className="relative w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/30"
          />
          <div className="w-20 h-20 bg-gradient-to-tr from-emerald-600/20 to-teal-500/20 rounded-2xl border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <svg
              className="w-10 h-10 animate-bounce"
              style={{ animationDuration: "2.5s" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-3">
          {appName} is Under Maintenance
        </h1>

        {/* Custom Message */}
        <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8 bg-slate-800/40 p-4 rounded-xl border border-slate-700/50">
          {message}
        </p>

        {/* Action Button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all duration-200 flex items-center justify-center gap-2.5 disabled:opacity-75 cursor-pointer active:scale-[0.98]"
        >
          <svg
            className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          {refreshing ? "Checking Status..." : "Check Status"}
        </button>

        {/* Support Section */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-slate-400">
          {supportEmail && (
            <a
              href={`mailto:${supportEmail}`}
              className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <span>{supportEmail}</span>
            </a>
          )}
          {supportPhone && (
            <a
              href={`tel:${supportPhone}`}
              className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors"
            >
              <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>{supportPhone}</span>
            </a>
          )}
        </div>
      </motion.div>

      {/* Footer Branding */}
      <p className="text-xs text-slate-600 mt-6 relative z-10 flex items-center gap-1">
        <span>Secure Operations & Services &copy; {new Date().getFullYear()} {appName}</span>
      </p>
    </div>
  );
};

export default MaintenanceScreen;
