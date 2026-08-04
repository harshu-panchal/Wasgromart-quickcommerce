import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { getPublicConfig, PublicConfig } from "../services/api/publicConfigService";
import MaintenanceScreen from "../modules/user/MaintenanceScreen";

interface MaintenanceContextType {
  isMaintenanceMode: boolean;
  maintenanceMessage: string;
  config: PublicConfig | null;
  loading: boolean;
  refetchConfig: () => Promise<void>;
}

const MaintenanceContext = createContext<MaintenanceContextType>({
  isMaintenanceMode: false,
  maintenanceMessage: "",
  config: null,
  loading: true,
  refetchConfig: async () => {},
});

export const useMaintenance = () => useContext(MaintenanceContext);

export const MaintenanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [forcedMaintenance, setForcedMaintenance] = useState<boolean>(false);
  const [forcedMessage, setForcedMessage] = useState<string>("");

  const fetchConfig = useCallback(async () => {
    try {
      const response = await getPublicConfig();
      if (response && response.success && response.data) {
        setConfig(response.data);
        if (!response.data.maintenanceMode) {
          setForcedMaintenance(false);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch public config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount and on route changes
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig, location.pathname]);

  // Periodic polling every 8 seconds to stay in sync with Admin changes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConfig();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchConfig]);

  // Listen for 503 HTTP interceptor event from backend API calls
  useEffect(() => {
    const handleMaintenanceTriggered = (event: Event) => {
      const customEvent = event as CustomEvent;
      setForcedMaintenance(true);
      if (customEvent.detail?.message) {
        setForcedMessage(customEvent.detail.message);
      }
    };

    window.addEventListener("maintenance-mode-triggered", handleMaintenanceTriggered);
    return () => {
      window.removeEventListener("maintenance-mode-triggered", handleMaintenanceTriggered);
    };
  }, []);

  // Check tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchConfig();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchConfig]);

  // Determine if current path belongs to Admin, Seller, or Delivery panels which bypass Customer Maintenance Screen
  const pathname = location.pathname || "";
  const isManagementPanel =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/seller") ||
    pathname.startsWith("/delivery");

  const isMaintenanceActive = forcedMaintenance || !!config?.maintenanceMode;
  const activeMessage = forcedMessage || config?.maintenanceMessage || "";

  return (
    <MaintenanceContext.Provider
      value={{
        isMaintenanceMode: isMaintenanceActive,
        maintenanceMessage: activeMessage,
        config,
        loading,
        refetchConfig: fetchConfig,
      }}
    >
      {isMaintenanceActive && !isManagementPanel ? (
        <MaintenanceScreen
          appName={config?.appName || "Wasgromart"}
          message={activeMessage}
          supportEmail={config?.supportEmail}
          supportPhone={config?.supportPhone}
          onRefresh={fetchConfig}
        />
      ) : (
        children
      )}
    </MaintenanceContext.Provider>
  );
};
