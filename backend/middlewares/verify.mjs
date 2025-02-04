import { verifyToken } from './utils.js';

export function authenticateUser(req, res, next) {
  const token = req.cookies.accessToken || req.headers.accessToken;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized - No token provided' });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

export default authenticateUser;
