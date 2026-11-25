import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySessionToken } from '../server/auth.ts';
import { getUserByUid, upsertGoogleUser } from '../db/repository.ts';
import type { UserProfile, UserRole } from '../types.ts';

export interface AuthRequest extends Request {
  authUser?: UserProfile;
}

export async function authenticateBearerToken(
  token: string
): Promise<UserProfile | null> {
  const localPayload = verifySessionToken(token);
  if (localPayload) {
    const profile = await getUserByUid(localPayload.uid);
    if (profile) return profile;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const existing = await getUserByUid(decoded.uid);
    if (existing) return existing;

    return await upsertGoogleUser({
      uid: decoded.uid,
      email: decoded.email || `${decoded.uid}@google.user`,
      name: decoded.name || decoded.email?.split('@')[0] || 'Google User',
    });
  } catch {
    return null;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }

  const rawToken = authHeader.slice('Bearer '.length).trim();
  if (!rawToken) {
    return res.status(401).json({ error: 'Unauthorized: Empty authentication token' });
  }

  try {
    const user = await authenticateBearerToken(rawToken);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    }
    req.authUser = user;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ error: 'Authentication verification failed' });
  }
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roles.includes(req.authUser.role)) {
      return res
        .status(403)
        .json({ error: 'Forbidden: Insufficient permissions for this role' });
    }
    next();
  };
};
