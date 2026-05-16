import { useNavigate, useLocation } from "react-router-dom";

interface SellerBottomNavProps {
    onMenuClick?: () => void;
}

export default function SellerBottomNav({ onMenuClick }: SellerBottomNavProps) {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => {
        if (path === "/seller") {
            return location.pathname === "/seller" || location.pathname === "/seller/";
        }
        return location.pathname.startsWith(path);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-neutral-200 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] sm:hidden">
            <div className="flex items-end justify-around px-2 pb-1 pt-1 relative">
                {/* Home */}
                <button
                    onClick={() => navigate("/seller")}
                    className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 transition-all duration-200 ${isActive("/seller") && !isActive("/seller/orders") && !isActive("/seller/wallet")
                        ? "text-teal-700"
                        : "text-neutral-400 hover:text-neutral-600"
                        }`}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    <span className="text-[10px] mt-0.5 font-medium leading-tight">Home</span>
                </button>

                {/* Orders */}
                <button
                    onClick={() => navigate("/seller/orders")}
                    className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 transition-all duration-200 ${isActive("/seller/orders")
                        ? "text-teal-700"
                        : "text-neutral-400 hover:text-neutral-600"
                        }`}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span className="text-[10px] mt-0.5 font-medium leading-tight">Orders</span>
                </button>

                {/* Add - Center FAB Button */}
                <div className="flex flex-col items-center justify-center flex-1 relative">
                    <button
                        onClick={() => navigate("/seller/product/add")}
                        className="absolute -top-6 w-14 h-14 bg-teal-700 hover:bg-teal-800 text-white rounded-full flex items-center justify-center shadow-lg shadow-teal-700/30 transition-all duration-200 active:scale-95"
                        aria-label="Add Product"
                    >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                    <span className="text-[10px] mt-5 font-medium leading-tight text-neutral-400">Add</span>
                </div>

                {/* Wallet */}
                <button
                    onClick={() => navigate("/seller/wallet")}
                    className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 transition-all duration-200 ${isActive("/seller/wallet")
                        ? "text-teal-700"
                        : "text-neutral-400 hover:text-neutral-600"
                        }`}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    <span className="text-[10px] mt-0.5 font-medium leading-tight">Wallet</span>
                </button>

                {/* Menu */}
                <button
                    onClick={() => onMenuClick?.()}
                    className="flex flex-col items-center justify-center flex-1 py-1.5 px-1 transition-all duration-200 text-neutral-400 hover:text-neutral-600"
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                    </svg>
                    <span className="text-[10px] mt-0.5 font-medium leading-tight">Menu</span>
                </button>
            </div>
            {/* Safe area padding for notched phones */}
            <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
    );
}
