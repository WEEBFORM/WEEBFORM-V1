import jwt from 'jsonwebtoken';
import { db } from '../config/connectDB.js'; // Import database connection

export const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);

        // Fetch user details from the database to get the latest premium status and role
        return new Promise((resolve, reject) => {
            const q = "SELECT id, username, role FROM users WHERE id = ?";
            db.query(q, [decoded.id], (err, data) => {
                if (err) {
                    console.error("Error fetching user:", err);
                    return reject(new Error('Invalid token - user not found')); // Reject on database error
                }
                if (!data.length) {
                    return reject(new Error('Invalid token - user not found')); // Reject if user doesn't exist
                }

                const user = data[0];
                resolve({
                    id: user.id,
                    username: user.username,
                    role: user.role // Include the role
                });
            });
        });

    } catch (err) {
        throw new Error('Invalid token');
    }
};
