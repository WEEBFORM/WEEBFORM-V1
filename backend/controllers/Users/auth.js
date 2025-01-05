import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../../config/connectDB.js";
import { transporter } from "../../middlewares/mailTransportConfig.js";
import { viewProfile } from "./user.js";
import multer from "multer";
import {cpUpload} from "../../middlewares/storage.js";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {s3, generateS3Url, s3KeyFromUrl, decodeNestedKey} from "../../middlewares/S3bucketConfig.js"; 
import { errorHandler } from "../../middlewares/errors.mjs";
import { config } from "dotenv";
config();

//API TO INITIATE REGISTRATION
export const initiateRegistration = (req, res, next) => {
        try {
            // CHECK FOR EXISTING USERNAME OR EMAIL
            const q = "SELECT * FROM users WHERE username = ? OR email = ?";
            const weeb = [req.body.username, req.body.email];
            db.query(q, weeb, (err, data) => {
                if (err) return res.status(500).json(err);
                if (data.length) {
                    // CONFIRM EXISTING CREDENTIAL
                    let existingWeeb = [];
                    data.forEach(user => {
                        if (user.username === req.body.username) existingWeeb.push("Username");
                        if (user.email === req.body.email) existingWeeb.push("Email");
                    });
                    return res.status(409).json(`${existingWeeb.join(" and ")} already in use!`);
                }
                // VERIFICATION CODE & EXPIRATION
                const verificationCode = Math.floor(1000 + Math.random() * 9000);
                const expiresAt = new Date(Date.now() + 1 * 60 * 1000);
                const r = "INSERT INTO cache (`email`, `full_name`, `password`, `verificationCode`, `expiresAt`) VALUES (?)";
                const values = [
                    req.body.email,
                    req.body.fullName,
                    req.body.password,
                    verificationCode,
                    expiresAt
                ];
                db.query(r, [values], (err, data) => {
                    if (err) return res.status(500).json(err);
                     // SEND VERIFICATION MAIL
                     const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: req.body.email,
                        subject: 'Welcome to WEEBFORM! Account Verification',
                        text: `Hello ${req.body.full_name},\n\nWelcome to WEEBFORM, your new anime-themed social media platform!\n\nWe are thrilled to have you as part of our community. WEEBFORM is a space where anime fans can connect, explore the marketplace for anime-related products, and stay up-to-date with the latest news in the anime world.\n\nTo get started, please use the following verification code to activate your account: ${verificationCode}\n\nThis code will expire in 5 minutes, so be sure to use it soon!\n\nIf you have any questions or need support, feel free to reach out to us.\n\nEnjoy your journey through WEEBFORM!\n\nBest regards,\nThe WEEBFORM Team\n\nP.S. Stay tuned for exciting features and updates coming soon!`
                    };                    
                    transporter.sendMail(mailOptions, (error) => { 
                        if (error) {
                            console.error('Error sending email:', error);
                            return res.status(500).json({ message: 'Failed to send verification code. Please try again later.' });
                        } else {
                            res.status(200).json({ message: "Verification code sent to email." });
                        }
                    });
                });
            });  
        } catch (err) {
            throw err;
        }
};

// API TO REGISTER NEW USERS
export const register = async (req, res, next) => {
    try {
        const verificationCode = req.body.verificationCode;
        const q = "SELECT * FROM cache WHERE verificationCode = ?";
        db.query(q, [verificationCode], async (err, data) => {
            if (err) {
                return res.status(500).json(err);
            } else if (data.length === 0) {
                return res.status(400).json("Verification code expired or invalid.");
            }
            const cachedData = data[0];
            if (cachedData.verificationCode !== verificationCode) {
                return res.status(400).json("Invalid verification code.");
            }

            const salt = bcrypt.genSaltSync(10);
            const hashedPassword = bcrypt.hashSync(cachedData.password, salt);

            // Use pre-uploaded default S3 keys
            const defaultProfilePicKey = process.env.DEFAULT_PROFILE_PIC_KEY;
            const defaultCoverPhotoKey = process.env.DEFAULT_COVER_PHOTO_KEY;

            const i = "INSERT INTO users (`email`, `full_name`, `password`, `profilePic`, `coverPhoto`) VALUES (?)";
            const values = [
                cachedData.email,
                cachedData.full_name,
                hashedPassword,
                defaultProfilePicKey,
                defaultCoverPhotoKey
            ];

            db.query(i, [values], (err, insertResult) => {
                if (err) {
                    return res.status(500).json(err);
                }
                const deleteQuery = "DELETE FROM cache WHERE email = ?";
                db.query(deleteQuery, [cachedData.email], async (err) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).json("Error deleting cache data");
                    }
                    const payload = { id: insertResult.insertId };
                    const token = jwt.sign(payload, process.env.Secretkey);
                    res.cookie('accessToken', token, {
                        httpOnly: true
                    }).status(200).json({
                        message: "User created successfully",
                        token,
                        user: {
                            id: insertResult.insertId,
                            email: cachedData.email,
                            fullName: cachedData.full_name,
                            profilePicUrl: await generateS3Url(defaultProfilePicKey),
                            coverPhotoUrl: await generateS3Url(defaultCoverPhotoKey),
                        }
                    });
                });
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json('Internal server error!');
    }
};

// API FOR USER LOGIN
export const login = (req, res) => {
    let searchField;
    let value = [];
    if (req.body.username) {
        searchField = "u.username = ?";
        value = [req.body.username];
    } else if (req.body.email) {
        searchField = "u.email = ?";
        value = [req.body.email];
    } else {
        return res.status(400).json("Username or email is required");
    }
    const q = `SELECT * FROM users AS u WHERE ${searchField}`;
    db.query(q, value, (err, data) => {
        if (err) return res.status(500).json(err);
        if (data.length === 0) return res.status(404).json("Username or email not found!");
        const confirmPassword = bcrypt.compareSync(req.body.password, data[0].password);
        if (!confirmPassword) return res.status(400).json('Wrong password');
        const token = jwt.sign({ id: data[0].id }, process.env.Secretkey);
        res.cookie("accessToken", token, {
            httpOnly: true
        });
        viewProfile(req, res);
    }); 
};

// API FOR LOGOUT
export const logout = (req, res) => {  
    res.clearCookie("accessToken", {
        secure: true,
        sameSite: "none"
    }).status(200).json("Logged out successfully");
};

//DELETE VERIFICATION CODE
export default function deleteCode(){
    const d = "DELETE FROM cache WHERE expiresAt < ?";
db.query(d, [new Date()], (err, data) => {
    if (err) console.error(err);
});
}
deleteCode();
 