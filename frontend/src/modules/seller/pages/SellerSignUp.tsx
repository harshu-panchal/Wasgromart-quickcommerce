import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  register,
  sendOTP,
  verifyOTP,
} from "../../../services/api/auth/sellerAuthService";
import OTPInput from "../../../components/OTPInput";
import GoogleMapsAutocomplete from "../../../components/GoogleMapsAutocomplete";
import { useAuth } from "../../../context/AuthContext";
import {
  getHeaderCategoriesPublic,
  HeaderCategory,
} from "../../../services/api/headerCategoryService";
import LocationPickerMap from "../../../components/LocationPickerMap";
import { useEffect } from "react";

export default function SellerSignUp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    sellerName: "",
    mobile: "",
    email: "",
    storeName: "",
    category: "",
    categories: [] as string[],
    address: "",
    city: "",
    panCard: "",
    taxName: "",
    taxNumber: "",
    searchLocation: "",
    latitude: "",
    longitude: "",
    serviceRadiusKm: "10", // Default 10km
    accountName: "",
    bankName: "",
    branch: "",
    accountNumber: "",
    ifsc: "",
  });
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categories, setCategories] = useState<HeaderCategory[]>([]);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await getHeaderCategoriesPublic();
        if (Array.isArray(res)) {
          const published = res.filter((cat) => cat.status === "Published");

          // Ensure Medicines/Pharmacy is available
          const hasMedicines = published.some(
            (cat) =>
              cat.name.toLowerCase() === "medicines" ||
              cat.name.toLowerCase() === "pharmacy"
          );

          if (!hasMedicines) {
            published.push({
              _id: "medicine-manual-id",
              name: "Medicines",
              slug: "medicine",
              status: "Published",
              iconName: "medicine",
              iconLibrary: "lucide",
            } as any);
          }

          setCategories(published);
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
        // Fallback if API fails
        setCategories([
          {
            _id: "medicine-manual-id",
            name: "Medicines",
            slug: "medicine",
            status: "Published",
            iconName: "medicine",
            iconLibrary: "lucide",
          } as any,
        ]);
      }
    };
    fetchCats();
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "mobile") {
      setFormData((prev) => ({
        ...prev,
        [name]: value.replace(/\D/g, "").slice(0, 10),
      }));
    } else if (name === "serviceRadiusKm") {
      // Allow only numbers and a single decimal point
      const cleanedValue = value.replace(/[^0-9.]/g, "");
      // Ensure only one decimal point
      const parts = cleanedValue.split(".");
      const finalValue =
        parts.length > 2 ? `${parts[0]}.${parts[1]}` : cleanedValue;

      setFormData((prev) => ({
        ...prev,
        [name]: finalValue,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const toggleCategory = (cat: string) => {
    setFormData((prev) => {
      const exists = prev.categories.includes(cat);
      const nextCategories = exists
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat];
      return {
        ...prev,
        categories: nextCategories,
        category: nextCategories[0] || "",
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields (password removed - not needed during signup)
    if (!formData.sellerName) {
      setError("Please enter your name");
      return;
    }
    if (!formData.mobile) {
      setError("Please enter your mobile number");
      return;
    }
    if (!formData.email) {
      setError("Please enter your email address");
      return;
    }
    if (!formData.storeName) {
      setError("Please enter your store name");
      return;
    }
    if (formData.categories.length === 0) {
      setError("Please select at least one category");
      return;
    }
    if (!formData.address && !formData.searchLocation) {
      setError("Please select your store location");
      return;
    }
    if (!formData.city) {
      setError("Please enter your city");
      return;
    }

    if (formData.mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Validate location is selected
      if (
        !formData.searchLocation ||
        !formData.latitude ||
        !formData.longitude
      ) {
        setError("Please select your store location using the location search");
        return;
      }

      // Validate service radius
      const radius = parseFloat(formData.serviceRadiusKm);
      if (isNaN(radius) || radius < 0.1 || radius > 100) {
        setError("Service radius must be between 0.1 and 100 kilometers");
        return;
      }

      const response = await register({
        sellerName: formData.sellerName,
        mobile: formData.mobile,
        email: formData.email,
        storeName: formData.storeName,
        category: formData.categories[0], // primary
        categories: formData.categories,
        address: formData.address || formData.searchLocation,
        city: formData.city,
        searchLocation: formData.searchLocation,
        latitude: formData.latitude,
        longitude: formData.longitude,
        serviceRadiusKm: formData.serviceRadiusKm,
      });

      if (response.success) {
        // Clear token from registration (we'll get it after OTP verification)
        localStorage.removeItem("authToken");
        localStorage.removeItem("userData");
        // Registration successful, now send OTP for verification
        try {
          await sendOTP(formData.mobile);
          setShowOTP(true);
        } catch (otpErr: any) {
          setError(
            otpErr.response?.data?.message ||
            "Registration successful but failed to send OTP."
          );
        }
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await verifyOTP(formData.mobile, otp);
      if (response.success && response.data) {
        // Update auth context with seller data
        login(response.data.token, {
          id: response.data.user.id,
          name: response.data.user.sellerName,
          email: response.data.user.email,
          phone: response.data.user.mobile,
          userType: "Seller",
          storeName: response.data.user.storeName,
          status: response.data.user.status,
          address: response.data.user.address,
          city: response.data.user.city,
        });
        // Navigate to seller dashboard
        navigate("/seller", { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-[#0f2e20] via-[#1a4a33] to-[#0c831f]">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-green-500/20 blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-teal-400/20 blur-[120px] animate-pulse delay-700" />
      <div className="absolute top-[40%] left-[20%] w-[300px] h-[300px] rounded-full bg-emerald-400/10 blur-[80px]" />

      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
        aria-label="Back">
        <svg
          width="20"
          height="20"
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

      {/* Glassmorphism Card */}
      <div className="w-full max-w-md relative z-10 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden animate-fade-in-up">
        {/* Header Section */}
        <div className="p-6 relative text-center">
          <div className="flex flex-col items-center mb-2">
            <div className="relative mb-2 group">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-xl transform group-hover:scale-110 transition-transform duration-500" />
              <img
                src="/assets/wasgromart-black-text-removebg-preview.png"
                alt="Wasgro mart"
                className="h-40 w-auto object-contain relative z-10 drop-shadow-lg transform hover:scale-105 transition-transform duration-300"
              />
            </div>
            {!showOTP && (
              <div className="space-y-0.5">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Seller Sign Up
                </h1>
                <p className="text-green-100/80 text-xs font-medium">
                  Create your seller account
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sign Up Form */}
        <div
          className="px-6 pb-6 space-y-4 seller-signup-form"
          style={{
            maxHeight: "70vh",
            overflowY: "auto",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}>
          <style>{`
            .seller-signup-form::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {!showOTP ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Required Fields Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-white/90 border-b border-white/20 pb-2">
                  Required Information
                </h3>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1.5">
                    Seller Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="sellerName"
                    value={formData.sellerName}
                    onChange={handleInputChange}
                    placeholder="Enter your name"
                    required
                    className="w-full px-3 py-2.5 text-sm rounded-lg bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium shadow-inner"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1.5">
                    Mobile Number <span className="text-red-400">*</span>
                  </label>
                  <div className="flex items-center rounded-lg overflow-hidden border border-white/10 bg-black/20 focus-within:border-green-400/50 focus-within:bg-black/30 transition-all">
                    <div className="px-3 py-2.5 text-sm font-medium text-white/60 border-r border-white/10">
                      +91
                    </div>
                    <input
                      type="tel"
                      name="mobile"
                      value={formData.mobile}
                      onChange={handleInputChange}
                      placeholder="Enter mobile number"
                      required
                      maxLength={10}
                      className="flex-1 px-3 py-2.5 text-sm bg-transparent text-white placeholder:text-white/30 focus:outline-none font-medium"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1.5">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter email address"
                    required
                    className="w-full px-3 py-2.5 text-sm rounded-lg bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium shadow-inner"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1.5">
                    Store Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="storeName"
                    value={formData.storeName}
                    onChange={handleInputChange}
                    placeholder="Enter store name"
                    required
                    className="w-full px-3 py-2.5 text-sm rounded-lg bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium shadow-inner"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1.5">
                    Categories <span className="text-red-400">*</span>
                  </label>
                  {categories.length === 0 ? (
                    <div className="text-sm text-white/50 py-2">
                      Loading categories...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border border-white/10 rounded-lg bg-black/10">
                      {categories.map((cat) => {
                        const checked = formData.categories.includes(cat.name);
                        return (
                          <label
                            key={cat._id}
                            className="flex items-center gap-2 text-sm text-white/80 cursor-pointer hover:bg-white/5 p-1 rounded transition-colors">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCategory(cat.name)}
                              disabled={loading}
                              className="h-4 w-4 text-green-500 border-white/30 rounded focus:ring-green-500 bg-black/30"
                            />
                            <span>{cat.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {formData.categories.length === 0 &&
                    categories.length > 0 && (
                      <p className="text-xs text-red-300 mt-1">
                        Select at least one category
                      </p>
                    )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1.5">
                    Store Location <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <GoogleMapsAutocomplete
                        value={formData.searchLocation}
                        onChange={(
                          address: string,
                          lat: number,
                          lng: number,
                          placeName: string,
                          components?: { city?: string; state?: string }
                        ) => {
                          setFormData((prev) => ({
                            ...prev,
                            searchLocation: address,
                            latitude: lat.toString(),
                            longitude: lng.toString(),
                            address: address,
                            city: components?.city || prev.city,
                          }));
                        }}
                        placeholder="Search your store location..."
                        disabled={loading}
                        required
                        className="!bg-black/20 !border-white/10 !text-white !placeholder-white/30 !rounded-lg focus:!border-green-400/50 focus:!bg-black/30"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (navigator.geolocation) {
                          setLoading(true);
                          navigator.geolocation.getCurrentPosition(
                            (position) => {
                              const lat = position.coords.latitude;
                              const lng = position.coords.longitude;
                              const locationStr = `${lat.toFixed(
                                6
                              )}, ${lng.toFixed(6)}`;
                              setFormData((prev) => ({
                                ...prev,
                                latitude: lat.toString(),
                                longitude: lng.toString(),
                                searchLocation: locationStr,
                                address: prev.address || locationStr, // Ensure address is not empty
                              }));
                              setLoading(false);
                            },
                            (error) => {
                              console.error(error);
                              setError("Unable to retrieve your location");
                              setLoading(false);
                            }
                          );
                        } else {
                          setError(
                            "Geolocation is not supported by your browser"
                          );
                        }
                      }}
                      className="p-2.5 bg-white/10 text-white rounded-lg border border-white/10 hover:bg-white/20 transition-colors"
                      title="Use Current Location">
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round">
                        <path d="M12 2a10 10 0 1 0 10 10 10 10 0 0 0-10-10zm0 16a6 6 0 1 1 6-6 6 6 0 0 1-6 6z" />
                        <path d="M12 8v8" />
                        <path d="M8 12h8" />
                      </svg>
                    </button>
                  </div>

                  {formData.latitude && formData.longitude ? (
                    <div className="mt-4 animate-fadeIn">
                      <p className="text-xs font-medium text-white/90 mb-2">
                        Exact Location{" "}
                        <span className="text-green-300 text-[10px] font-normal">
                          (Move the map to place the pin on your store's
                          entrance)
                        </span>
                      </p>
                      <div className="border border-white/20 rounded-lg overflow-hidden">
                        <LocationPickerMap
                          initialLat={parseFloat(formData.latitude)}
                          initialLng={parseFloat(formData.longitude)}
                          onLocationSelect={(lat, lng) => {
                            setFormData((prev) => ({
                              ...prev,
                              latitude: lat.toString(),
                              longitude: lng.toString(),
                            }));
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-white/50 text-center">
                        Selected Coordinates: {formData.latitude},{" "}
                        {formData.longitude}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-white/50 bg-white/5 p-2 rounded border border-white/10 text-center">
                      Search for a location or use the location button to view
                      the map and set exact coordinates.
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1.5">
                    Delivery/Service Radius (KM){" "}
                    <span className="text-red-400">*</span>
                    <span className="text-[10px] font-normal text-white/50 ml-1">
                      (Distance you can deliver)
                    </span>
                  </label>
                  <input
                    type="number"
                    name="serviceRadiusKm"
                    value={formData.serviceRadiusKm}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (["e", "E", "+", "-"].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Enter service radius in KM (e.g. 10)"
                    required
                    min="0.1"
                    max="100"
                    step="0.1"
                    className="w-full px-3 py-2.5 text-sm rounded-lg bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium shadow-inner"
                    disabled={loading}
                  />
                  <p className="mt-1 text-xs text-white/50">
                    Only customers within this radius can see and order your
                    products
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/80 mb-1.5">
                    City <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="Enter city"
                    required
                    className="w-full px-3 py-2.5 text-sm rounded-lg bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium shadow-inner"
                    disabled={loading}
                  />
                </div>

                {/* Hidden fields for coordinates */}
                <input
                  type="hidden"
                  name="latitude"
                  value={formData.latitude}
                />
                <input
                  type="hidden"
                  name="longitude"
                  value={formData.longitude}
                />
              </div>

              {/* Optional Fields Section */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="text-sm font-semibold text-white/90 border-b border-white/20 pb-2">
                  Optional Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1.5">
                      PAN Card
                    </label>
                    <input
                      type="text"
                      name="panCard"
                      value={formData.panCard}
                      onChange={handleInputChange}
                      placeholder="PAN Card Number"
                      className="w-full px-3 py-2.5 text-sm rounded-lg bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium shadow-inner"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1.5">
                      Tax Name
                    </label>
                    <input
                      type="text"
                      name="taxName"
                      value={formData.taxName}
                      onChange={handleInputChange}
                      placeholder="Tax Name"
                      className="w-full px-3 py-2.5 text-sm rounded-lg bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium shadow-inner"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1.5">
                      Tax Number
                    </label>
                    <input
                      type="text"
                      name="taxNumber"
                      value={formData.taxNumber}
                      onChange={handleInputChange}
                      placeholder="Tax Number"
                      className="w-full px-3 py-2.5 text-sm rounded-lg bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium shadow-inner"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1.5">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      name="ifsc"
                      value={formData.ifsc}
                      onChange={handleInputChange}
                      placeholder="IFSC Code"
                      className="w-full px-3 py-2.5 text-sm rounded-lg bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium shadow-inner"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-2 bg-red-500/20 border border-red-500/30 backdrop-blur-sm text-red-100 text-xs rounded-lg text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg overflow-hidden relative group ${!loading
                  ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-white/10 text-white/30 cursor-not-allowed border border-white/5"
                  }`}>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    "Sign Up"
                  )}
                </span>
              </button>

              {/* Login Link */}
              <div className="text-center pt-2">
                <p className="text-xs text-white/60">
                  Already have a seller account?{" "}
                  <button
                    type="button"
                    onClick={() => navigate("/seller/login")}
                    className="text-white hover:text-green-300 font-semibold hover:underline transition-colors">
                    Login
                  </button>
                </p>
              </div>
            </form>
          ) : (
            /* OTP Verification Form */
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-1">
                <h1 className="text-xl font-bold text-white">
                  Verify OTP
                </h1>
                <p className="text-xs text-green-100/80">
                  Enter the code sent to
                  <br />
                  <span className="font-semibold text-white text-base tracking-wider">
                    +91 {formData.mobile}
                  </span>
                </p>
              </div>

              <div className="flex justify-center py-2">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                  <OTPInput onComplete={handleOTPComplete} disabled={loading} />
                </div>
              </div>

              {error && (
                <div className="p-2 bg-red-500/20 border border-red-500/30 backdrop-blur-sm text-red-100 text-xs rounded-lg text-center">
                  {error}
                </div>
              )}

              <div className="gap-2 grid grid-cols-2">
                <button
                  onClick={() => {
                    setShowOTP(false);
                    setError("");
                  }}
                  disabled={loading}
                  className="py-2.5 rounded-lg text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 border border-white/10 transition-all active:scale-95">
                  Back
                </button>
                <button
                  onClick={async () => {
                    setLoading(true);
                    setError("");
                    try {
                      await sendOTP(formData.mobile);
                    } catch (err: any) {
                      setError(
                        err.response?.data?.message || "Failed to resend OTP."
                      );
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="py-2.5 rounded-lg text-xs font-semibold text-green-400 hover:text-green-300 hover:bg-green-500/10 border border-green-500/20 transition-all active:scale-95">
                  {loading ? "Sending..." : "Resend OTP"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-black/20 border-t border-white/10 text-center backdrop-blur-md">
          <p className="text-[9px] text-white/50">
            By continuing, you agree to Wasgro mart's Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
