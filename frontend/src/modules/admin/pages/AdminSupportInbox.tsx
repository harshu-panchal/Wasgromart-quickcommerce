import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useSupportSocket } from "../../../hooks/useSupportSocket";
import {
  fetchSupportConversations,
  fetchSupportMessages,
  sendSupportMessage,
  SupportConversationApi,
  SupportMessageApi,
} from "../../../services/api/supportChatService";
import api from "../../../services/api/config";

interface UiMessage {
  id: string;
  sender: "seller" | "admin";
  text: string;
  timestamp: string;
  createdAt?: string;
}

interface UiConversation {
  id: string;
  sellerId: string;
  sellerName: string;
  storeName?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageBy?: "Seller" | "Admin";
  unreadForAdmin: number;
}

export default function AdminSupportInbox() {
  const { token } = useAuth();
  const socket = useSupportSocket(token);
  const [conversations, setConversations] = useState<UiConversation[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const formatTime = useMemo(
    () => (value?: string) =>
      value
        ? new Date(value).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    []
  );

  const mapConversation = (conv: SupportConversationApi): UiConversation => ({
    id: conv._id,
    sellerId: conv.seller?._id || (conv as any).seller || "",
    sellerName:
      conv.seller?.sellerName ||
      conv.seller?.storeName ||
      "Seller",
    storeName: conv.seller?.storeName,
    lastMessage: conv.lastMessage,
    lastMessageAt: conv.lastMessageAt,
    lastMessageBy: conv.lastMessageBy,
    unreadForAdmin: conv.unreadForAdmin ?? 0,
  });

  const mapMessage = (msg: SupportMessageApi | any): UiMessage => ({
    id: msg._id || msg.id,
    sender: msg.senderType === "Admin" ? "admin" : "seller",
    text: msg.text,
    createdAt: msg.createdAt,
    timestamp: formatTime(msg.createdAt),
  });

  const appendMessage = (next: UiMessage) => {
    setMessages((prev) => {
      if (prev.some((msg) => msg.id === next.id)) return prev;
      return [...prev, next];
    });
  };

  useEffect(() => {
    const loadConversations = async () => {
      setLoading(true);
      setError("");
      try {
        const [conversationData, sellersResponse] = await Promise.all([
          fetchSupportConversations(),
          api.get("/sellers"),
        ]);

        const mapped = (conversationData || []).map(mapConversation);

        const sellers = (sellersResponse.data?.data || []) as Array<{
          _id?: string;
          id?: string;
          sellerName?: string;
          storeName?: string;
        }>;

        const mappedFromSellers: UiConversation[] = sellers.map((seller) => {
          const sellerId = seller._id || seller.id || "";
          return {
            id: sellerId,
            sellerId,
            sellerName: seller.sellerName || seller.storeName || "Seller",
            storeName: seller.storeName,
            lastMessage: undefined,
            lastMessageAt: undefined,
            lastMessageBy: undefined,
            unreadForAdmin: 0,
          };
        });

        const mergedMap = new Map<string, UiConversation>();
        for (const conv of mappedFromSellers) {
          if (!conv.sellerId) continue;
          mergedMap.set(conv.sellerId, conv);
        }
        for (const conv of mapped) {
          if (!conv.sellerId) continue;
          mergedMap.set(conv.sellerId, {
            ...mergedMap.get(conv.sellerId),
            ...conv,
          });
        }

        const merged = Array.from(mergedMap.values());
        merged.sort((a, b) => {
          const aTime = a.lastMessageAt
            ? new Date(a.lastMessageAt).getTime()
            : 0;
          const bTime = b.lastMessageAt
            ? new Date(b.lastMessageAt).getTime()
            : 0;
          return bTime - aTime;
        });

        setConversations(merged);
        if (!selectedSellerId && merged.length > 0) {
          setSelectedSellerId(merged[0].sellerId);
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load conversations");
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, []);

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedSellerId) {
        setMessages([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const data = await fetchSupportMessages(selectedSellerId, 100);
        const mapped = (data?.messages || []).map(mapMessage);
        setMessages(mapped);

        if (data?.conversation) {
          setConversations((prev) =>
            prev.map((conv) =>
              conv.sellerId === selectedSellerId
                ? {
                    ...conv,
                    unreadForAdmin: data.conversation?.unreadForAdmin ?? 0,
                    lastMessage: data.conversation?.lastMessage,
                    lastMessageAt: data.conversation?.lastMessageAt,
                    lastMessageBy: data.conversation?.lastMessageBy,
                  }
                : conv
            )
          );
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load messages");
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [selectedSellerId]);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (payload: any) => {
      if (!payload?.sellerId) return;
      if (payload.sellerId === selectedSellerId) {
        appendMessage({
          id: payload.id,
          sender: payload.senderType === "Admin" ? "admin" : "seller",
          text: payload.text,
          createdAt: payload.createdAt,
          timestamp: formatTime(payload.createdAt),
        });
      }
    };

    const handleConversationUpdate = (payload: any) => {
      if (!payload?.sellerId) return;
      setConversations((prev) => {
        const existing = prev.find((c) => c.sellerId === payload.sellerId);
        if (existing) {
          const updated = prev.map((c) =>
            c.sellerId === payload.sellerId
              ? {
                  ...c,
                  lastMessage: payload.lastMessage,
                  lastMessageAt: payload.lastMessageAt,
                  lastMessageBy: payload.lastMessageBy,
                  unreadForAdmin: payload.unreadForAdmin ?? c.unreadForAdmin,
                }
              : c
          );
          updated.sort((a, b) => {
            const aTime = a.lastMessageAt
              ? new Date(a.lastMessageAt).getTime()
              : 0;
            const bTime = b.lastMessageAt
              ? new Date(b.lastMessageAt).getTime()
              : 0;
            return bTime - aTime;
          });
          return updated;
        }
        const fresh: UiConversation = {
          id: payload.id || payload.conversationId || payload.sellerId,
          sellerId: payload.sellerId,
          sellerName: "Seller",
          lastMessage: payload.lastMessage,
          lastMessageAt: payload.lastMessageAt,
          lastMessageBy: payload.lastMessageBy,
          unreadForAdmin: payload.unreadForAdmin ?? 0,
        };
        return [fresh, ...prev];
      });
    };

    const handleError = (payload: any) => {
      if (payload?.message) setError(payload.message);
    };

    socket.on("support:message", handleMessage);
    socket.on("support:conversation-update", handleConversationUpdate);
    socket.on("support:error", handleError);

    return () => {
      socket.off("support:message", handleMessage);
      socket.off("support:conversation-update", handleConversationUpdate);
      socket.off("support:error", handleError);
    };
  }, [socket, selectedSellerId, formatTime]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedSellerId]);

  const selectedConversation = conversations.find(
    (c) => c.sellerId === selectedSellerId
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedSellerId) return;

    const text = replyText;
    setReplyText("");
    setError("");

    sendSupportMessage({ sellerId: selectedSellerId, text })
      .then((data) => {
        if (data?.message) {
          appendMessage(mapMessage(data.message));
        }
      })
      .catch((err: any) => {
        setError(err?.response?.data?.message || "Failed to send message");
      });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-neutral-100 overflow-hidden">
      {/* Header */}
      <div className="h-16 bg-white border-b border-neutral-200 flex items-center px-6 justify-between flex-shrink-0">
        <h1 className="text-xl font-bold text-neutral-800">Support Inbox</h1>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-sm font-medium text-neutral-500">
            System Live
          </span>
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
            {loading && conversations.length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">
                No support conversations yet.
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.sellerId}
                  onClick={() => setSelectedSellerId(conv.sellerId)}
                  className={`w-full p-4 text-left hover:bg-neutral-50 transition-colors flex items-center gap-3 ${
                    selectedSellerId === conv.sellerId
                      ? "bg-teal-50/50 border-r-4 border-teal-600"
                      : ""
                  }`}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm bg-teal-600">
                    {(conv.sellerName || "S")[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h3 className="text-sm font-bold text-neutral-800 truncate">
                        {conv.sellerName}
                      </h3>
                      {conv.unreadForAdmin > 0 ? (
                        <span className="text-[10px] font-bold text-white bg-rose-500 px-2 py-0.5 rounded-full">
                          {conv.unreadForAdmin}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-neutral-500 truncate mt-0.5">
                      {conv.lastMessage || "No messages yet"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-neutral-50 relative">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white border-b border-neutral-200 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-xs">
                    {(selectedConversation.sellerName || "S")[0]}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-neutral-800 leading-none">
                      {selectedConversation.sellerName}
                    </h2>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase mt-1 inline-block tracking-wider">
                      Support Chat â€¢ Online
                    </span>
                  </div>
                </div>
              </div>

              {/* Message List */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
                {loading && messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-neutral-500">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-2 opacity-50">
                    <svg
                      className="w-12 h-12"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    <p className="text-sm font-medium">
                      No conversation history yet
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${
                        msg.sender === "admin"
                          ? "justify-end"
                          : "justify-start"
                      }`}>
                      <div
                        className={`max-w-[70%] group relative px-4 py-2.5 rounded-2xl shadow-sm text-sm ${
                          msg.sender === "admin"
                            ? "bg-teal-600 text-white rounded-br-none"
                            : "bg-white text-neutral-800 border border-neutral-200 rounded-tl-none"
                        }`}>
                        <p>{msg.text}</p>
                        <span
                          className={`text-[10px] mt-1 block opacity-70 ${
                            msg.sender === "admin"
                              ? "text-teal-50"
                              : "text-neutral-500"
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
                    placeholder={`Reply to ${selectedConversation.sellerName}...`}
                    className="flex-1 px-4 py-3 bg-neutral-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-teal-500 transition-all outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!replyText.trim()}
                    className="bg-teal-600 hover:bg-teal-700 text-white px-6 rounded-xl font-bold text-sm shadow-lg shadow-teal-600/10 active:scale-[0.98] transition-all disabled:opacity-50">
                    Send
                  </button>
                </div>
                {error ? (
                  <p className="text-[11px] text-red-500 text-center mt-2">
                    {error}
                  </p>
                ) : null}
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-400 space-y-4">
              <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center">
                <svg
                  className="w-10 h-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-neutral-600">
                  Select a Conversation
                </h3>
                <p className="text-sm mt-1">
                  Choose a seller from the list to start chatting
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
