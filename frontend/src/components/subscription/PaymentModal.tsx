import { useState, useEffect } from "react";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  planName: string;
  amount: number;
}

export default function PaymentModal({
  isOpen,
  onClose,
  planName,
  amount,
  onSuccess,
}: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [view, setView] = useState<"methods" | "cardForm" | "redirecting">("methods");
  const [redirectAppName, setRedirectAppName] = useState<string>("");

  const startPayment = (isUPI: boolean = false, appName: string = "") => {
    if (isUPI) {
      setRedirectAppName(appName);
      setView("redirecting");
      
      // Sequence: Redirect -> Process -> Success
      setTimeout(() => {
        setIsProcessing(true);
        setTimeout(() => {
          setIsProcessing(false);
          setIsSuccess(true);
          setTimeout(() => {
            onSuccess();
          }, 1500);
        }, 2000);
      }, 1500);
    } else {
      // Direct process for cards
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }, 2000);
    }
  };

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    startPayment(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {isSuccess ? (
          <div className="p-12 text-center flex flex-col items-center justify-center min-h-[450px] animate-in zoom-in-90 duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner shadow-emerald-200 animate-bounce">
              <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-neutral-800 mb-2 leading-tight">Subscription Activated Successfully!</h2>
            <p className="text-neutral-500 font-medium tracking-tight">Your {planName} benefits are now live.</p>
          </div>
        ) : isProcessing ? (
          <div className="p-12 text-center flex flex-col items-center justify-center min-h-[450px]">
            <div className="w-16 h-16 border-4 border-neutral-100 border-t-teal-600 rounded-full animate-spin mb-6" />
            <h2 className="text-xl font-black text-neutral-800 mb-2">Confirming with Bank</h2>
            <p className="text-neutral-500 text-sm font-medium">Almost there, please don't close this window.</p>
          </div>
        ) : view === "redirecting" ? (
          <div className="p-12 text-center flex flex-col items-center justify-center min-h-[450px] animate-in zoom-in-95 duration-300">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 border-4 border-teal-50 border-t-teal-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center p-5">
                 {redirectAppName.includes("Google") ? (
                   <svg viewBox="0 0 40 40" className="w-full h-full">
                      <path d="M30.4 18.2c-.1-.7-.7-1.2-1.4-1.3l-12.7-1.7-1.7-12.7c-.1-.7-.7-1.2-1.4-1.3s-1.3.3-1.6.9L4 17.5c-.3.6-.3 1.3 0 1.9l7.7 15.4c.3.6.9.9 1.6.9h.1c.7-.1 1.2-.7 1.3-1.4l1.7-12.7 12.7-1.7c.7-.1 1.2-.7 1.3-1.4.1-.3 0-.6-.1-.9z" fill="#4285F4"/>
                   </svg>
                 ) : (
                   <div className="bg-[#5f259f] w-full h-full rounded-lg flex items-center justify-center p-2">
                      <svg viewBox="0 0 50 50" className="w-full h-full fill-white">
                         <path d="M25 5C13.954 5 5 13.954 5 25s8.954 20 20 20 20-8.954 20-20S36.046 5 25 5zm9.531 31.422h-19.06v-3.791l4.757-1.583c.792-.264 1.32-.99 1.32-1.826v-1.127a5.556 5.556 0 01-1.32-3.618 5.545 5.545 0 011.32-3.618v-1.127c0-.836-.528-1.562-1.32-1.826l-4.757-1.583V12.55h19.06v3.791l-4.757 1.583c-.792.264-1.32.99-1.32 1.826v1.127a5.556 5.556 0 011.32 3.618 5.545 5.545 0 01-1.32 3.618v1.127c0 .836.528 1.562 1.32 1.826l4.757 1.583v3.791z"/>
                      </svg>
                   </div>
                 )}
              </div>
            </div>
            <h2 className="text-xl font-black text-neutral-800 mb-2">Redirecting to {redirectAppName}</h2>
            <p className="text-neutral-500 text-sm font-medium">Please approve the payment in your app...</p>
          </div>
        ) : (
          <div className="flex flex-col min-h-[450px]">
            {/* Header */}
            <div className="p-6 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {view === "cardForm" && (
                  <button 
                    onClick={() => setView("methods")}
                    className="p-1 hover:bg-neutral-100 rounded-full text-neutral-400">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                )}
                <h2 className="text-xl font-black text-neutral-800 tracking-tight">Checkout</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 rounded-full text-neutral-400">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 pb-6 pt-2 flex-1 flex flex-col overflow-y-auto">
              {/* Order Summary */}
              <div className="mb-6 flex justify-between items-end border-b border-neutral-100 pb-4">
                 <div>
                    <p className="text-[10px] uppercase tracking-widest font-black text-neutral-400 mb-0.5">Plan</p>
                    <p className="text-sm font-bold text-neutral-800">Wasgro {planName}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-2xl font-black text-neutral-800">₹{amount}</p>
                 </div>
              </div>

              {view === "methods" ? (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                  {/* Recommended Section */}
                  <div>
                    <h3 className="text-sm font-black text-neutral-800 mb-3 ml-1">Recommended</h3>
                    <div className="bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm">
                      {/* GPay */}
                      <button 
                        onClick={() => startPayment(true, "Google Pay")}
                        className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors border-b border-neutral-50 active:bg-neutral-100">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 border border-neutral-100 rounded-lg flex items-center justify-center p-2">
                             <svg viewBox="0 0 40 40" className="w-full h-full">
                               <path d="M30.4 18.2c-.1-.7-.7-1.2-1.4-1.3l-12.7-1.7-1.7-12.7c-.1-.7-.7-1.2-1.4-1.3s-1.3.3-1.6.9L4 17.5c-.3.6-.3 1.3 0 1.9l7.7 15.4c.3.6.9.9 1.6.9h.1c.7-.1 1.2-.7 1.3-1.4l1.7-12.7 12.7-1.7c.7-.1 1.2-.7 1.3-1.4.1-.3 0-.6-.1-.9z" fill="#4285F4"/>
                               <path d="M12.7 34.8l-8.6-17.2 4.1 12.5c.3.6.9.9 1.6.9h.1c.7-.1 1.2-.7 1.3-1.4l1.5-12.7V34.8h.1-.1z" fill="#34A853"/>
                               <path d="M30.4 19.1L4.1 22.7 17.1 21c.7-.1 1.2-.7 1.3-1.4L20 6.9l10.4 12.2z" fill="#FBBC05"/>
                               <path d="M30.4 18.2c-.1-.7-.7-1.2-1.4-1.3L16.3 15.2l12.5 4.1c.7-.1 1.2-.7 1.3-1.4.1-.3 0-.6-.1-.9z" fill="#EA4335"/>
                             </svg>
                          </div>
                          <span className="text-sm font-bold text-neutral-700">Google Pay UPI</span>
                        </div>
                        <svg className="w-4 h-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      {/* PhonePe */}
                      <button 
                        onClick={() => startPayment(true, "PhonePe")}
                        className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors active:bg-neutral-100">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 border border-neutral-100 rounded-lg flex items-center justify-center p-2 bg-[#5f259f]">
                             <svg viewBox="0 0 50 50" className="w-full h-full fill-white">
                               <path d="M25 5C13.954 5 5 13.954 5 25s8.954 20 20 20 20-8.954 20-20S36.046 5 25 5zm9.531 31.422h-19.06v-3.791l4.757-1.583c.792-.264 1.32-.99 1.32-1.826v-1.127a5.556 5.556 0 01-1.32-3.618 5.545 5.545 0 011.32-3.618v-1.127c0-.836-.528-1.562-1.32-1.826l-4.757-1.583V12.55h19.06v3.791l-4.757 1.583c-.792.264-1.32.99-1.32 1.826v1.127a5.556 5.556 0 011.32 3.618 5.545 5.545 0 01-1.32 3.618v1.127c0 .836.528 1.562 1.32 1.826l4.757 1.583v3.791z"/>
                             </svg>
                          </div>
                          <span className="text-sm font-bold text-neutral-700">PhonePe UPI</span>
                        </div>
                        <svg className="w-4 h-4 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Cards Section */}
                  <div>
                    <h3 className="text-sm font-black text-neutral-800 mb-3 ml-1">Cards</h3>
                    <div className="bg-white border border-neutral-100 rounded-2xl overflow-hidden shadow-sm">
                      <button 
                        onClick={() => setView("cardForm")}
                        className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors active:bg-neutral-100">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 border border-neutral-100 rounded-lg flex items-center justify-center p-2">
                             <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                             </svg>
                          </div>
                          <span className="text-sm font-bold text-neutral-700">Add credit or debit cards</span>
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Add</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePay} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400 px-1 italic">Card Number</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="4242 4242 4242 4242"
                          className="w-full px-4 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none pr-12 transition-all shadow-inner"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-300">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2m0 14H4v-6h16zm0-10H4V6h16z"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400 px-1 italic">Expiry Date</label>
                        <input
                          type="text"
                          required
                          placeholder="MM/YY"
                          className="w-full px-4 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition-all shadow-inner"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-neutral-400 px-1 italic">CVV</label>
                        <input
                          type="password"
                          required
                          maxLength={3}
                          placeholder="123"
                          className="w-full px-4 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl text-sm focus:ring-2 focus:ring-teal-500 focus:bg-white outline-none transition-all shadow-inner"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4.5 rounded-2xl font-black text-lg shadow-xl shadow-teal-600/20 active:scale-[0.98] transition-all relative overflow-hidden group">
                    <div className="flex items-center justify-center gap-2">
                       <span>Pay ₹{amount}</span>
                       <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                       </svg>
                    </div>
                  </button>
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-neutral-50 text-center flex flex-col items-center gap-2">
              <p className="text-[10px] text-neutral-400 font-black flex items-center gap-2 uppercase tracking-tighter">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                </svg>
                Secured by Wasgro Pay
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
