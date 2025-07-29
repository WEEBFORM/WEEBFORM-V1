import jwt from 'jsonwebtoken';
import { db } from '../config/connectDB.js';
import AppError from './appError.js';

const promisePool = db.promise();

export const verifyToken = async (token) => {
    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);

        const q = "SELECT id, username, role FROM users WHERE id = ?";
        const [users] = await promisePool.query(q, [decoded.id]);

        if (users.length === 0) {
            throw new AppError('User belonging to this token no longer exists.', 401);
        }

        const user = users[0];
        return {
            id: user.id,
            username: user.username,
            role: user.role
        };
    } catch (err) {
        throw err;
    }
};
