import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../../config/connectDB.js";
import { transporter } from "../../middlewares/mailTransportConfig.js";
import { generateS3Url } from "../../middlewares/S3bucketConfig.js";
import { config } from "dotenv";
config();

const DEFAULT_EXPIRATION = 5 * 60 * 1000; // 5 minutes

// Utility to execute queries with async/await
const executeQuery = async (query, params) => {
    return db.promise().query(query, params);
};

// API TO INITIATE REGISTRATION
export const initiateRegistration = async (req, res) => {
    try {
        const { username, email, fullName, password } = req.body;

        // Check for existing username or email
        const checkQuery = "SELECT username, email FROM users WHERE username = ? OR email = ?";
        const [existingUsers] = await executeQuery(checkQuery, [username, email]);

        if (existingUsers.length) {
            const conflicts = existingUsers.map(user => user.username === username ? "Username" : "Email");
            return res.status(409).json(`${conflicts.join(" and ")} already in use!`);
        }

        // Generate verification code and expiration
        const verificationCode = Math.floor(1000 + Math.random() * 9000);
        const expiresAt = new Date(Date.now() + DEFAULT_EXPIRATION);

        // Cache user data
        const cacheQuery = `
            INSERT INTO cache (email, full_name, password, verificationCode, expiresAt)
            VALUES (?, ?, ?, ?, ?)
        `;
        await executeQuery(cacheQuery, [email, fullName, password, verificationCode, expiresAt]);

        // Send verification email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Welcome to WEEBFORM! Account Verification",
            text: `
                Hello ${fullName},
                
                Welcome to WEEBFORM, your new anime-themed social media platform!
                
                Your verification code is: ${verificationCode}.
                Please use it within 5 minutes.
                
                Best regards,
                The WEEBFORM Team
            `,
        };

        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Verification code sent to email." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred. Please try again." });
    }
};

// API TO REGISTER NEW USERS
export const register = async (req, res) => {
    try {
        const { verificationCode } = req.body;
        const query = "SELECT * FROM cache WHERE verificationCode = ?";

        const [data] = await executeQuery(query, [verificationCode]);

        if (!data.length) {
            return res.status(400).json("Verification code expired or invalid.");
        }

        const cachedData = data[0];
        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(cachedData.password, salt);

        const defaultProfilePicKey = process.env.DEFAULT_PROFILE_PIC_KEY;
        const defaultCoverPhotoKey = process.env.DEFAULT_COVER_PHOTO_KEY;

        const insertQuery = `
            INSERT INTO users (email, full_name, password, profilePic, coverPhoto)
            VALUES (?, ?, ?, ?, ?)
        `;
        const values = [
            cachedData.email,
            cachedData.full_name,
            hashedPassword,
            defaultProfilePicKey,
            defaultCoverPhotoKey
        ];

        const [insertResult] = await executeQuery(insertQuery, values);

        const deleteQuery = "DELETE FROM cache WHERE email = ?";
        await executeQuery(deleteQuery, [cachedData.email]);

        const payload = { id: insertResult.insertId };
        const token = jwt.sign(payload, process.env.Secretkey);

        res.cookie("accessToken", token, { httpOnly: true }).status(200).json({
            message: "User created successfully",
            token,
            user: {
                id: insertResult.insertId,
                email: cachedData.email,
                fullName: cachedData.full_name,
                profilePicUrl: await generateS3Url(defaultProfilePicKey),
                coverPhotoUrl: await generateS3Url(defaultCoverPhotoKey),
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json("Internal server error!");
    }
};

// API FOR USER LOGIN
export const login = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        let searchField, value;

        if (username) {
            searchField = "username";
            value = username;
        } else if (email) {
            searchField = "email";
            value = email;
        } else {
            return res.status(400).json("Username or email is required");
        }

        const query = `SELECT * FROM users WHERE ${searchField} = ?`;
        const [data] = await executeQuery(query, [value]);

        if (!data.length) return res.status(404).json("Username or email not found!");

        const user = data[0];
        const isPasswordValid = bcrypt.compareSync(password, user.password);

        if (!isPasswordValid) return res.status(400).json("Wrong password");

        const token = jwt.sign({ id: user.id }, process.env.Secretkey);
        res.cookie("accessToken", token, { httpOnly: true }).status(200).json({
            message: "Login successful",
            token,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json("Internal server error!");
    }
};

// API FOR LOGOUT
export const logout = (req, res) => {
    res.clearCookie("accessToken", { secure: true, sameSite: "none" }).status(200).json("Logged out successfully");
};

// DELETE EXPIRED VERIFICATION CODES
export const deleteExpiredCodes = async () => {
    try {
        const deleteQuery = "DELETE FROM cache WHERE expiresAt < ?";
        await executeQuery(deleteQuery, [new Date()]);
    } catch (error) {
        console.error("Error deleting expired codes:", error);
    }
};

deleteExpiredCodes();
