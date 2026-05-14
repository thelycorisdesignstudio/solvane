import jwt from 'jsonwebtoken';

const cleanSession = value => String(value || '')
  .replace(/[^a-zA-Z0-9._:-]/g, '')
  .slice(0, 96);

export function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (t) {
    try {
      req.user = jwt.verify(t, process.env.JWT_SECRET || 'dev-secret-change-me');
      return next();
    } catch {
      // Fall through to anonymous mode so old or invalid tokens never block free access.
    }
  }
  const session = cleanSession(req.headers['x-solvane-session'] || req.ip || 'public');
  req.user = {
    id: `anonymous:${session || 'public'}`,
    email: 'public@solvane.local',
    name: 'Public workspace'
  };
  next();
}
