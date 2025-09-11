import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, JwtPayload } from '../types';
import '../utils/express-types';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback-access-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export class AuthService {
  // Hash password
  static async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  // Verify password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  // Generate JWT token
  static generateToken(payload: JwtPayload): string {
    return jwt.sign(payload as any, JWT_ACCESS_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'frame-brew-api',
      audience: 'frame-brew-client',
    } as any);
  }

  // Generate refresh token (longer expiry)
  static generateRefreshToken(payload: JwtPayload): string {
    return jwt.sign(payload as any, JWT_REFRESH_SECRET, {
      expiresIn: '30d',
      issuer: 'frame-brew-api',
      audience: 'frame-brew-client',
    } as any);
  }

  // Verify JWT token
  static verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_ACCESS_SECRET, {
        issuer: 'frame-brew-api',
        audience: 'frame-brew-client',
      }) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET, {
        issuer: 'frame-brew-api',
        audience: 'frame-brew-client',
      }) as JwtPayload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Extract token from Authorization header
  static extractTokenFromHeader(authHeader: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header');
    }
    return authHeader.substring(7);
  }

  // Generate both tokens
  static generateTokens(user: User) {
    const payload: JwtPayload = {
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
    };

    return {
      accessToken: this.generateToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }
}

// Authentication middleware
export const requireAuth = (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Authorization header required',
      });
    }

    const token = AuthService.extractTokenFromHeader(authHeader);
    const payload = AuthService.verifyToken(token);

    // Attach user info to request
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired token',
    });
  }
};

// Admin-only middleware
export const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
  next();
};

// Organization access middleware
export const requireOrgAccess = (req: any, res: any, next: any) => {
  // Users can only access resources from their own organization
  if (req.params.orgId && req.params.orgId !== req.user.orgId) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Access denied to this organization',
    });
  }
  next();
};