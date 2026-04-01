import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, User } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredUserType?: "Admin" | "Seller" | "Customer" | "Delivery";
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredUserType,
  redirectTo = "/login",
}: ProtectedRouteProps) {
  const { isAuthenticated, user, token } = useAuth();
  const location = useLocation();

  // Check authentication
  if (!isAuthenticated || !token) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check user type if required
  if (requiredUserType && user) {
    // Check userType or role field
    const userType = user.userType || (typeof user.role === 'string' ? user.role : user.role?.name);

    // For Admin routes, check if role is "Admin" or "Super Admin"
    if (requiredUserType === "Admin") {
      const isAdmin = userType === "Admin" || userType === "Super Admin";
      if (!isAdmin) {
        return <Navigate to="/" replace />;
      }
    } else if (userType && userType !== requiredUserType) {
      if (requiredUserType === "Seller")
        return <Navigate to="/seller/login" replace />;
      if (requiredUserType === "Delivery")
        return <Navigate to="/delivery/login" replace />;
      if (requiredUserType === "Customer")
        return <Navigate to="/login" replace />;
      return <Navigate to="/" replace />;
    }
  }

  // Check role if required (for Admin users)
  if (requiredRole && user) {
    const userRole = typeof user.role === 'string' ? user.role : user.role?.name;
    if (!userRole || userRole !== requiredRole) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
