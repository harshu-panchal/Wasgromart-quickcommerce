import jwt from 'jsonwebtoken';
import { UserType } from '../models/Otp';

export interface TokenPayload {
  userId: string;
  userType: UserType;
  role?: string;
}

/**
 * Generate JWT token for authenticated user
 */
export function generateToken(userId: string, userType: UserType, role?: string): string {
  const payload: TokenPayload = {
    userId,
    userType,
    ...(role && { role }),
  };

  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  const expires = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(payload, secret, {
    expiresIn: expires,
  } as jwt.SignOptions);
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): TokenPayload {
  try {
    const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, secret) as TokenPayload;
    return decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

