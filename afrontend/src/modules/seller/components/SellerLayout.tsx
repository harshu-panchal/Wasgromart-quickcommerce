import { ReactNode, useState, useCallback, useEffect } from 'react';
import SellerHeader from './SellerHeader';
import SellerSidebar from './SellerSidebar';
import SellerBottomNav from './SellerBottomNav';
import { useSellerSocket, SellerNotification } from '../hooks/useSellerSocket';
import SellerNotificationAlert from './SellerNotificationAlert';

interface SellerLayoutProps {
  children: ReactNode;
}

export default function SellerLayout({ children }: SellerLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeNotification, setActiveNotification] = useState<SellerNotification | null>(() => {
    const saved = localStorage.getItem('activeSellerNotification');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const handleNotificationReceived = useCallback((notification: SellerNotification) => {
    setActiveNotification(notification);
    localStorage.setItem('activeSellerNotification', JSON.stringify(notification));
  }, []);

  useSellerSocket(handleNotificationReceived);

  useEffect(() => {
    const handleFlutterClick = (e: any) => {
      const payload = e.detail;
      try {
        let data = typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (data.data) {
           data = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
        }

        // Only handle seller relevant notifications
        if (data.type === 'NEW_ORDER' || data.type === 'STATUS_UPDATE') {
           handleNotificationReceived(data as SellerNotification);
        }
      } catch (err) {
        console.error('Failed to parse flutter notification payload', err);
      }
    };
    
    // Also attach to window for legacy support if needed
    (window as any).triggerSellerNotification = (data: any) => {
        let parsed = typeof data === 'string' ? JSON.parse(data) : data;
        handleNotificationReceived(parsed);
    };

    window.addEventListener('flutter-notification-click', handleFlutterClick);
    return () => {
      window.removeEventListener('flutter-notification-click', handleFlutterClick);
      delete (window as any).triggerSellerNotification;
    };
  }, [handleNotificationReceived]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const closeNotification = () => {
    setActiveNotification(null);
    localStorage.removeItem('activeSellerNotification');
  };

  return (
    <div className="flex min-h-screen bg-neutral-50">
      {/* Real-time Notification Alert */}
      <SellerNotificationAlert
        notification={activeNotification}
        onClose={closeNotification}
      />

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar - Fixed */}
      <div
        className={`fixed left-0 top-0 h-screen z-50 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <SellerSidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 w-full ${isSidebarOpen ? 'ml-64' : 'ml-0'
          }`}
      >
        {/* Header */}
        <SellerHeader onMenuClick={toggleSidebar} isSidebarOpen={isSidebarOpen} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-20 sm:pb-4 md:pb-6 bg-neutral-50">{children}</main>

        {/* Bottom Navigation - Mobile only */}
        <SellerBottomNav onMenuClick={toggleSidebar} />
      </div>
    </div>
  );
}

