import { useState, useEffect, useRef } from "react";
import { useSubscription } from "../../context/SubscriptionContext";

interface SupportChatMockProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupportChatMock({ isOpen, onClose }: SupportChatMockProps) {
  const { chatMessages, sendChatMessage } = useSubscription();
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

    // Send seller message to context
    sendChatMessage(sellerId, input, false);
    setInput("");

    // Optional: Keep automated bot response if no admin is "active"
    // In a real app, this would be handled by a backend or admin panel
    if (messages.length === 1) { // Only on first message for demo
      setTimeout(() => {
        sendChatMessage(sellerId, "Our support team has been notified. An admin will reply shortly.", true);
      }, 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-full max-w-[320px] sm:max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 animate-in slide-in-from-bottom-5 duration-300">
      {/* Header */}
      <div className="bg-teal-600 p-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
             <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
             </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold leading-none">Premium Support</h3>
            <span className="text-[10px] text-teal-100 flex items-center gap-1 mt-1">
               <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
               Online Now
            </span>
          </div>
        </div>
        <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-lg transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="h-80 overflow-y-auto p-4 space-y-3 bg-neutral-50 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "admin" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                msg.sender === "admin"
                  ? "bg-white text-neutral-800 shadow-sm border border-neutral-100 rounded-tl-none"
                  : "bg-teal-600 text-white rounded-br-none shadow-md"
              }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-white border-t border-neutral-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-neutral-100 px-4 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="bg-teal-600 text-white p-2 rounded-xl disabled:opacity-50 hover:bg-teal-700 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
}
