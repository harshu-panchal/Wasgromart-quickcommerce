import { useState, useEffect, useRef } from "react";
import { useSubscription } from "../../../context/SubscriptionContext";
import FeatureGate from "../../../components/subscription/FeatureGate";

export default function SellerSupport() {
  const { chatMessages, sendChatMessage, isSubscribed } = useSubscription();
  const sellerId = "rec_current_seller";
  const messages = chatMessages[sellerId] || [];
  
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    sendChatMessage(sellerId, input, false);
    setInput("");

    // Mock bot reply for demo if it's the first message
    if (messages.length === 1) {
      setTimeout(() => {
        sendChatMessage(sellerId, "A member of our support team will be with you shortly. Thank you for your patience!", true);
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-4 sm:px-6 py-6 sm:py-8 shadow-md">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-5 5v-5z" />
                </svg>
            </div>
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  Premium Support
                </h1>
                <p className="text-teal-100 text-xs sm:text-sm mt-0.5">
                  Direct line to our priority assistance team
                </p>
            </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <FeatureGate featureName="24/7 Priority Support Chat">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
             {/* Chat Status Bar */}
             <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest">Support Agent Online</span>
                </div>
                <div className="text-[11px] font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                    Average response: 2 mins
                </div>
             </div>

             {/* Messages Area */}
             <div 
               ref={scrollRef}
               className="flex-1 overflow-y-auto p-6 space-y-4 bg-neutral-50/30 scroll-smooth">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="w-16 h-16 rounded-full bg-teal-50 flex items-center justify-center mb-4 text-teal-300">
                             <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                             </svg>
                        </div>
                        <h3 className="text-neutral-800 font-bold">Start a Conversation</h3>
                        <p className="text-neutral-500 text-sm mt-1 max-w-[240px]">Mention your query below and our team will assist you immediately.</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.sender === "admin" ? "justify-start" : "justify-end"}`}>
                        <div className={`flex flex-col ${msg.sender === "admin" ? "items-start" : "items-end"} max-w-[85%] sm:max-w-[70%]`}>
                            <div
                            className={`px-4 py-3 rounded-2xl text-sm ${
                                msg.sender === "admin"
                                ? "bg-white text-neutral-800 shadow-sm border border-neutral-100 rounded-tl-none"
                                : "bg-teal-600 text-white rounded-br-none shadow-md shadow-teal-600/20"
                            }`}>
                            {msg.text}
                            </div>
                            <span className="text-[10px] text-neutral-400 mt-1 px-1">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                    ))
                )}
             </div>

             {/* Input Area */}
             <form onSubmit={handleSend} className="p-4 bg-white border-t border-neutral-100">
                <div className="relative flex items-center gap-2 bg-neutral-100 rounded-2xl px-4 py-2 focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:bg-white transition-all border border-transparent focus-within:border-teal-200">
                    <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe your issue here..."
                    className="flex-1 bg-transparent py-2 text-sm focus:outline-none"
                    />
                    <button
                    type="submit"
                    disabled={!input.trim()}
                    className="bg-teal-600 text-white p-2 rounded-xl disabled:opacity-50 hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/30">
                    <svg className="w-5 h-5 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    </button>
                </div>
                <p className="text-[10px] text-center text-neutral-400 mt-3">
                   Usually replies in under 5 minutes • Available 24/7
                </p>
             </form>
          </div>
        </FeatureGate>
      </div>
    </div>
  );
}
