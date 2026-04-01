import React from 'react';
import { useNavigate } from 'react-router-dom';

const AccessDenied: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-600 shadow-inner">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-3">Access Denied</h1>
            <p className="text-gray-600 max-w-md mx-auto mb-8 text-lg">
                You don't have the required permissions to access this section.
                Please contact your system administrator if you believe this is an error.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                    onClick={() => navigate('/admin')}
                    className="px-8 py-3 bg-teal-700 text-white font-semibold rounded-xl hover:bg-teal-800 transition-all shadow-lg active:scale-95"
                >
                    Go to Dashboard
                </button>
                <button
                    onClick={() => navigate(-1)}
                    className="px-8 py-3 bg-white text-gray-700 border border-gray-200 font-semibold rounded-xl hover:bg-gray-50 transition-all shadow-sm"
                >
                    Go Back
                </button>
            </div>
        </div>
    );
};

export default AccessDenied;
