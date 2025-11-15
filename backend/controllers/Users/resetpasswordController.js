import crypto from 'crypto';
import bcrypt from "bcryptjs";
import { db } from '../../config/connectDB.js';
import { transporter } from '../../middlewares/mailTransportConfig.js';
import { authenticateUser } from '../../middlewares/verify.mjs';

export const forgotPassword = (req, res) => { 
    const findEmail = "SELECT * FROM users WHERE `email` = ?";
    const email = req.body.email;
    db.query(findEmail, [email], (err, results) => {
        if (err) {
            console.error("Error finding user:", err); 
            return res.status(500).send('Error occurred while finding the user.');
        }
        if (results.length === 0) {
            return res.status(400).send('No account with that email address exists.');
        }
        const user = results[0];
        const token = crypto.randomBytes(20).toString('hex');
        const resetPasswordExpires = new Date(Date.now() + 2 * 60 * 60 * 1000);

        const updateToken = "UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?";

        db.query(updateToken, [token, resetPasswordExpires, email], (err) => {
            if (err) {
                console.error("Error updating token:", err);
                return res.status(500).send('Error occurred while updating the user with the reset token.');
            }

            const resetLink = `https://beta.weebform.com/reset/${token}`;

            const mailOptions = {
                to: user.email,
                from: process.env.EMAIL_USER,
                subject: 'WEEBFORM - Password Reset Request',
                html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #000000;">
                    <div style="text-align: center; margin-bottom: 20px; padding: 0px 40px 0px 40px">
                        <img src="https://weebform.com/wp-content/uploads/2024/12/cropped-43b3193e-814b-4a9d-a367-daa917d5ddb5-300x300.jpg" alt="WEEBFORM Logo" style="max-width: 150px;">
                    </div>
                    <h2>Hello,</h2>
                    <p>You are receiving this because you (or someone else) has requested a password reset for your WEEBFORM account.</p>
                    <p>Please click the following link to reset your password.  This link will expire in 2 hours:</p>
                    <p><a href="${resetLink}" style="color: #CF833F; text-decoration: none;">Reset Your Password</a></p>
                    <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
                    <p>Best regards,</p>
                    <p>The WEEBFORM Team</p>
                </div>
            `,
            };

            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    console.error("Error sending email:", err);
                    return res.status(500).send(`Error occurred while sending the reset email. ${err.message}`); // Include more detail
                }

                console.log("Email sent:", info.messageId);
                res.status(200).send(`A password reset email has been sent to ${user.email}. Please check your inbox.`);
            });
        });
    });
};


export const resetPassword = (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    const findToken = "SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?"; // Check expiration

    db.query(findToken, [token, Date.now()], (err, result) => {
        if (err) {
            console.error("Error finding token:", err);
            return res.status(500).send('Server error while validating the reset token.');
        }

        if (result.length === 0) {
            return res.status(400).send('Password reset token is invalid or has expired.');
        }

        const user = result[0];

        bcrypt.genSalt(10, (err, salt) => {
            if (err) {
                console.error("Error generating salt:", err);
                return res.status(500).send('Server error during password hashing.');
            }

            bcrypt.hash(password, salt, (err, hashedPassword) => {
                if (err) {
                    console.error("Error hashing password:", err);
                    return res.status(500).send('Server error during password hashing.');
                }

                const updatePassword = `UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE email = ?`;

                db.query(updatePassword, [hashedPassword, user.email], (err) => {
                    if (err) {
                        console.error("Error updating password:", err);
                        return res.status(500).send('Error updating the password in the database.');
                    }

                    // Send confirmation email
                    const mailOptions = {
                        to: user.email,
                        from: process.env.EMAIL_USER,
                        subject: 'WEEBFORM - Password Successfully Reset',
                        html: `
                            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #000000;">
                                <div style="text-align: center; margin-bottom: 20px; padding: 0px 40px 0px 40px">
                                    <img src="https://weebform.com/wp-content/uploads/2024/12/cropped-43b3193e-814b-4a9d-a367-daa917d5ddb5-300x300.jpg" alt="WEEBFORM Logo" style="max-width: 150px;">
                                </div>
                                <h2>Hello,</h2>
                                <p>Your password for your WEEBFORM account has been successfully reset.</p>
                                <p>If you did not initiate this password reset, please contact us immediately.</p>
                                <p>Best regards,</p>
                                <p>The WEEBFORM Team</p>
                            </div>
                        `,
                    };

                    transporter.sendMail(mailOptions, (err, info) => {
                        if (err) {
                            console.error("Error sending confirmation email:", err);
                            return res.status(500).send('Password has been successfully reset, but there was an error sending the confirmation email.');
                        }

                        console.log("Confirmation email sent:", info.messageId);
                        res.status(200).send('Password has been successfully reset. A confirmation email has been sent to your address.');
                    });
                });
            });
        });
    });
};


export const editPassword = (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;
            const [users] = await db.promise().query("SELECT password FROM users WHERE id = ?", [userId]);
            if (users.length === 0) {
                return res.status(404).json({ message: "User not found." });
            }
            const user = users[0];

            const isMatch = await bcrypt.compare(currentPassword, user.password);   
            if (!isMatch) {
                return res.status(400).json({ message: "Current password is incorrect." });
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            await db.promise().query("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId]);
            res.status(200).json({ message: "Password updated successfully." });
        } catch (err) {
            console.error("Error updating password:", err);
            res.status(500).json({ message: "Server error while updating password." });
        }
    });
}