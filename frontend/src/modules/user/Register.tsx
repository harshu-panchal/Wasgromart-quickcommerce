import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    sendOTP,
    verifyOTP,
} from "../../services/api/auth/customerAuthService";
import { updateProfile } from "../../services/api/customerService";
import { useAuth } from "../../context/AuthContext";
import OTPInput from "../../components/OTPInput";

export default function Register() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [mobileNumber, setMobileNumber] = useState("");
    const [showOTP, setShowOTP] = useState(false);
    const [sessionId, setSessionId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleContinue = async () => {
        if (!name.trim()) {
            setError("Please enter your name");
            return;
        }
        if (mobileNumber.length !== 10) {
            setError("Please enter a valid 10-digit mobile number");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await sendOTP(mobileNumber);
            if (response.sessionId) {
                setSessionId(response.sessionId);
            }
            setShowOTP(true);
        } catch (err: any) {
            setError(
                err.response?.data?.message ||
                "Failed to initiate call. Please try again."
            );
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
                const token = response.data.token;

                // Login first to set the token for the subsequent API call
                login(token, {
                    id: response.data.user.id,
                    name: response.data.user.name,
                    phone: response.data.user.phone,
                    email: response.data.user.email,
                    walletAmount: response.data.user.walletAmount,
                    refCode: response.data.user.refCode,
                    status: response.data.user.status,
                });

                // Update profile with name and email if provided
                if (name || email) {
                    try {
                        await updateProfile({
                            name: name,
                            email: email
                        });
                    } catch (updateErr) {
                        console.error("Failed to update profile details", updateErr);
                        // Continue anyway as login was successful
                    }
                }

                navigate("/");
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
                                alt="Wasgro-mart Logo"
                                className="h-40 w-auto object-contain relative z-10 drop-shadow-lg transform hover:scale-105 transition-transform duration-300"
                            />
                        </div>
                        {!showOTP && (
                            <div className="text-center space-y-0.5">
                                <h1 className="text-xl font-bold text-white tracking-tight">
                                    Create Account
                                </h1>
                                <p className="text-green-100/80 text-xs font-medium">
                                    Join us for a better shopping experience
                                </p>
                            </div>
                        )}
                    </div>

                    {!showOTP ? (
                        <div className="space-y-4">
                            <div className="space-y-3">
                                {/* Name Input */}
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white/60">
                                            <path d="M20 21C20 19.3431 18.6569 18 17 18H7C5.34315 18 4 19.3431 4 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Full Name"
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm tracking-wide shadow-inner"
                                        disabled={loading}
                                    />
                                </div>

                                {/* Email Input */}
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white/60">
                                            <path d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            <path d="M22 6L12 13L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Email (Optional)"
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm tracking-wide shadow-inner"
                                        disabled={loading}
                                    />
                                </div>

                                {/* Mobile Input */}
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
                                        placeholder="Mobile Number"
                                        className="w-full pl-12 pr-4 py-2.5 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm tracking-wide shadow-inner"
                                        maxLength={10}
                                        disabled={loading}
                                    />
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
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                                            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        {error}
                                    </div>
                                )}

                                <button
                                    onClick={handleContinue}
                                    disabled={mobileNumber.length !== 10 || !name.trim() || loading}
                                    className={`w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg overflow-hidden relative group ${mobileNumber.length === 10 && name.trim() && !loading
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
                                            "Sign Up"
                                        )}
                                    </span>
                                </button>

                                <div className="text-center pt-1">
                                    <p className="text-xs text-white/60">
                                        Already have an account?{" "}
                                        <button
                                            onClick={() => navigate('/login')}
                                            className="text-white hover:text-green-300 font-semibold hover:underline transition-colors"
                                        >
                                            Login
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
                                    onClick={handleContinue}
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
                        By continuing, you agree to our{" "}
                        <a href="#" className="text-green-400 hover:text-green-300 hover:underline transition-colors">
                            Terms of Service
                        </a>{" "}
                        and{" "}
                        <a href="#" className="text-green-400 hover:text-green-300 hover:underline transition-colors">
                            Privacy Policy
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
