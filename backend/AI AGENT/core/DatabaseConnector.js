import { db } from "../../config/connectDB.js";

class DatabaseConnector {
    query(sql, params) {
        return new Promise((resolve, reject) => {
            db.query(sql, params, (err, results) => {
                if (err) {
                    console.error("Database Query Error:", err);
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });
    }
}

export default DatabaseConnector;