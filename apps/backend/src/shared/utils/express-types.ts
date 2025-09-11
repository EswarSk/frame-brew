import { Request } from 'express';

// Extend Express Request type to include custom properties
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        orgId: string;
        email: string;
        role: string;
      };
      validated?: any;
    }
  }
}

export {};