import { verifyToken } from './utils.js';
import AppError from '../utils/appError.js';

export async function authenticateUser(req, res, next) {
    const token = req.cookies.accessToken;

    if (!token) {
        return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    try {
        req.user = await verifyToken(token);
        next();
    } catch (err) {
        next(err); //Passing to global error handler
    }
}

export default authenticateUser;
