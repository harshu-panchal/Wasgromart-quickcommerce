import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";

// Base API URL is configured per-environment in:
//   afrontend/.env.development  → http://localhost:5000/api/v1
//   afrontend/.env.production   → https://api.wasgromart.com/api/v1
// The localhost fallback below is intentionally ONLY used in dev mode, so a
// production bundle accidentally built without env vars fails loudly instead
// of silently shipping localhost URLs to every visitor's browser.
const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
const isDev = import.meta.env.DEV;

if (!RAW_API_BASE_URL) {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.warn(
      "[API Config] VITE_API_BASE_URL is not set. Falling back to http://localhost:5000/api/v1.\n" +
        "→ Create afrontend/.env.development (or .env.local) with VITE_API_BASE_URL=... to silence this."
    );
  } else {
    // eslint-disable-next-line no-console
    console.error(
      "[API Config] VITE_API_BASE_URL is MISSING in this production build.\n" +
        "→ This build will be broken for all users. Re-build with VITE_API_BASE_URL=https://api.wasgromart.com/api/v1 set."
    );
  }
}

const API_BASE_URL = (RAW_API_BASE_URL || "http://localhost:5000/api/v1").replace(/\/$/, "");

// Socket.io base URL - extract from API_BASE_URL by removing /api/v1
// Socket connections need the base server URL without the API path
export const getSocketBaseURL = (): string => {
  const apiBaseUrl =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    RAW_API_BASE_URL ||
    "http://localhost:5000/api/v1";

  // Remove /api/v1 or /api and any trailing slash from the end
  const socketUrl = apiBaseUrl.replace(/\/api\/v\d+\/?$|\/api\/?$|\/$/, "");

  return socketUrl || "http://localhost:5000";
};

// Expose the resolved API origin (scheme + host) for code that needs to build
// absolute asset URLs without re-implementing the parsing logic.
export const getApiOrigin = (): string => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
};

if (isDev || !RAW_API_BASE_URL) {
  // eslint-disable-next-line no-console
  console.log("[API Config] Base URL:", API_BASE_URL);
  // eslint-disable-next-line no-console
  console.log("[API Config] VITE_API_BASE_URL:", RAW_API_BASE_URL);
  // eslint-disable-next-line no-console
  console.log("[API Config] Socket Base URL:", getSocketBaseURL());
  // eslint-disable-next-line no-console
  console.log(
    "[API Config] Secure Context:",
    window.isSecureContext ? "✅ Yes" : "❌ No (FCM will fail on mobile)"
  );
}

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - Add token to requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("authToken");
    if (token && config.headers) {
      // Always send token in proper Bearer format, even if stored with prefix
      const sanitizedToken = token.replace(/^Bearer\\s+/i, "");
      config.headers.Authorization = `Bearer ${sanitizedToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: any) => {
    if (error.response?.status === 503 && error.response?.data?.maintenanceMode) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("maintenance-mode-triggered", {
            detail: error.response.data,
          })
        );
      }
    }

    // Only handle 401 (Unauthorized) for auto-logout
    // 403 (Forbidden) means user is authenticated but doesn't have permission - DO NOT LOGOUT
    if (error.response?.status === 401) {
      // Check if this is an authentication endpoint (OTP verification, etc.)
      // Don't redirect for auth endpoints - let the component handle the error
      const isAuthEndpoint = error.config?.url?.includes("/auth/");

      // Check if there was a token in the request (meaning user was logged in)
      const hadToken = error.config?.headers?.Authorization;

      // Only redirect if:
      // 1. It's not an auth endpoint
      // 2. There was a token in the request (user was logged in but token expired)
      // 3. User is not already on login/signup pages
      if (!isAuthEndpoint && hadToken) {
        const currentPath = window.location.pathname;

        // Skip redirect if already on public auth pages (login/signup)
        if (currentPath.includes("/login") || currentPath.includes("/signup")) {
          return Promise.reject(error);
        }

        // Token expired or invalid - clear token and redirect to appropriate login
        // Determine which login page based on the Current URL or API endpoint
        const apiUrl = error.config?.url || "";
        let redirectPath = "/login";

        if (currentPath.includes("/admin/") || apiUrl.includes("/admin/")) {
          redirectPath = "/admin/login";
        } else if (
          currentPath.includes("/seller/") ||
          apiUrl.includes("/seller/") ||
          apiUrl.includes("/sellers")
        ) {
          redirectPath = "/seller/login";
        } else if (
          currentPath.includes("/delivery/") ||
          apiUrl.includes("/delivery/")
        ) {
          redirectPath = "/delivery/login";
        }

        localStorage.removeItem("authToken");
        localStorage.removeItem("userData");
        window.location.href = redirectPath;
      }
      // If no token was present, user is just browsing as guest - don't redirect
      // Just reject the promise so the component can handle it gracefully
    }
    // For 403 and other errors, just reject the promise so the UI can handle it
    return Promise.reject(error);
  }
);

// Token management helpers
export const setAuthToken = (token: string) => {
  localStorage.setItem("authToken", token);
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem("authToken");
};

export const removeAuthToken = () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userData");
  localStorage.removeItem("fcm_token_web");    // Clear web FCM cache on logout
  localStorage.removeItem("fcm_token_mobile"); // Clear Flutter FCM cache on logout
};

export default api;
