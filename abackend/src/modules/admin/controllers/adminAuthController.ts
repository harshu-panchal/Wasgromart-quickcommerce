import { Request, Response } from "express";
import Admin from "../../../models/Admin";
import Role from "../../../models/Role";
import {
  sendOTP as sendOTPService,
  verifyOTP as verifyOTPService,
} from "../../../services/otpService";
import { generateToken } from "../../../services/jwtService";
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Send OTP to admin mobile number
 */
export const sendOTP = asyncHandler(async (req: Request, res: Response) => {
  const { mobile } = req.body;

  if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
    return res.status(400).json({
      success: false,
      message: "Valid 10-digit mobile number is required",
    });
  }

  // Check if admin exists with this mobile
  const admin = await Admin.findOne({ mobile });
  if (!admin) {
    return res.status(404).json({
      success: false,
      message: "Admin not found with this mobile number",
    });
  }

  // Send OTP - for login, always use default OTP
  const result = await sendOTPService(mobile, "Admin", true);

  return res.status(200).json({
    success: true,
    message: result.message,
  });
});

/**
 * Verify OTP and login admin
 */
export const verifyOTP = asyncHandler(async (req: Request, res: Response) => {
  const { mobile, otp } = req.body;

  if (!mobile || !/^[0-9]{10}$/.test(mobile)) {
    return res.status(400).json({
      success: false,
      message: "Valid 10-digit mobile number is required",
    });
  }

  if (!otp || !/^[0-9]{4}$/.test(otp)) {
    return res.status(400).json({
      success: false,
      message: "Valid 4-digit OTP is required",
    });
  }

  // Verify OTP
  const isValid = await verifyOTPService(mobile, otp, "Admin");
  if (!isValid) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired OTP",
    });
  }

  // Find admin and populate roleRef if it exists
  const admin = await Admin.findOne({ mobile }).select("-password");
  if (!admin) {
    return res.status(404).json({
      success: false,
      message: "Admin not found",
    });
  }

  // Build role info for response
  let roleData: { _id?: string; name: string; permissions: string[] } = {
    name: admin.role,
    permissions: [],
  };

  // If admin has a roleRef, populate permissions from Role collection
  if (admin.roleRef) {
    const roleDoc = await Role.findById(admin.roleRef);
    if (roleDoc) {
      roleData = {
        _id: roleDoc._id.toString(),
        name: roleDoc.name,
        permissions: roleDoc.permissions,
      };
    }
  }

  // Generate JWT token
  const token = generateToken(admin._id.toString(), "Admin", admin.role);

  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      token,
      user: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        mobile: admin.mobile,
        email: admin.email,
        role: roleData,
      },
    },
  });
});

/**
 * Register new admin
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, mobile, email, password, roleId } = req.body;

  // Validation
  if (!firstName || !lastName || !mobile || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  if (!/^[0-9]{10}$/.test(mobile)) {
    return res.status(400).json({
      success: false,
      message: "Valid 10-digit mobile number is required",
    });
  }

  // Check if admin already exists
  const existingAdmin = await Admin.findOne({
    $or: [{ mobile }, { email }],
  });

  if (existingAdmin) {
    return res.status(409).json({
      success: false,
      message: "Admin already exists with this mobile or email",
    });
  }

  // Resolve role
  let roleName = "Staff";
  let roleRef: string | undefined;

  if (roleId) {
    // Look up the role by ID
    const roleDoc = await Role.findById(roleId);
    if (roleDoc) {
      // Prevent registering as Super Admin or Admin (system roles)
      if (roleDoc.name === "Super Admin" || roleDoc.name === "Admin") {
        return res.status(403).json({
          success: false,
          message: "Cannot register with this role",
        });
      }
      roleName = roleDoc.name;
      roleRef = roleDoc._id.toString();
    }
  } else {
    // Default: find or create "Staff" role
    let staffRole = await Role.findOne({ name: "Staff" });
    if (!staffRole) {
      staffRole = await Role.create({
        name: "Staff",
        type: "Custom",
        permissions: [],
        description: "Default staff role with limited access",
      });
    }
    roleName = staffRole.name;
    roleRef = staffRole._id.toString();
  }

  // Create new admin
  const admin = await Admin.create({
    firstName,
    lastName,
    mobile,
    email,
    password,
    role: roleName,
    roleRef: roleRef,
  });

  // Fetch the full role for response
  let roleData: { _id?: string; name: string; permissions: string[] } = {
    name: roleName,
    permissions: [],
  };

  if (roleRef) {
    const roleDoc = await Role.findById(roleRef);
    if (roleDoc) {
      roleData = {
        _id: roleDoc._id.toString(),
        name: roleDoc.name,
        permissions: roleDoc.permissions,
      };
    }
  }

  // Generate token
  const token = generateToken(admin._id.toString(), "Admin", admin.role);

  return res.status(201).json({
    success: true,
    message: "Admin registered successfully",
    data: {
      token,
      user: {
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        mobile: admin.mobile,
        email: admin.email,
        role: roleData,
      },
    },
  });
});

/**
 * Get roles available for public registration
 * Excludes system/admin roles (Super Admin, Admin)
 */
export const getPublicRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await Role.find({
    name: { $nin: ["Super Admin", "Admin"] },
  }).select("_id name description").sort({ name: 1 });

  return res.status(200).json({
    success: true,
    message: "Public roles fetched successfully",
    data: roles,
  });
});
