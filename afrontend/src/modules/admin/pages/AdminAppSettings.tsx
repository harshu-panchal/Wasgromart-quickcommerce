import { useState, useEffect } from "react";
import { useToast } from "../../../context/ToastContext";
import {
  getAppSettings,
  updateAppSettings,
  AppSettings,
} from "../../../services/api/admin/adminSettingsService";
import { motion } from "framer-motion";

const PRESET_MESSAGES = [
  "Our app is currently undergoing scheduled maintenance to improve performance. We'll be back shortly!",
  "We are upgrading our servers to bring you faster delivery and new features. Thank you for your patience!",
  "Temporary system maintenance is in progress. Orders will resume shortly.",
  "System update in progress. Please check back in a few minutes!",
];

export default function AdminAppSettings() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [appName, setAppName] = useState<string>("Wasgromart");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [supportEmail, setSupportEmail] = useState<string>("");
  const [supportPhone, setSupportPhone] = useState<string>("");

  // Maintenance Mode State
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>("");

  // Feature Flags State
  const [features, setFeatures] = useState({
    sellerRegistration: true,
    productApproval: true,
    orderTracking: true,
    wallet: true,
    coupons: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await getAppSettings();
      if (response && response.success && response.data) {
        const data = response.data;
        setAppName(data.appName || "Wasgromart");
        setContactEmail(data.contactEmail || "");
        setContactPhone(data.contactPhone || "");
        setSupportEmail(data.supportEmail || "");
        setSupportPhone(data.supportPhone || "");
        setMaintenanceMode(!!data.maintenanceMode);
        setMaintenanceMessage(
          data.maintenanceMessage || PRESET_MESSAGES[0]
        );
        if (data.features) {
          setFeatures(data.features);
        }
      }
    } catch (error: any) {
      console.error(error);
      showToast(error.message || "Failed to fetch app settings", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updatePayload: any = {
        appName,
        contactEmail,
        contactPhone,
        supportEmail,
        supportPhone,
        maintenanceMode,
        maintenanceMessage,
        features,
      };

      const response = await updateAppSettings(updatePayload);
      if (response.success) {
        showToast("App settings & maintenance mode updated successfully!");
      } else {
        showToast("Failed to update settings", "error");
      }
    } catch (error: any) {
      console.error(error);
      showToast(
        error.response?.data?.message || "Error updating app settings",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 min-h-[400px]">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 text-sm">Loading app configuration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800">
              App & Maintenance Settings
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Control customer app maintenance status, app details, and public notice messages.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all cursor-pointer disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          {saving ? "Saving Changes..." : "Save Settings"}
        </button>
      </div>

      {/* 1. Maintenance Mode Master Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border transition-all duration-300 p-6 ${
          maintenanceMode
            ? "bg-amber-500/5 border-amber-300 shadow-md shadow-amber-500/5"
            : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-3 rounded-xl mt-0.5 ${
                maintenanceMode
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                <line x1="12" y1="2" x2="12" y2="12" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900">
                  Customer App Maintenance Mode
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    maintenanceMode
                      ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  }`}
                >
                  {maintenanceMode ? "Maintenance Active" : "App Live & Operational"}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                When enabled, non-admin customers viewing the app will be presented with a full-screen Maintenance View preventing new orders.
              </p>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <span className="text-sm font-semibold text-slate-700">
              {maintenanceMode ? "Enabled" : "Disabled"}
            </span>
            <button
              type="button"
              onClick={() => setMaintenanceMode(!maintenanceMode)}
              className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                maintenanceMode ? "bg-amber-500" : "bg-slate-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  maintenanceMode ? "translate-x-7" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Maintenance Message Settings */}
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-slate-800">
            Maintenance Message Displayed to Customers
          </label>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 self-center flex items-center gap-1 font-medium mr-1">
              Quick Presets:
            </span>
            {PRESET_MESSAGES.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setMaintenanceMessage(preset)}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                Preset {idx + 1}
              </button>
            ))}
          </div>

          <textarea
            rows={3}
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            placeholder="Enter custom maintenance message..."
            className="w-full p-3.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 transition-all outline-none"
          />
        </div>
      </motion.div>

      {/* 2. General App & Support Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-slate-800 border-b pb-3">
            <span>App Branding & Information</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              App Name
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Support Email
            </label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@wasgromart.com"
              className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Support Phone
            </label>
            <input
              type="text"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              placeholder="+91 95792 57390"
              className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* 3. Feature Controls */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 font-bold text-slate-800 border-b pb-3">
            <span>Feature Flags</span>
          </div>

          <div className="space-y-3">
            {Object.entries(features).map(([key, enabled]) => (
              <div
                key={key}
                className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/60"
              >
                <span className="text-xs font-semibold text-slate-700 capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) =>
                    setFeatures({ ...features, [key]: e.target.checked })
                  }
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
