import { verifyToken } from './utils.js';

export async function authenticateUser(req, res, next) {
    const token = req.cookies.accessToken;

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    try {
        req.user = await verifyToken(token); // Await the promise
        next();
    } catch (err) {
        console.error("Authentication error:", err); // Log the error
        return res.status(403).json({ error: 'Invalid token' });
    }
}

export default authenticateUser;
