import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { register, getPublicRoles, PublicRole } from "../../../services/api/auth/adminAuthService";

export default function AdminRegister() {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        mobile: "",
        email: "",
        password: "",
        roleId: "",
    });
    const [roles, setRoles] = useState<PublicRole[]>([]);
    const [rolesLoading, setRolesLoading] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Fetch available roles on mount
    useEffect(() => {
        const fetchRoles = async () => {
            try {
                const data = await getPublicRoles();
                setRoles(data);
            } catch {
                // Silently handle — dropdown will be empty and Staff will be default
                console.error("Failed to fetch roles");
            } finally {
                setRolesLoading(false);
            }
        };
        fetchRoles();
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
        } else {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (formData.mobile.length !== 10) {
            setError("Please enter a valid 10-digit mobile number");
            setLoading(false);
            return;
        }

        try {
            const { roleId, ...rest } = formData;
            const payload = {
                ...rest,
                ...(roleId ? { roleId } : {}),
            };

            const response = await register(payload);
            if (response.success && response.data) {
                // Login the user
                const userData = response.data.user;
                login(response.data.token, {
                    ...userData,
                    userType: "Admin",
                });
                navigate("/admin");
            } else {
                setError(response.message || "Registration failed");
            }
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { message?: string } } };
            setError(
                axiosErr.response?.data?.message || "Registration failed. Please try again."
            );
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
                    <div className="flex flex-col items-center mb-6">
                        <div className="relative mb-2 group">
                            <div className="absolute inset-0 bg-white/20 rounded-full blur-xl transform group-hover:scale-110 transition-transform duration-500" />
                            <img
                                src="/assets/wasgromart-black-text-removebg-preview.png"
                                alt="Wasgro mart"
                                className="h-32 w-auto object-contain relative z-10 drop-shadow-lg transform hover:scale-105 transition-transform duration-300"
                            />
                        </div>
                        <div className="text-center space-y-0.5">
                            <h1 className="text-xl font-bold text-white tracking-tight">
                                Admin Registration
                            </h1>
                            <p className="text-green-100/80 text-xs font-medium">
                                Create a new admin account
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleInputChange}
                                    placeholder="First Name"
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                                />
                                <input
                                    type="text"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleInputChange}
                                    placeholder="Last Name"
                                    required
                                    className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                                />
                            </div>

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
                                    placeholder="Mobile Number"
                                    required
                                    maxLength={10}
                                    className="w-full pl-12 pr-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                                />
                            </div>

                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="Email Address"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                            />

                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder="Password"
                                required
                                className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner"
                            />

                            {/* Role Selection Dropdown */}
                            <div className="relative">
                                <select
                                    name="roleId"
                                    value={formData.roleId}
                                    onChange={handleInputChange}
                                    disabled={rolesLoading}
                                    className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white focus:outline-none focus:border-green-400/50 focus:bg-black/30 transition-all font-medium text-sm shadow-inner appearance-none cursor-pointer disabled:opacity-50"
                                >
                                    <option value="" className="bg-[#1a4a33] text-white">
                                        {rolesLoading ? "Loading roles..." : "Select Role (default: Staff)"}
                                    </option>
                                    {roles.map((role) => (
                                        <option
                                            key={role._id}
                                            value={role._id}
                                            className="bg-[#1a4a33] text-white"
                                        >
                                            {role.name}
                                        </option>
                                    ))}
                                </select>
                                {/* Dropdown arrow */}
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <svg
                                        width="14"
                                        height="14"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        className="text-white/50"
                                    >
                                        <path
                                            d="M6 9l6 6 6-6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
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
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                                    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg overflow-hidden relative group ${!loading
                                ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-green-500/40 hover:scale-[1.02] active:scale-[0.98]"
                                : "bg-white/10 text-white/30 cursor-not-allowed border border-white/5"
                                }`}
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
                            <span className="relative flex items-center justify-center gap-2">
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Creating Account...</span>
                                    </>
                                ) : (
                                    "Register"
                                )}
                            </span>
                        </button>

                        <div className="text-center pt-2">
                            <p className="text-xs text-white/60">
                                Already have an admin account?{" "}
                                <button
                                    type="button"
                                    onClick={() => navigate("/admin/login")}
                                    className="text-white hover:text-green-300 font-semibold hover:underline transition-colors">
                                    Login
                                </button>
                            </p>
                        </div>
                    </form>
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
