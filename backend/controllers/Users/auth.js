import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import geoip from 'geoip-lite';
import { transporter } from "../../middlewares/mailTransportConfig.js";
import { generateS3Url } from "../../middlewares/S3bucketConfig.js";
import { executeQuery } from "../../middlewares/dbExecute.js";
import { config } from "dotenv";
import NodeCache from 'node-cache';
import { createNotification } from "../Notifications/notificationsController.js";

config();

const userCache = new NodeCache({ stdTTL: 300 }); // Cache user data for 5 minutes

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

        const userAgent = req.headers['user-agent'];
        
        // IP EXTRACTION WITH FALLBACKS(MULTIPLE PROXY SUPPORT)
        let ip = req.headers['x-forwarded-for'] || 
                 req.headers['x-real-ip'] || 
                 req.connection.remoteAddress || 
                 req.socket.remoteAddress;
        
        // IF MULTIPLE IPS, TAKE THE FIRST ONE (CLIENT'S IP)
        if (ip && ip.includes(',')) {
            ip = ip.split(',')[0].trim();
        }
        
        // REMOVE IPV6 PREFIX IF PRESENT
        if (ip && ip.startsWith('::ffff:')) {
            ip = ip.substring(7);
        }

        let location = "an unrecognized location";
        
        // TRY GEOIP-LOOKUP FIRST
        const geo = geoip.lookup(ip);
        if (geo && geo.city && geo.country) {
            location = `${geo.city}, ${geo.country}`;
        } else if (geo && geo.country) {
            location = geo.country;
        } else {
            // FALLBACK TO IP API IF GEOIP LOOKUP FAILS
            try {
                const geoResponse = await fetch(`http://ip-api.com/json/${ip}`);
                const geoData = await geoResponse.json();
                
                if (geoData.status === 'success') {
                    location = geoData.city ? 
                        `${geoData.city}, ${geoData.country}` : 
                        geoData.country;
                }
            } catch (geoError) {
                console.error('Geolocation lookup failed:', geoError);
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

        const loginTime = new Date().toLocaleString();
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "New Login Notification",
            html: `
                <p>Hi ${user.username},</p>
                <p>There was a recent login to your account with the following details:</p>
                <ul>
                    <li><strong>Date and Time:</strong> ${loginTime}</li>
                    <li><strong>Device:</strong> ${device}</li>
                    <li><strong>Location:</strong> ${location}</li>
                </ul>
                <p>If this wasn't you, please secure your account immediately.</p>
            `
        };

        transporter.sendMail(mailOptions);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
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
deleteExpiredCodes();