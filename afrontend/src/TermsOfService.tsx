import { useNavigate } from "react-router-dom";

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="pb-24 md:pb-8 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-b from-teal-50 to-white pb-6 pt-4 sticky top-0 z-10 border-b border-neutral-100">
        <div className="px-4 md:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="text-neutral-900"
              aria-label="Back">
              <svg
                width="24"
                height="24"
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
            <h1 className="text-xl font-bold text-neutral-900">Terms of Service</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 lg:px-8 py-6 max-w-3xl mx-auto">
        <div className="prose prose-sm max-w-none text-neutral-700">
          <section className="mb-8">
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Terms of Service</h2>
            <p className="mb-4">
              Welcome to Wasgro mart. By accessing or using our platform, you agree to comply with and be bound by the following terms and conditions.
            </p>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">1. Acceptance of Terms</h3>
            <p className="mb-4">
              By creating an account or using our services, you accept these terms in full. If you do not agree with any part of these terms, you must not use our platform.
            </p>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">2. Use of Service</h3>
            <p className="mb-4">
              You agree to use the service only for lawful purposes and in a way that does not infringe the rights of others or restrict their use of the platform.
            </p>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">3. Account Security</h3>
            <p className="mb-4">
              You are responsible for maintaining the confidentiality of your account details and for all activities that occur under your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-bold text-neutral-900 mb-4">Privacy Policy</h2>
            <p className="mb-4">
              Your privacy is important to us. This policy explains how we collect, use, and protect your personal information.
            </p>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">1. Data Collection</h3>
            <p className="mb-4">
              We collect information you provide directly to us, such as when you create an account, place an order, or contact support.
            </p>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">2. Use of Information</h3>
            <p className="mb-4">
              We use your information to provide, maintain, and improve our services, process transactions, and communicate with you.
            </p>
            <h3 className="text-lg font-semibold text-neutral-800 mb-2">3. Data Protection</h3>
            <p className="mb-4">
              We implement industry-standard security measures to protect your data from unauthorized access or disclosure.
            </p>
          </section>

          <div className="mt-12 text-center text-xs text-neutral-500">
            <p>© 2024 Wasgro mart. All rights reserved.</p>
            <p className="mt-1">Last updated: April 2024</p>
          </div>
        </div>
      </div>
    </div>
  );
}
