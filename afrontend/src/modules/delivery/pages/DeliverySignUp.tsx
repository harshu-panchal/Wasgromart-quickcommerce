import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  register,
  sendOTP,
  verifyOTP,
} from "../../../services/api/auth/deliveryAuthService";
import { uploadDocument } from "../../../services/api/uploadService";
import { validateDocumentFile } from "../../../utils/imageUpload";
import OTPInput from "../../../components/OTPInput";
import { useAuth } from "../../../context/AuthContext";
import logo from "@assets/wasgromart-black-text-removebg-preview.png";

export default function DeliverySignUp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem("delivery_signup_draft");
    const defaultData = {
      name: "",
      mobile: "",
      email: "",
      dateOfBirth: "",
      address: "",
      city: "",
      pincode: "",
      drivingLicenseUrl: "",
      nationalIdentityCardUrl: "",
      accountName: "",
      bankName: "",
      accountNumber: "",
      ifscCode: "",
      bonusType: "",
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure password is not stored/restored
        return { ...defaultData, ...parsed, password: "" };
      } catch {
        return defaultData;
      }
    }
    return defaultData;
  });

  useEffect(() => {
    // Save draft
    const { ...draftData } = formData;
    localStorage.setItem("delivery_signup_draft", JSON.stringify(draftData));
  }, [formData]);

  // File state for UI
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<File | null>(
    null
  );
  const [nationalIdentityCardFile, setNationalIdentityCardFile] =
    useState<File | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCityLoading, setIsCityLoading] = useState(false);

  const bonusTypes = [
    "Select Bonus Type",
    "Fixed or Salaried",
    "Fixed",
    "Salaried",
    "Commission Based",
  ];

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "mobile") {
      setFormData((prev: typeof formData) => ({
        ...prev,
        [name]: value.replace(/\D/g, "").slice(0, 10),
      }));
    } else if (name === "name" || name === "city" || name === "accountName" || name === "bankName") {
      setFormData((prev: typeof formData) => ({
        ...prev,
        [name]: value.replace(/[^a-zA-Z\s]/g, ""),
      }));
    } else if (name === "pincode") {
      setFormData((prev: typeof formData) => ({
        ...prev,
        [name]: value.replace(/\D/g, "").slice(0, 6),
      }));
    } else if (name === "ifscCode") {
      setFormData((prev: typeof formData) => ({
        ...prev,
        [name]: value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 11),
      }));
    } else {
      setFormData((prev: typeof formData) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const blockNonDigits = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: Backspace, Tab, End, Home, Left, Right, Delete
    const allowedKeys = [
      "Backspace",
      "Tab",
      "End",
      "Home",
      "ArrowLeft",
      "ArrowRight",
      "Delete",
    ];
    if (
      !/^\d$/.test(e.key) &&
      !allowedKeys.includes(e.key) &&
      !e.ctrlKey &&
      !e.metaKey
    ) {
      e.preventDefault();
    }
  };

  const blockNonAlphabets = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const char = e.key;
    if (
      !/^[a-zA-Z\s]$/.test(char) &&
      char !== "Backspace" &&
      char !== "Tab" &&
      char !== "Delete" &&
      char !== "ArrowLeft" &&
      char !== "ArrowRight"
    ) {
      e.preventDefault();
    }
  };

  const fetchCityFromLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsCityLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${
              import.meta.env.VITE_GOOGLE_MAPS_API_KEY
            }`
          );
          const data = await response.json();
          if (data.status === "OK" && data.results && data.results.length > 0) {
            let city = "";
            let pincode = "";

            // Iterate through results to find missing components
            for (const result of data.results) {
              for (const component of result.address_components) {
                const types = component.types;
                if (!city && (types.includes("locality") || types.includes("sublocality_level_1") || types.includes("administrative_area_level_2") || types.includes("administrative_area_level_3"))) {
                  city = component.long_name;
                }
                if (!pincode && types.includes("postal_code")) {
                  pincode = component.long_name;
                }
              }
              if (city && pincode) break;
            }

            // Regex fallback for pincode
            if (!pincode && data.results[0].formatted_address) {
              const match = data.results[0].formatted_address.match(/\b\d{6}\b/);
              if (match) pincode = match[0];
            }

            setFormData((prev: typeof formData) => ({
              ...prev,
              city: (city.replace(/[^a-zA-Z\s]/g, "") || prev.city),
              pincode: (pincode.replace(/\D/g, "").slice(0, 6) || prev.pincode),
            }));
          } else {
            setError("Could not fetch city from your location");
          }
        } catch (err) {
          setError("Failed to fetch city details");
        } finally {
          setIsCityLoading(false);
        }
      },
      (err) => {
        setError("Location access denied. Please type your city manually.");
        setIsCityLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, files } = e.target;
    if (!files || !files[0]) return;

    const file = files[0];
    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid document file");
      return;
    }

    if (name === "drivingLicense") {
      setDrivingLicenseFile(file);
    } else if (name === "nationalIdentityCard") {
      setNationalIdentityCardFile(file);
    }
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (
      !formData.name ||
      !formData.mobile ||
      !formData.email ||
      !formData.address ||
      !formData.city
    ) {
      setError("Please fill all required fields");
      return;
    }

    if (formData.mobile.length !== 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Invalid Email Address");
      return;
    }

    // IFSC Code validation if provided
    if (formData.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode)) {
      setError("Invalid IFSC Code");
      return;
    }

    // Bank Name validation if provided
    if (formData.bankName && /[^a-zA-Z\s]/.test(formData.bankName)) {
      setError("Bank Name must contain only alphabets");
      return;
    }


    setLoading(true);
    setError("");

    try {
      // Upload documents if provided
      let drivingLicenseUrl = formData.drivingLicenseUrl;
      let nationalIdentityCardUrl = formData.nationalIdentityCardUrl;

      if (drivingLicenseFile || nationalIdentityCardFile) {
        setUploadingDocs(true);

        if (drivingLicenseFile) {
          const drivingLicenseResult = await uploadDocument(
            drivingLicenseFile,
            "wasgro-mart/delivery/documents"
          );
          drivingLicenseUrl = drivingLicenseResult.secureUrl;
        }

        if (nationalIdentityCardFile) {
          const nationalIdResult = await uploadDocument(
            nationalIdentityCardFile,
            "wasgro-mart/delivery/documents"
          );
          nationalIdentityCardUrl = nationalIdResult.secureUrl;
        }

        setUploadingDocs(false);
      }

      const response = await register({
        name: formData.name,
        mobile: formData.mobile,
        email: formData.email,
        dateOfBirth: formData.dateOfBirth || undefined,
        address: formData.address,
        city: formData.city,
        pincode: formData.pincode || undefined,
        drivingLicense: drivingLicenseUrl || undefined,
        nationalIdentityCard: nationalIdentityCardUrl || undefined,
        accountName: formData.accountName || undefined,
        bankName: formData.bankName || undefined,
        accountNumber: formData.accountNumber || undefined,
        ifscCode: formData.ifscCode || undefined,
        bonusType: formData.bonusType || undefined,
      });

      if (response.success) {
        // Clear token from registration (we'll get it after OTP verification)
        localStorage.removeItem("authToken");
        localStorage.removeItem("userData");
        // Registration successful, now send SMS OTP for verification
        try {
          const otpRes = await sendOTP(formData.mobile);
          if (otpRes.sessionId) setSessionId(otpRes.sessionId);
          setShowOTP(true);
        } catch (otpErr: any) {
          setError(
            otpErr.message || "Registration successful but failed to send OTP."
          );
        }
      }
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await verifyOTP(formData.mobile, otp, sessionId);
      if (response.success && response.data) {
        // Update auth context
        login(response.data.token, {
          ...response.data.user,
          userType: "Delivery",
        });

        // FCM token registration is handled globally by App.tsx when auth state changes
        // No need to call registerFCMToken here - it would cause duplicate notifications

        localStorage.removeItem("delivery_signup_draft");
        navigate("/delivery");
      }
    } catch (err: any) {
      setError(err.message || "Invalid OTP. Please try again.");
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
        aria-label="Back"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M15 18L9 12L15 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "white" }}
          />
        </svg>
      </button>

      {/* Glassmorphism Card */}
      <div className="w-full max-w-md relative z-10 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-[0_8px_32_0_rgba(0,0,0,0.36)] overflow-hidden animate-fade-in-up">
        <div className="p-6 relative">
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-4">
            <div className="relative mb-2 group">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-xl transform group-hover:scale-110 transition-transform duration-500" />
              <img
                src={logo}
                alt="Wasgro Mart"
                className="h-32 w-auto object-contain relative z-10 drop-shadow-lg transform hover:scale-105 transition-transform duration-300"
              />
            </div>
            {!showOTP && (
              <div className="text-center space-y-0.5">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Delivery Sign Up
                </h1>
                <p className="text-green-100/80 text-xs font-medium">
                  Create your delivery partner account
                </p>
              </div>
            )}
          </div>

          {/* Form Content - Scrollable */}
          <div
            className="space-y-4 delivery-signup-form overflow-y-auto px-1"
            style={{
              maxHeight: "60vh",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          >
            <style>{`.delivery-signup-form::-webkit-scrollbar { display: none; }`}</style>

            {!showOTP ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-green-300 uppercase tracking-widest border-b border-white/10 pb-2">
                    Personal Information
                  </h3>

                  <div className="space-y-3">
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        onKeyPress={blockNonAlphabets}
                        placeholder="Full Name *"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                        disabled={loading}
                        autoComplete="off"
                      />

                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                        <span className="text-white/60 font-medium pr-2 border-r border-white/20 text-sm">
                          +91
                        </span>
                      </div>
                      <input
                        type="tel"
                        name="mobile"
                        value={formData.mobile}
                        onChange={handleInputChange}
                        placeholder="Mobile Number *"
                        required
                        maxLength={10}
                        autoComplete="off"
                        className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                        disabled={loading}
                      />
                    </div>

                    <div className="space-y-1">
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        placeholder="Email Address *"
                        required
                        className={`w-full px-4 py-3 rounded-xl bg-black/20 border text-white placeholder:text-white/30 focus:outline-none focus:bg-black/30 transition-all font-medium text-sm shadow-inner ${
                          formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
                            ? "border-red-400/50 focus:border-red-400"
                            : "border-white/10 focus:border-green-400/50"
                        }`}
                        disabled={loading}
                      />
                      {formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && (
                        <p className="text-[10px] text-red-300 ml-1">
                          Invalid Email Address
                        </p>
                      )}
                    </div>

                    <div className="relative">
                      <label className="absolute -top-2 left-3 px-1 bg-[#1a4a33] text-[10px] text-white/50 rounded">
                        Date of Birth
                      </label>
                      <input
                        type="date"
                        name="dateOfBirth"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                        max={new Date().toISOString().split("T")[0]}
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                        disabled={loading}
                      />
                    </div>


                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Full Address *"
                      required
                      className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                      disabled={loading}
                    />

                    <div className="relative">
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        onKeyPress={blockNonAlphabets}
                        placeholder="City *"
                        required
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                        disabled={loading || isCityLoading}
                      />
                      <button
                        type="button"
                        onClick={fetchCityFromLocation}
                        disabled={isCityLoading || loading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-green-400 hover:bg-white/10 rounded-lg transition-colors disabled:text-neutral-500"
                        title="Fetch current location"
                      >
                        {isCityLoading ? (
                          <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <input
                      type="text"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleInputChange}
                      onKeyDown={blockNonDigits}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="Pincode"
                      className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Bank Information */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h3 className="text-xs font-bold text-green-300 uppercase tracking-widest border-b border-white/10 pb-2">
                    Bank Details (Optional)
                  </h3>

                  <div className="space-y-3">
                    <input
                      type="text"
                      name="accountName"
                      value={formData.accountName}
                      onChange={handleInputChange}
                      onKeyPress={blockNonAlphabets}
                      placeholder="Account Holder Name"
                      className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                      disabled={loading}
                    />
                    <div className="space-y-1">
                      <input
                        type="text"
                        name="bankName"
                        value={formData.bankName}
                        onChange={handleInputChange}
                        onKeyPress={blockNonAlphabets}
                        placeholder="Bank Name"
                        className={`w-full px-4 py-3 rounded-xl bg-black/20 border text-white placeholder:text-white/30 focus:outline-none focus:bg-black/30 transition-all font-medium text-sm shadow-inner ${
                          formData.bankName && /[^a-zA-Z\s]/.test(formData.bankName)
                            ? "border-red-400/50 focus:border-red-400"
                            : "border-white/10 focus:border-green-400/50"
                        }`}
                        disabled={loading}
                      />
                      {formData.bankName && /[^a-zA-Z\s]/.test(formData.bankName) && (
                        <p className="text-[10px] text-red-300 ml-1">
                          Bank Name must contain only alphabets
                        </p>
                      )}
                    </div>
                    <input
                      type="text"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleInputChange}
                      placeholder="Account Number"
                      className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                      disabled={loading}
                    />
                    <div className="space-y-1">
                      <input
                        type="text"
                        name="ifscCode"
                        value={formData.ifscCode}
                        onChange={handleInputChange}
                        placeholder="IFSC Code"
                        maxLength={11}
                        autoComplete="off"
                        className={`w-full px-4 py-3 rounded-xl bg-black/20 border text-white placeholder:text-white/30 focus:outline-none focus:bg-black/30 transition-all font-medium text-sm shadow-inner ${
                          formData.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode)
                            ? "border-red-400/50 focus:border-red-400"
                            : "border-white/10 focus:border-green-400/50"
                        }`}
                        disabled={loading}
                      />
                      {formData.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(formData.ifscCode) && (
                        <p className="text-[10px] text-red-300 ml-1">
                          Invalid IFSC Code
                        </p>
                      )}
                    </div>
                    <select
                      name="bonusType"
                      value={formData.bonusType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white/70 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                      disabled={loading}
                    >
                      {bonusTypes.map((type) => (
                        <option
                          key={type}
                          value={type === "Select Bonus Type" ? "" : type}
                          className="bg-[#0f2e20]"
                        >
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Documents Section */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h3 className="text-xs font-bold text-green-300 uppercase tracking-widest border-b border-white/10 pb-2">
                    Documents (Optional)
                  </h3>

                  <div className="space-y-3">
                    <div className="relative">
                      <label className="block text-[10px] text-white/50 mb-1 ml-1">
                        Driving License
                      </label>
                      <input
                        type="file"
                        name="drivingLicense"
                        onChange={handleFileChange}
                        accept="image/*,.pdf"
                        className="w-full px-4 py-2.5 rounded-xl bg-black/20 border border-white/10 text-white/50 text-xs focus:outline-none transition-all"
                        disabled={loading || uploadingDocs}
                      />
                      {drivingLicenseFile && (
                        <p className="text-[10px] text-green-400 mt-1 ml-1">
                          {drivingLicenseFile.name}
                        </p>
                      )}
                    </div>

                    <div className="relative">
                      <label className="block text-[10px] text-white/50 mb-1 ml-1">
                        National Identity Card
                      </label>
                      <input
                        type="file"
                        name="nationalIdentityCard"
                        onChange={handleFileChange}
                        accept="image/*,.pdf"
                        className="w-full px-4 py-2.5 rounded-xl bg-black/20 border border-white/10 text-white/50 text-xs focus:outline-none transition-all"
                        disabled={loading || uploadingDocs}
                      />
                      {nationalIdentityCardFile && (
                        <p className="text-[10px] text-green-400 mt-1 ml-1">
                          {nationalIdentityCardFile.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-2 bg-red-500/20 border border-red-500/30 backdrop-blur-sm text-red-100 text-xs rounded-lg flex items-center gap-2 animate-shake">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
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
                        strokeLinejoin="round"
                      />
                    </svg>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || uploadingDocs}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg overflow-hidden relative group ${
                    !loading && !uploadingDocs
                      ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-white/10 text-white/30 cursor-not-allowed border border-white/5"
                  }`}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
                  <span className="relative flex items-center justify-center gap-2">
                    {uploadingDocs ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      "Register Securely"
                    )}
                  </span>
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-white/60">
                    Already have a partner account?{" "}
                    <button
                      type="button"
                      onClick={() => navigate("/delivery/login")}
                      className="text-white hover:text-green-300 font-semibold hover:underline transition-colors"
                    >
                      Login
                    </button>
                  </p>
                </div>
              </form>
            ) : (
              <div className="space-y-5 animate-fade-in py-4">
                <div className="text-center space-y-1">
                  <h1 className="text-xl font-bold text-white">Verify OTP</h1>
                  <p className="text-xs text-green-100/80">
                    Enter the code sent via voice call to
                    <br />
                    <span className="font-semibold text-white text-base tracking-wider">
                      +91 {formData.mobile}
                    </span>
                  </p>
                </div>

                <div className="flex justify-center py-2">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-sm">
                    <OTPInput
                      onComplete={handleOTPComplete}
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-2 bg-red-500/20 border border-red-500/30 backdrop-blur-sm text-red-100 text-xs rounded-lg text-center">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setShowOTP(false);
                      setError("");
                    }}
                    disabled={loading}
                    className="py-3 rounded-xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      setError("");
                      try {
                        const res = await sendOTP(formData.mobile);
                        if (res.sessionId) setSessionId(res.sessionId);
                      } catch (err: any) {
                        setError(err.message || "Failed to resend OTP.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    className="py-3 rounded-xl text-xs font-semibold text-green-400 hover:text-green-300 hover:bg-green-500/10 border border-green-500/20 transition-all"
                  >
                    {loading ? "Calling..." : "Resend OTP"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-black/20 border-t border-white/10 text-center backdrop-blur-md">
          <p className="text-[9px] text-white/50">
            By continuing, you agree to Wasgro mart's{" "}
            <button
              onClick={() => navigate("/terms-of-service")}
              className="text-green-400 hover:text-green-300 hover:underline transition-colors"
            >
              Terms of Service
            </button>{" "}
            and{" "}
            <button
              onClick={() => navigate("/privacy-policy")}
              className="text-green-400 hover:text-green-300 hover:underline transition-colors"
            >
              Privacy Policy
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
