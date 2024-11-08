import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { db } from "../../config/connectDB.js";
import multer from "multer";
import { errorHandler } from "../../middlewares/errors.mjs";
import { config } from "dotenv";
config();
 
// HANDLE MEDIA PROCESSING LOGIC
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

const cpUpload = upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'coverPhoto', maxCount: 1 }
]);


// EMAIL CONFIGURATION
const transporter = nodemailer.createTransport({
    host: 'smtp.titan.email', 
    port: 587,
    secure: false, 
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false 
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP verification failed:', error);
    } else {
        console.log("SMTP server is ready to take our messages");
    }
});

//API TO INITIATE REGISTRATION
export const initiateRegistration = (req, res, next) => {
    
        try {
            // CHECK FOR EXISTING USERNAME OR EMAIL
            const q = "SELECT * FROM users WHERE username = ? OR email = ?";
            const storedUser = [req.body.username, req.body.email];

            db.query(q, storedUser, (err, data) => {
                if (err) return res.status(500).json(err);
                if (data.length) {
                    // CONFIRM EXISTING CREDENTIAL
                    let existingUser = [];
                    data.forEach(user => {
                        if (user.username === req.body.username) existingUser.push("Username");
                        if (user.email === req.body.email) existingUser.push("Email");
                    });

                    return res.status(409).json(`${existingUser.join(" and ")} already in use!`);
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
                    subject: 'Account Verification Code',
                    text: `Welcome to WEEBFORM! Your verification code is ${verificationCode}. This code expires in 5 minutes.`
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
            next(errorHandler);
        }
};

// API TO REGISTER NEW USERS
export const register = (req, res, next) => {
    try {
        const verificationCode = req.body.verificationCode;
        const q = "SELECT * FROM cache WHERE verificationCode = ?";
        db.query(q, [verificationCode], (err, data) => {
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

            const i = "INSERT INTO users (`email`, `full_name`, `password`) VALUES (?)";
            const values = [
                cachedData.email,
                cachedData.fullName,
                hashedPassword
            ];
            db.query(i, [values], (err, insertResult) => {
                if (err) {
                    return res.status(500).json(err);
                }
                const deleteQuery = "DELETE FROM cache WHERE email = ?";
                db.query(deleteQuery, [cachedData.email], (err) => {
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
                            full_name: cachedData.full_name
                        } 
                    });
                });
            });
        });
    } catch(err) { 
        console.log(err);
        res.status(500).json('Internal server error!');
    };
};

// API FOR USER LOGIN
export const login = (req, res) => {
    // DETERMINE INPUT FIELD (EMAIL/USERNAME)
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
    //QUERY DB TO CHECK FOR USER
    const q = `SELECT * FROM users AS u WHERE ${searchField}`;
    db.query(q, value, (err, data) => {
        if (err) return res.status(500).json(err);
        if (data.length === 0) return res.status(404).json("Username or email not found!");
        // CONFIRM PASSWORD
        const confirmPassword = bcrypt.compareSync(req.body.password, data[0].password);
        if (!confirmPassword) return res.status(400).json('Wrong password');
        const { password, ...others } = data[0];
        const token = jwt.sign({ id: data[0].id }, process.env.Secretkey);
        res.cookie("accessToken", token, {
            httpOnly: true
        }).status(200).json({ message: "User Logged in successfully", token, others }); 
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
 