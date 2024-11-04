
import jwt from 'jsonwebtoken';

export function authenticateUser(req, res, next) {
  const token = req.cookies.accessToken
  if (!token) return res.status(401).json('Unauthorized - No token provided');
  jwt.verify(token, process.env.Secretkey, (err, user) => {
  console.log(err)
    if (err)return res.status(403).json({ error: 'Invalid token' });
    req.user = user;      
    next();
  });
}

export default authenticateUser