import jwt from 'jsonwebtoken';
import { findUserById } from '../models/userModel.js';
import { getJwtSecret } from '../utils/jwtSecret.js';

const JWT_SECRET = getJwtSecret();

export function getEffectiveUserRole(user) {
  if (!user) {
    return null;
  }

  if (user.role === 'admin') {
    return 'admin';
  }

  if (user.role === 'trader' || user.status === 'trader') {
    return 'trader';
  }

  return user.role || 'client';
}

export function createToken(user) {
  const effectiveRole = getEffectiveUserRole(user);
  return jwt.sign({ id: user.id, role: effectiveRole }, JWT_SECRET, { expiresIn: '7d' });
}

export async function authRequired(req, res, next) {
  const rawHeader = req.headers.authorization || '';
  const headerToken = rawHeader.startsWith('Bearer ') ? rawHeader.slice(7) : '';
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : '';
  const token = headerToken || queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const currentUser = await findUserById(payload.id);
    if (!currentUser) {
      return res.status(401).json({ error: 'User not found for this session.' });
    }

    if (currentUser.is_archived) {
      return res.status(403).json({
        error: 'You have been forced logout because your account was archived by the administrator.',
        code: 'ACCOUNT_ARCHIVED',
      });
    }

    const effectiveRole = getEffectiveUserRole(currentUser);

    req.auth = {
      ...payload,
      role: effectiveRole,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(roles) {
  return async (req, res, next) => {
    const effectiveReqRole = getEffectiveUserRole({ role: req.auth?.role, status: req.auth?.status });
    if (roles.includes(effectiveReqRole)) {
      return next();
    }

    try {
      const currentUser = await findUserById(req.auth.id);
      if (!currentUser) {
        return res.status(401).json({ error: 'User not found for this session.' });
      }

      const currentRole = getEffectiveUserRole(currentUser);
      if (roles.includes(currentRole)) {
        req.auth.role = currentRole;
        req.auth.status = currentUser.status;
        return next();
      }

      return res.status(403).json({ error: 'You do not have access to this resource.' });
    } catch {
      return res.status(500).json({ error: 'Could not verify permissions.' });
    }
  };
}
