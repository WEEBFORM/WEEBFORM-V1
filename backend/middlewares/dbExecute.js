import { db } from "../config/connectDB.js";

export const executeQuery = (query, params) => {
    return new Promise((resolve, reject) => {
        db.query(query, params, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
};

export default {executeQuery} 