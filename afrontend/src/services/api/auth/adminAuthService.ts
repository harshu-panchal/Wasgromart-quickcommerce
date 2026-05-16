import api, { setAuthToken, removeAuthToken } from '../config';
import { Role } from "../../../types/rbac";

export interface SendOTPResponse {
  success: boolean;
  message: string;
}

export interface VerifyOTPResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      mobile: string;
      email: string;
      role: Role | string;
    };
  };
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  password: string;
  roleId?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      mobile: string;
      email: string;
      role: Role | string;
    };
  };
}

/**
 * Send OTP to admin mobile number
 */
export const sendOTP = async (mobile: string): Promise<SendOTPResponse> => {
  const response = await api.post<SendOTPResponse>('/auth/admin/send-otp', { mobile });
  return response.data;
};

/**
 * Verify OTP and login admin
 */
export const verifyOTP = async (mobile: string, otp: string): Promise<VerifyOTPResponse> => {
  const response = await api.post<VerifyOTPResponse>('/auth/admin/verify-otp', { mobile, otp });
  // NOTE: Do NOT write authToken or userData to localStorage here.
  // AdminLogin.tsx calls AuthContext.login() with { ...user, userType: 'Admin' },
  // which is the single source of truth. Writing here without userType causes
  // Admin users to lose their role on page reload → kicked out of /admin/* routes.
  return response.data;
};

/**
 * Register new admin
 */
export const register = async (data: RegisterData): Promise<RegisterResponse> => {
  const response = await api.post<RegisterResponse>('/auth/admin/register', data);
  // NOTE: Do NOT write authToken or userData to localStorage here.
  // AdminRegister.tsx handles calling AuthContext.login() with the correct userType.
  return response.data;
};

/**
 * Logout admin
 */
export const logout = (): void => {
  removeAuthToken();
};

export interface AdminProfileResponse {
  success: boolean;
  message?: string;
  data: {
    _id: string;
    name: string;
    email: string;
    mobile: string;
    profileImage?: string;
    role: string;
  };
}

/**
 * Get admin profile
 */
export const getAdminProfile = async (): Promise<AdminProfileResponse> => {
  const response = await api.get<AdminProfileResponse>('/auth/admin/profile');
  return response.data;
};

/**
 * Update admin profile
 */
export const updateAdminProfile = async (data: {
  name?: string;
  mobile?: string;
  profileImage?: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<AdminProfileResponse> => {
  const response = await api.put<AdminProfileResponse>('/auth/admin/profile', data);
  return response.data;
};

/** Public role info returned by the registration roles endpoint. */
export interface PublicRole {
  _id: string;
  name: string;
  description?: string;
}

interface PublicRolesResponse {
  success: boolean;
  message: string;
  data: PublicRole[];
}

/**
 * Fetch roles available for public registration (no auth required).
 * Excludes Super Admin and Admin roles.
 */
export const getPublicRoles = async (): Promise<PublicRole[]> => {
  const response = await api.get<PublicRolesResponse>('/auth/admin/roles');
  return response.data.data;
};
