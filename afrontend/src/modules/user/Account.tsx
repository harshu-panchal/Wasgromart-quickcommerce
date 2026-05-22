import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  getProfile,
  CustomerProfile,
  updateProfile,
  sendWelcomeNotification,
} from "../../services/api/customerService";
import { uploadImage } from "../../services/api/uploadService";

export default function Account() {
  const navigate = useNavigate();
  const { user, logout: authLogout } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showGstModal, setShowGstModal] = useState(false);
  const [gstNumber, setGstNumber] = useState("");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    profilePhoto: "",
    gstNumber: "",
  });
  const [updateError, setUpdateError] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await getProfile();
        if (response.success) {
          setProfile(response.data);
          setEditFormData({
            name: response.data.name || "",
            email: response.data.email || "",
            phone: response.data.phone || "",
            dateOfBirth: response.data.dateOfBirth
              ? response.data.dateOfBirth.split("T")[0]
              : "",
            address: response.data.address || "",
            city: response.data.city || "",
            state: response.data.state || "",
            pincode: response.data.pincode || "",
            profilePhoto: response.data.profilePhoto || "",
            gstNumber: response.data.gstNumber || "",
          });
          setGstNumber(response.data.gstNumber || "");
        } else {
          setError("Failed to load profile");
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load profile");
        if (err.response?.status === 401 || err.response?.status === 404) {
          authLogout();
        }
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user, navigate, authLogout]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    const date = new Date(dateString);
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const confirmLogout = () => {
    authLogout();
    navigate("/login");
  };

  const handleSendWelcomeNotification = async () => {
    try {
      setSendingNotification(true);
      setNotificationMessage("");
      const response = await sendWelcomeNotification();
      if (response.success) {
        setNotificationMessage("Welcome notification sent successfully! 🎉");
      } else {
        setNotificationMessage(response.message);
      }
    } catch (err: any) {
      setNotificationMessage(
        err.response?.data?.message || "Failed to send notification",
      );
    } finally {
      setSendingNotification(false);
    }
  };

  const handleGstSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // GST Validation: 15 characters alphanumeric
    if (gstNumber.length !== 15) {
      setUpdateError("GST number must be 15 characters long");
      return;
    }

    try {
      setEditingProfile(true);
      const response = await updateProfile({
        gstNumber: gstNumber.toUpperCase(),
      });
      if (response.success) {
        setProfile(response.data);
        setShowGstModal(false);
        setUpdateError("");
      }
    } catch (err: any) {
      setUpdateError(err.response?.data?.message || "Failed to update GST");
    } finally {
      setEditingProfile(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditingProfile(true);
    setUpdateError("");

    try {
      // Basic validation
      if (!editFormData.name.trim()) {
        setUpdateError("Name is required");
        setEditingProfile(false);
        return;
      }

      if (
        editFormData.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFormData.email)
      ) {
        setUpdateError("Invalid email format");
        setEditingProfile(false);
        return;
      }

      if (editFormData.phone && !/^[0-9]{10}$/.test(editFormData.phone)) {
        setUpdateError("Phone number must be 10 digits");
        setEditingProfile(false);
        return;
      }

      const response = await updateProfile({
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone,
        dateOfBirth: editFormData.dateOfBirth,
        address: editFormData.address,
        city: editFormData.city,
        state: editFormData.state,
        pincode: editFormData.pincode,
        profilePhoto: editFormData.profilePhoto,
      });

      if (response.success) {
        setProfile(response.data);
        setShowProfileModal(false);
      } else {
        setUpdateError(response.message || "Failed to update profile");
      }
    } catch (err: any) {
      setUpdateError(err.response?.data?.message || "Something went wrong");
    } finally {
      setEditingProfile(false);
    }
  };

  // Show login/signup prompt for unregistered users
  if (!user) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen">
        <div className="bg-gradient-to-b from-green-200 via-green-100 to-white pb-6 md:pb-8 pt-12 md:pt-16">
          <div className="px-4 md:px-6 lg:px-8">
            <button
              onClick={() => navigate(-1)}
              className="mb-4 text-neutral-900"
              aria-label="Back">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 18L9 12L15 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className="flex flex-col items-center mb-4 md:mb-6">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-neutral-200 flex items-center justify-center mb-3 md:mb-4 border-2 border-white shadow-sm">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-neutral-500 md:w-12 md:h-12">
                  <path
                    d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="7"
                    r="4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-neutral-900 mb-2">
                Welcome!
              </h1>
              <p className="text-sm md:text-base text-neutral-600 text-center px-4">
                Login to access your profile, orders, and more
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 lg:px-8 mt-6">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => navigate("/login")}
              className="w-full py-3.5 rounded-lg font-semibold text-base bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20">
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-neutral-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="pb-24 md:pb-8 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-teal-600 text-white rounded">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayName = profile?.name || user?.name || "User";
  const displayPhone = profile?.phone || user?.phone || "";
  const displayDateOfBirth = profile?.dateOfBirth;

  return (
    <div className="pb-24 md:pb-8 bg-white min-h-screen">
      <div className="bg-gradient-to-b from-green-200 via-green-100 to-white pb-6 md:pb-8 pt-12 md:pt-16">
        <div className="px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate(-1)}
              className="text-neutral-900"
              aria-label="Back">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15 18L9 12L15 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-full flex flex-col items-center mb-4 md:mb-6 group cursor-pointer outline-none active:scale-95 transition-transform">
            <div className="relative">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-neutral-200 flex items-center justify-center mb-3 md:mb-4 border-2 border-white shadow-sm overflow-hidden group-hover:border-teal-400/50 transition-colors">
                {profile?.profilePhoto ? (
                  <img
                    src={profile.profilePhoto}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-neutral-500 md:w-12 md:h-12">
                    <path
                      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle
                      cx="12"
                      cy="7"
                      r="4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-white">
                    <path
                      d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
              <div className="absolute -right-1 -bottom-1 bg-white p-1.5 rounded-full shadow-md border border-neutral-100 md:p-2">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-teal-600 md:w-4 md:h-4">
                  <path
                    d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-neutral-900 mb-1 group-hover:text-teal-700 transition-colors">
              {displayName}
            </h1>
            <div className="flex flex-col items-center gap-1.5 md:gap-2 text-xs md:text-sm text-neutral-600">
              {displayPhone && (
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{displayPhone}</span>
                </div>
              )}
              {displayDateOfBirth && (
                <div className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect
                      x="3"
                      y="4"
                      width="18"
                      height="18"
                      rx="2"
                      ry="2"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <line
                      x1="16"
                      y1="2"
                      x2="16"
                      y2="6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <line
                      x1="8"
                      y1="2"
                      x2="8"
                      y2="6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <line
                      x1="3"
                      y1="10"
                      x2="21"
                      y2="10"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>{formatDate(displayDateOfBirth)}</span>
                </div>
              )}
              <span className="mt-1 text-[10px] text-teal-600 font-medium bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100 opacity-0 group-hover:opacity-100 transition-opacity">
                Click to Edit
              </span>
            </div>
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6 lg:px-8 -mt-4 md:-mt-6 mb-4 md:mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-6 max-w-2xl md:mx-auto">
          <button
            onClick={() => navigate("/orders")}
            className="bg-white rounded-lg border border-neutral-200 p-3 md:p-4 hover:shadow-md transition-shadow text-center outline-none">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="mx-auto mb-1.5 md:mb-2 text-neutral-700 md:w-6 md:h-6">
              <path
                d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1="3"
                y1="6"
                x2="21"
                y2="6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M16 10a4 4 0 0 1-8 0"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="text-[10px] md:text-xs font-semibold text-neutral-900">
              Your orders
            </div>
          </button>
          <button
            onClick={() => navigate("/faq")}
            className="bg-white rounded-lg border border-neutral-200 p-3 md:p-4 hover:shadow-md transition-shadow text-center outline-none">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="mx-auto mb-1.5 md:mb-2 text-neutral-700 md:w-6 md:h-6">
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="text-[10px] md:text-xs font-semibold text-neutral-900">
              Need help?
            </div>
          </button>
          <button
            onClick={handleSendWelcomeNotification}
            disabled={sendingNotification}
            className="bg-white rounded-lg border border-neutral-200 p-3 md:p-4 hover:shadow-md transition-shadow text-center outline-none disabled:opacity-50">
            {sendingNotification ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mx-auto mb-1.5 md:mb-2"></div>
            ) : (
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="mx-auto mb-1.5 md:mb-2 text-neutral-700 md:w-6 md:h-6">
                <path
                  d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.73 21a2 2 0 0 1-3.46 0"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <div className="text-[10px] md:text-xs font-semibold text-neutral-900">
              {sendingNotification ? "Sending..." : "Welcome"}
            </div>
          </button>
        </div>
        {notificationMessage && (
          <div
            className={`mt-4 p-3 rounded-lg text-center text-sm ${notificationMessage.includes("successfully") ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {notificationMessage}
          </div>
        )}
      </div>

      <div className="px-4 py-2.5">
        <h2 className="text-xs font-bold text-neutral-900 mb-2 uppercase tracking-wide">
          Your information
        </h2>
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden divide-y divide-neutral-100">
          <button
            onClick={() => navigate("/address-book")}
            className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="text-neutral-500">
                <path
                  d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[13px] font-medium text-neutral-900">
                Address Book
              </span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button
            onClick={() => navigate("/wishlist")}
            className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="text-neutral-500">
                <path
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[13px] font-medium text-neutral-900">
                Your Wishlist
              </span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button
            onClick={() => setShowGstModal(true)}
            className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="text-neutral-500">
                <path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points="14 2 14 8 20 8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[13px] font-medium text-neutral-900">
                GST Details
              </span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button
            onClick={() => navigate("/about-us")}
            className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="text-neutral-500">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="12"
                  y1="16"
                  x2="12"
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="12"
                  y1="8"
                  x2="12.01"
                  y2="8"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
              <span className="text-[13px] font-medium text-neutral-900">
                About Us
              </span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center justify-between px-3 py-3 hover:bg-neutral-50 transition-colors">
            <div className="flex items-center gap-3">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                className="text-red-500">
                <path
                  d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points="16 17 21 12 16 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1="21"
                  y1="12"
                  x2="9"
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[13px] font-medium text-red-500">
                Log Out
              </span>
            </div>
            <span className="text-neutral-400">›</span>
          </button>
        </div>
      </div>

      {showGstModal && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowGstModal(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[101] animate-in slide-in-from-bottom duration-500 ease-out">
            <div className="bg-white rounded-t-[32px] shadow-2xl max-w-lg mx-auto p-6 pt-10 pb-24 relative">
              <button
                onClick={() => setShowGstModal(false)}
                className="absolute -top-12 right-4 w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="text-center">
                <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-neutral-50 border border-neutral-100 flex items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-10 h-10 text-neutral-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5">
                    <rect x="5" y="3" width="14" height="18" rx="2" ry="2" />
                    <line x1="9" y1="7" x2="15" y2="7" />
                    <line x1="9" y1="11" x2="15" y2="11" />
                    <line x1="9" y1="15" x2="13" y2="15" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  Add GST Details
                </h3>
                <p className="text-[13px] text-neutral-500 mb-8 px-4">
                  Identify your business to get a GST invoice on your business
                  purchases.
                </p>

                {updateError && (
                  <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-[11px] rounded-lg flex items-center gap-2 animate-shake mx-4 text-left">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 8v4M12 16h.01"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    {updateError}
                  </div>
                )}

                <form onSubmit={handleGstSubmit} className="space-y-4 px-4">
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => {
                      setGstNumber(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                          .slice(0, 15),
                      );
                      if (updateError) setUpdateError("");
                    }}
                    placeholder="Enter 15-digit GST Number"
                    className="w-full rounded-xl border border-neutral-200 px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-mono"
                    maxLength={15}
                  />
                  <button
                    type="submit"
                    disabled={gstNumber.length !== 15 || editingProfile}
                    className="w-full rounded-xl bg-teal-600 text-white font-bold py-4 hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-lg shadow-teal-500/20 uppercase tracking-wider text-sm">
                    {editingProfile ? "Saving..." : "Save Details"}
                  </button>
                </form>
                <p className="mt-6 text-[11px] text-neutral-400">
                  By continuing, you agree to our{" "}
                  <span className="underline">Terms & Conditions</span>
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit Profile Modal */}
      {showProfileModal && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowProfileModal(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-[101] animate-in slide-in-from-bottom duration-500 ease-out">
            <div className="bg-white rounded-t-[32px] shadow-2xl max-w-lg mx-auto p-6 pt-10 pb-24 relative">
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute -top-12 right-4 w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div>
                <h3 className="text-xl font-bold text-neutral-900 mb-6 px-2">
                  Edit Profile
                </h3>

                {updateError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg flex items-center gap-2 animate-shake">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 8v4M12 16h.01"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                    {updateError}
                  </div>
                )}

                <form
                  onSubmit={handleProfileUpdate}
                  className="space-y-5 max-h-[60vh] overflow-y-auto px-2 pb-4 scrollbar-hide">
                  {/* Profile Photo Upload */}
                  <div className="flex flex-col items-center gap-3 mb-2">
                    <div className="relative group/photo">
                      <div className="w-20 h-20 rounded-full bg-neutral-100 border-2 border-dashed border-neutral-300 flex items-center justify-center overflow-hidden">
                        {editFormData.profilePhoto ? (
                          <img
                            src={editFormData.profilePhoto}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="text-neutral-400">
                            <path
                              d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="12"
                              cy="13"
                              r="4"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                        {uploadingImage && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setUploadingImage(true);
                            try {
                              const result = await uploadImage(
                                file,
                                "customer_profiles",
                              );
                              setEditFormData({
                                ...editFormData,
                                profilePhoto: result.secureUrl,
                              });
                            } catch (err: any) {
                              setUpdateError("Image upload failed");
                            } finally {
                              setUploadingImage(false);
                            }
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={uploadingImage}
                      />
                      <div className="absolute -right-1 -bottom-1 bg-teal-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white group-hover/photo:scale-110 transition-transform">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none">
                          <path
                            d="M12 5v14M5 12h14"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    </div>
                    <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-wider">
                      Change Photo
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-500 ml-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={editFormData.name}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            name: e.target.value.replace(/[^a-zA-Z\s]/g, ""),
                          })
                        }
                        placeholder="Enter your name"
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-500 ml-1">
                        Phone Number
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-neutral-500 font-medium">
                          +91
                        </span>
                        <input
                          type="tel"
                          value={editFormData.phone}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              phone: e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 10),
                            })
                          }
                          placeholder="10-digit number"
                          className="w-full rounded-xl border border-neutral-200 pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                          maxLength={10}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-500 ml-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={editFormData.email}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            email: e.target.value,
                          })
                        }
                        placeholder="Enter your email"
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-500 ml-1">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        value={editFormData.dateOfBirth}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            dateOfBirth: e.target.value,
                          })
                        }
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-500 ml-1">
                        Flat / House No. / Building
                      </label>
                      <input
                        type="text"
                        value={editFormData.address}
                        onChange={(e) =>
                          setEditFormData({
                            ...editFormData,
                            address: e.target.value,
                          })
                        }
                        placeholder="Enter your address"
                        className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-500 ml-1">
                          City
                        </label>
                        <input
                          type="text"
                          value={editFormData.city}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              city: e.target.value,
                            })
                          }
                          placeholder="City"
                          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-neutral-500 ml-1">
                          Pincode
                        </label>
                        <input
                          type="text"
                          value={editFormData.pincode}
                          onChange={(e) =>
                            setEditFormData({
                              ...editFormData,
                              pincode: e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 6),
                            })
                          }
                          placeholder="6 digits"
                          className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                          maxLength={6}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={editingProfile || !editFormData.name.trim()}
                      className="w-full rounded-xl bg-teal-600 text-white font-bold py-4 hover:bg-teal-700 disabled:opacity-50 transition-all shadow-lg shadow-teal-500/20 uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                      {editingProfile ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 text-white"
                            viewBox="0 0 24 24"
                            fill="none">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Saving...
                        </>
                      ) : (
                        "Update Profile"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowLogoutModal(false)}
          />
          <div className="fixed inset-0 z-[111] flex items-center justify-center px-4 pointer-events-none">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-xs p-6 pt-8 animate-in zoom-in-95 duration-200 pointer-events-auto">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-red-500">
                    <path
                      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <polyline
                      points="16 17 21 12 16 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <line
                      x1="21"
                      y1="12"
                      x2="9"
                      y2="12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">
                  Logout Confirmation
                </h3>
                <p className="text-sm text-neutral-500 mb-8 px-2 leading-relaxed">
                  Are you sure you want to log out of your account?
                </p>
                <div className="grid grid-cols-2 gap-3 w-full">
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="w-full py-3.5 rounded-xl font-bold text-sm text-neutral-600 bg-neutral-50 hover:bg-neutral-100 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={confirmLogout}
                    className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 transition-colors">
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
