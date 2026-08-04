import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await getPublicConfig();
      if (response && response.success && response.data) {
        setConfig(response.data);
      }
    } catch (err) {
      console.warn("Failed to fetch public config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Determine if current path belongs to Admin, Seller, or Delivery panels which bypass Customer Maintenance Screen
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";
  const isManagementPanel =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/seller") ||
    pathname.startsWith("/delivery");

  const isMaintenanceActive = !!config?.maintenanceMode;

  return (
    <MaintenanceContext.Provider
      value={{
        isMaintenanceMode: isMaintenanceActive,
        maintenanceMessage: config?.maintenanceMessage || "",
        config,
        loading,
        refetchConfig: fetchConfig,
      }}
    >
      {isMaintenanceActive && !isManagementPanel ? (
        <MaintenanceScreen
          appName={config?.appName || "Wasgromart"}
          message={config?.maintenanceMessage}
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
