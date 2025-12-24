import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import geoip from 'geoip-lite';
import fetch from 'node-fetch';
import { OAuth2Client } from "google-auth-library";
import { transporter } from "../../middlewares/mailTransportConfig.js";
import { generateS3Url } from "../../middlewares/S3bucketConfig.js";
import { executeQuery } from "../../middlewares/dbExecute.js";
import { config } from "dotenv";
import NodeCache from 'node-cache';
import { createNotification } from "../Notifications/notificationsController.js";

config();

const userCache = new NodeCache({ stdTTL: 300 });
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); 

// HELPER: HANDLES SUCCESSFUL LOGIN (FOR BOTH METHODS)
const handleSuccessfulLogin = async (req, res, user) => {
    try {
        const userAgent = req.headers['user-agent'];
        
        // IP EXTRACTION WITH FALLBACKS
        let ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress;
        if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
        if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);

        // GEOLOCATION LOOKUP WITH FALLBACK
        let location = "an unrecognized location";
        const geo = geoip.lookup(ip);
        if (geo && geo.city && geo.country) {
            location = `${geo.city}, ${geo.country}`;
        } else {
            try {
                const geoResponse = await fetch(`http://ip-api.com/json/${ip}`);
                const geoData = await geoResponse.json();
                if (geoData.status === 'success') {
                    location = geoData.city ? `${geoData.city}, ${geoData.country}` : geoData.country;
                }
            } catch (geoError) {
                console.error('Geolocation fallback failed:', geoError);
            }
        }

        const device = userAgent || "an unrecognized device";

        // CREATE A NEW LOGIN NOTIFICATION
        await createNotification('NEW_LOGIN', user.id, user.id, {}, { device, location });

        const token = jwt.sign({ id: user.id }, process.env.SECRET_KEY, { expiresIn: '1Y' });

        res.cookie("accessToken", token, {
            httpOnly: false,
            sameSite: 'None',
            secure: true,
            path: "/",
            maxAge: 365.25 * 24 * 60 * 60 * 1000 // 1 year
        }).status(200).json({
            message: "User logged in successfully", user
        });

        // SEND LOGIN NOTIFICATION EMAIL
        const loginTime = new Date().toLocaleString();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "New Login Notification",
            html: `<p>Hi ${user.username},</p><p>There was a recent login to your account with the following details:</p><ul><li><strong>Date and Time:</strong> ${loginTime}</li><li><strong>Device:</strong> ${device}</li><li><strong>Location:</strong> ${location}</li></ul><p>If this wasn't you, please secure your account immediately.</p>`
        };
        transporter.sendMail(mailOptions);

    } catch (err) {
        console.error("Error in handleSuccessfulLogin:", err);
        // Avoid sending another response if one is already in flight
        if (!res.headersSent) {
            res.status(500).json({ message: "An error occurred during the login process." });
        }
    }
};

