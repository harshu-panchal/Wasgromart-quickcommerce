import { useState, useEffect, useRef } from "react";
import { useSubscription } from "../../../context/SubscriptionContext";

export default function AdminSupportInbox() {
  const { sellerSubscriptions, chatMessages, sendChatMessage } = useSubscription();
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Default to first seller if none selected
  useEffect(() => {
    if (!selectedSellerId && sellerSubscriptions.length > 0) {
      setSelectedSellerId(sellerSubscriptions[0].id);
    }
  }, [sellerSubscriptions, selectedSellerId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedSellerId, chatMessages]);

  const activeSellers = sellerSubscriptions.filter((s) => s.status === "Active" || chatMessages[s.id]);
  const currentMessages = selectedSellerId ? chatMessages[selectedSellerId] || [] : [];
  const selectedSeller = sellerSubscriptions.find((s) => s.id === selectedSellerId);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedSellerId) return;

    sendChatMessage(selectedSellerId, replyText, true);
    setReplyText("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-neutral-100 overflow-hidden">
      {/* Header */}
      <div className="h-16 bg-white border-b border-neutral-200 flex items-center px-6 justify-between flex-shrink-0">
        <h1 className="text-xl font-bold text-neutral-800">Support Inbox</h1>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-sm font-medium text-neutral-500">System Live</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Seller List */}
        <div className="w-80 bg-white border-r border-neutral-200 overflow-y-auto hidden md:block">
          <div className="p-4 border-b border-neutral-50 bg-neutral-50/50">
             <input 
               type="text" 
               placeholder="Search sellers..." 
               className="w-full px-4 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
             />
          </div>
          <div className="divide-y divide-neutral-50">
            {activeSellers.map((seller) => (
              <button
                key={seller.id}
                onClick={() => setSelectedSellerId(seller.id)}
                className={`w-full p-4 text-left hover:bg-neutral-50 transition-colors flex items-center gap-3 ${
                  selectedSellerId === seller.id ? "bg-teal-50/50 border-r-4 border-teal-600" : ""
                }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  seller.id === "rec_current_seller" ? "bg-teal-600" : "bg-neutral-400"
                }`}>
                  {seller.sellerName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="text-sm font-bold text-neutral-800 truncate">
                      {seller.sellerName}
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-500 truncate mt-0.5">
                    {chatMessages[seller.id]?.[chatMessages[seller.id].length - 1]?.text || "No messages yet"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-neutral-50 relative">
          {selectedSeller ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white border-b border-neutral-200 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-xs">
                    {selectedSeller.sellerName[0]}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-neutral-800 leading-none">
                      {selectedSeller.sellerName}
                    </h2>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase mt-1 inline-block tracking-wider">
                      {selectedSeller.planName} Plan • Online
                    </span>
                  </div>
                </div>
              </div>

              {/* Message List */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
                {currentMessages.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-2 opacity-50">
                      <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      <p className="text-sm font-medium">No conversation history yet</p>
                   </div>
                ) : (
                  currentMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === "admin" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[70%] group relative px-4 py-2.5 rounded-2xl shadow-sm text-sm ${
                          msg.sender === "admin"
                            ? "bg-teal-600 text-white rounded-br-none"
                            : "bg-white text-neutral-800 border border-neutral-200 rounded-tl-none"
                        }`}>
                        <p>{msg.text}</p>
                        <span className={`text-[10px] mt-1 block opacity-70 ${
                          msg.sender === "admin" ? "text-teal-50" : "text-neutral-500"
                        }`}>
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply Bar */}
              <form 
                onSubmit={handleSend}
                className="p-4 bg-white border-t border-neutral-200">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${selectedSeller.sellerName}...`}
                    className="flex-1 px-4 py-3 bg-neutral-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className="bg-teal-600 hover:bg-teal-700 text-white px-6 rounded-xl font-bold text-sm shadow-lg shadow-teal-600/10 active:scale-[0.98] transition-all disabled:opacity-50">
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 space-y-4">
               <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
               </div>
               <div className="text-center">
                 <h3 className="text-lg font-bold text-neutral-600">Select a Conversation</h3>
                 <p className="text-sm mt-1">Choose a seller from the list to start chatting</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
