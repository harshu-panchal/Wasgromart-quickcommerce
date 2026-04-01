import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  sendOTP,
  verifyOTP,
} from "../../../services/api/auth/deliveryAuthService";
import OTPInput from "../../../components/OTPInput";
import { useAuth } from "../../../context/AuthContext";
import { removeAuthToken } from "../../../services/api/config";

export default function DeliveryLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mobileNumber, setMobileNumber] = useState("9111966732");
  const [sessionId, setSessionId] = useState("");
  const [showOTP, setShowOTP] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNotRegistered, setIsNotRegistered] = useState(false);

  // Clear any existing token on mount to prevent role conflicts
  useEffect(() => {
    removeAuthToken();
  }, []);

  const handleMobileLogin = async () => {
    if (mobileNumber.length !== 10) return;

    setLoading(true);
    setError("");
    setIsNotRegistered(false);

    try {
      const response = await sendOTP(mobileNumber);
      if (response.success && response.sessionId) {
        setSessionId(response.sessionId);
        setShowOTP(true);
      } else {
        setError(response.message || "Failed to initiate OTP");
      }
    } catch (err: any) {
      const status = err.response?.status;
      const message =
        err.response?.data?.message || "Failed to send OTP. Please try again.";

      setError(message);

      // Check for 400 Bad Request specific to user not found (or based on message content)
      if (
        status === 400 &&
        (message.toLowerCase().includes("not found") ||
          message.toLowerCase().includes("register"))
      ) {
        setIsNotRegistered(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOTPComplete = async (otp: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await verifyOTP(mobileNumber, otp, sessionId);
      if (response.success && response.data) {
        // Update auth context
        login(response.data.token, {
          ...response.data.user,
          userType: "Delivery",
        });

        // FCM token registration is handled globally by App.tsx when auth state changes
        // No need to call registerFCMToken here - it would cause duplicate notifications

        navigate("/delivery");
      }
    } catch (err: any) {
      // Also handle 401 Unauthorized for verify step
      const message =
        err.response?.data?.message || "Invalid OTP. Please try again.";
      setError(message);
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
      <div className="w-full max-w-sm relative z-10 backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden animate-fade-in-up">
        <div className="p-6 relative">

          {/* Logo Section */}
          <div className="flex flex-col items-center mb-2">
            <div className="relative mb-2 group">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-xl transform group-hover:scale-110 transition-transform duration-500" />
              <img
                src="/assets/wasgromart-black-text-removebg-preview.png"
                alt="Wasgro Mart"
                className="h-32 w-auto object-contain relative z-10 drop-shadow-lg transform hover:scale-105 transition-transform duration-300"
              />
            </div>
            {!showOTP && (
              <div className="text-center space-y-0.5">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Delivery Login
                </h1>
                <p className="text-green-100/80 text-xs font-medium">
                  Access your delivery dashboard
                </p>
              </div>
            )}
          </div>

          {!showOTP ? (
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <span className="text-white/60 font-medium pr-2 border-r border-white/20 text-sm">
                      +91
                    </span>
                  </div>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) =>
                      setMobileNumber(
                        e.target.value.replace(/\D/g, "").slice(0, 10)
                      )
                    }
                    placeholder="Enter mobile number"
                    className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm tracking-wide shadow-inner"
                    maxLength={10}
                    disabled={loading}
                    autoFocus
                  />
                </div>

                {error && (
                  <div className="p-2 bg-red-500/20 border border-red-500/30 backdrop-blur-sm text-red-100 text-xs rounded-lg flex flex-col gap-2 animate-shake">
                    <div className="flex items-center gap-2">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                        <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{error}</span>
                    </div>
                    {isNotRegistered && (
                      <button
                        onClick={() => navigate("/delivery/signup")}
                        className="text-[10px] font-bold text-white bg-green-500/40 hover:bg-green-500/60 py-1 px-3 rounded self-start transition-colors border border-green-500/20">
                        Register Now
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={handleMobileLogin}
                  disabled={mobileNumber.length !== 10 || loading}
                  className={`w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg overflow-hidden relative group ${mobileNumber.length === 10 && !loading
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-white/10 text-white/30 cursor-not-allowed border border-white/5"
                    }`}
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
                  <span className="relative flex items-center justify-center gap-2">
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      "Continue Securely"
                    )}
                  </span>
                </button>
                <div className="text-center pt-1">
                  <p className="text-xs text-white/60">
                    Don't have a partner account?{" "}
                    <button
                      onClick={() => navigate("/delivery/signup")}
                      className="text-white hover:text-green-300 font-semibold hover:underline transition-colors"
                    >
                      Sign Up
                    </button>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center space-y-1">
                <h1 className="text-xl font-bold text-white">
                  Verify OTP
                </h1>
                <p className="text-xs text-green-100/80">
                  Enter the code sent to
                  <br />
                  <span className="font-semibold text-white text-base tracking-wider">
                    +91 {mobileNumber}
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

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => {
                    setShowOTP(false);
                    setError("");
                  }}
                  disabled={loading}
                  className="py-2.5 rounded-lg text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 border border-white/10 transition-all active:scale-95"
                >
                  Change Number
                </button>
                <button
                  onClick={handleMobileLogin}
                  disabled={loading}
                  className="py-2.5 rounded-lg text-xs font-semibold text-green-400 hover:text-green-300 hover:bg-green-500/10 border border-green-500/20 transition-all active:scale-95"
                >
                  {loading ? "Resending..." : "Resend OTP"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-black/20 border-t border-white/10 text-center backdrop-blur-md">
          <p className="text-[9px] text-white/50">
            By continuing, you agree to Wasgro Mart's Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