// INITIATE REGISTRATION
export const initiateRegistration = async (req, res) => {
    try {
        const { username, email, fullName, password } = req.body;
        const existingUsers = await executeQuery(
            "SELECT * FROM users WHERE username = ? OR email = ?",
            [username, email]
        );

        if (existingUsers.length) {
            const existingWeeb = [];
            existingUsers.forEach(user => {
                if (user.username === username) existingWeeb.push("Username");
                if (user.email === email) existingWeeb.push("Email");
            });
            return res.status(409).json(`${existingWeeb.join(" and ")} already in use!`);
        }

        const verificationCode = Math.floor(1000 + Math.random() * 9000);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await executeQuery(
            "INSERT INTO cache (email, full_name,password, verificationCode, expiresAt) VALUES (?)",
            [[email, fullName, password, verificationCode, expiresAt]]
        );

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Welcome to WEEBFORM! Account Verification',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: 00000;">
                    <div style="text-align: center; margin-bottom: 20px; padding: 0px 40px 0px 40px">
                        <img src="https://weebform.com/wp-content/uploads/2024/12/cropped-43b3193e-814b-4a9d-a367-daa917d5ddb5-300x300.jpg" alt="WEEBFORM Logo" style="max-width: 150px;">
                    </div>
                    <h2>Hello <span style="color: #CF833F;">${fullName}</span>,</h2>
                    <p>Welcome to <strong>WEEBFORM</strong>, your new anime-themed social media platform!</p>
                    <p>We are thrilled to have you as part of our community. <strong>WEEBFORM</strong> is a space where anime fans can connect, explore the marketplace for anime-related products, and stay up-to-date with the latest news in the anime world.</p>
                    <p>To get started, please use the following verification code to activate your account:</p>
                    <div style="text-align: center; margin: 20px 0;">
                        <span style="font-size: 28px; font-weight: bold; color: #CF833F;">${verificationCode}</span>
                    </div> 
                    <p>This code will expire in <strong>10 minutes</strong>, so be sure to use it soon!</p>
                    <p>If you have any questions or need support, feel free to reach out to us.</p>
                    <p>Enjoy your journey through <strong>WEEBFORM</strong>!</p>
                    <p>Best regards,</p> 
                    <p><strong>The WEEBFORM Team</strong></p>
                    <hr style="border: 0; height: 1px; background-color: #ccc; margin: 20px 0;">
                    <p style="font-size: 14px; color: #777;">
                        P.S. Stay tuned for exciting features and updates by subscribing to our newsletter on our website:
                        <a href="https://weebform.com" style="color: #CF833F; text-decoration: none;">weebform.com</a>.
                    </p>
                </div>
            `,
        };

        transporter.sendMail(mailOptions, (error) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ message: 'Failed to send verification code. Please try again later.' });
            }
            res.status(200).json({ message: "Verification code sent to email." });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json("Internal server error");
    }
};

// REGISTER
export const register = async (req, res) => {
    try {
        const { verificationCode } = req.body;

        const cacheData = await executeQuery(
            "SELECT * FROM cache WHERE verificationCode = ?",
            [verificationCode]
        );

        if (!cacheData.length) {
            return res.status(400).json("Verification code expired or invalid.");
        }

        const { email, full_name, password } = cacheData[0];

        const hashedPassword = bcrypt.hashSync(password, bcrypt.genSaltSync(10));

        const defaultProfilePicKey = process.env.DEFAULT_PROFILE_PIC_KEY;
        const defaultCoverPhotoKey = process.env.DEFAULT_COVER_PHOTO_KEY;

        const insertResult = await executeQuery(
            "INSERT INTO users (email, full_name, password, profilePic, coverPhoto) VALUES (?)",
            [[email, full_name, hashedPassword, defaultProfilePicKey, defaultCoverPhotoKey]]
        );

        await executeQuery("DELETE FROM cache WHERE email = ?", [email]);

        const token = jwt.sign({ id: insertResult.insertId }, process.env.SECRET_KEY);
        res.cookie("accessToken", token, { httpOnly: true }).status(200).json({
            message: "User created successfully",
            token,
            user: {
                id: insertResult.insertId,
                email,
                fullName: full_name,
                profilePicUrl: await generateS3Url(defaultProfilePicKey),
                coverPhotoUrl: await generateS3Url(defaultCoverPhotoKey),
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json("Internal server error");
    }
};

// LOGIN
export const login = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const searchField = username ? "username" : "email";
        const searchValue = username || email;

        let user = userCache.get(searchValue);

        if (!user){
             const users = await executeQuery(
                `SELECT * FROM users WHERE ${searchField} = ?`,
                [searchValue]
            );

            if (!users.length) {
                return res.status(404).json({ message: "Username or email not found!" });
            }
           user = users[0];
            userCache.set(searchValue, user)
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(400).json({ message: "Wrong password" });
        }

        // HANDLE SUCCESSFUL LOGIN
        await handleSuccessfulLogin(req, res, user);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
};

// GOOGLE SIGN-IN API
export const googleSignIn = async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ message: "Google ID token is required." });
        }

        const GOOGLE_CLIENT_ID = [
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_ANDROID_CLIENT_ID,
            process.env.GOOGLE_IOS_CLIENT_ID
        ];

        // Add await here - verifyIdToken returns a Promise
        const ticket = await client.verifyIdToken({
            idToken,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const { email, name, picture } = payload;

        // CHECK IF USER EXISTS
        const existingUsers = await executeQuery("SELECT * FROM users WHERE email = ?", [email]);

        let user; 
        if (existingUsers.length > 0) {
            user = existingUsers[0];
            userCache.set(email, user);
        } else {
            // CREATE NEW USER IF NOT EXISTS
            const defaultCoverPhotoKey = process.env.DEFAULT_COVER_PHOTO_KEY;
            
            let username = email.split('@')[0];
            let isUsernameTaken = (await executeQuery("SELECT id FROM users WHERE username = ?", [username])).length > 0;
            while (isUsernameTaken) {
                const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                username = `${username}${randomSuffix}`;
                isUsernameTaken = (await executeQuery("SELECT id FROM users WHERE username = ?", [username])).length > 0;
            }

            const newUserPayload = {
                email,
                full_name: name,
                username: username,
                password: null,
                profilePic: picture, 
                coverPhoto: defaultCoverPhotoKey
            };

            const insertResult = await executeQuery("INSERT INTO users SET ?", newUserPayload);
            
            // Fix this line too - executeQuery returns an array directly
            const newUserRows = await executeQuery("SELECT * FROM users WHERE id = ?", [insertResult.insertId]);
            user = newUserRows[0];
        }

        // HANDLE SUCCESSFUL LOGIN
        await handleSuccessfulLogin(req, res, user);

    } catch (err) {
        console.error("Google Sign-In Error:", err);
        if (err.message.includes("Invalid token signature")) {
            return res.status(401).json({ message: "Invalid Google token. Please try again." });
        }
        res.status(500).json({ message: "Internal server error during Google Sign-In." });
    }
};


// LOGOUT
export const logout = (req, res) => {
    res.clearCookie("accessToken", { secure: true, sameSite: "none" }).status(200).json("Logged out successfully");
};

// DELETE EXPIRED VERIFICATION CODES
const deleteExpiredCodes = async () => {
    try {
        await executeQuery("DELETE FROM cache WHERE expiresAt < ?", [new Date()]);
    } catch (err) {
        console.error("Error deleting expired codes:", err);
    }
};

// SCHEDULE DELETION EVERY HOUR
setInterval(deleteExpiredCodes, 60 * 60 * 1000);
deleteExpiredCodes();