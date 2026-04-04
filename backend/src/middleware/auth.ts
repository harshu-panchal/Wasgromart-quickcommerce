import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../services/jwtService';

export type AuthUserType = 'Admin' | 'Seller' | 'Customer' | 'Delivery';

// Normalize role/userType comparisons to avoid case sensitivity issues
const normalizeRole = (value?: string): string => (value || '').trim().toLowerCase();

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

// edndgvoercnewrecc

/**
 * Authenticate user by verifying JWT token
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Authorization header must be in format: Bearer <token>',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = verifyToken(token);

      // Ensure decoded payload is well-formed and always has a role fallback
      if (!decoded || typeof decoded !== 'object') {
        res.status(401).json({
          success: false,
          message: 'Invalid token payload',
        });
        return;
      }

      // Backward compatibility: allow either userType or role and mirror them
      const normalizedUserType = normalizeRole((decoded as any).userType);
      const normalizedRole = normalizeRole((decoded as any).role);

      if (!decoded.userType && decoded.role) {
        (decoded as TokenPayload).userType = decoded.role as AuthUserType;
      } else if (!decoded.role && decoded.userType) {
        (decoded as TokenPayload).role = decoded.userType;
      }

      // Reject clearly malformed tokens that lack both role and userType
      if (!normalizedUserType && !normalizedRole) {
        res.status(401).json({
          success: false,
          message: 'Token is missing user role information',
        });
        return;
      }

      req.user = decoded;
      next();
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Invalid or expired token',
      });
      return;
    }
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message,
    });
    return;
  }
};

/**
 * Authorize user by checking role (for Admin users)
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const normalizedAllowedRoles = roles.map((r) => normalizeRole(r));
    const userRole = normalizeRole(req.user.role) || normalizeRole(req.user.userType);

    if (!userRole || !normalizedAllowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Required role: ' + roles.join(' or '),
      });
      return;
    }

    next();
  };
};

/**
 * Require specific user type(s)
 */
export const requireUserType = (...userTypes: AuthUserType[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const normalizedAllowedTypes = userTypes.map((t) => normalizeRole(t));
    const userType = normalizeRole(req.user.userType);
    const userRole = normalizeRole(req.user.role);

    if (!userType && !userRole) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const matches = normalizedAllowedTypes.includes(userType) || normalizedAllowedTypes.includes(userRole);

    if (!matches) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Required user type: ' + userTypes.join(' or '),
      });
      return;
    }

    next();
  };
};
