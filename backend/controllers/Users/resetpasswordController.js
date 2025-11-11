import crypto from 'crypto';
import bcrypt from "bcryptjs";
import { db } from '../../config/connectDB.js';
import { emailQueue } from '../../config/queueConfig.js';
import { authenticateUser } from '../../middlewares/verify.mjs';

export const forgotPassword = async (req, res) => {
    try {
        const email = req.body.email;
        const findEmailQuery = "SELECT * FROM users WHERE `email` = ?";
        const [results] = await db.promise().query(findEmailQuery, [email]);

        if (results.length === 0) {
            return res.status(404).send('No account with that email address exists.');
        }

        const user = results[0];
        const token = crypto.randomBytes(20).toString('hex');
        const resetPasswordExpires = Date.now() + 2 * 60 * 60 * 1000; // 2 hours

        const updateTokenQuery = "UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?";
        await db.promise().query(updateTokenQuery, [token, resetPasswordExpires, email]);

        const resetLink = `https://beta.weebform.com/reset/${token}`;
        const mailOptions = {
            to: user.email,
            subject: 'WEEBFORM - Password Reset Request',
            html: `... (your password reset email HTML) ...`
        };

        await emailQueue.add('sendPasswordReset', mailOptions);

        res.status(200).send(`A password reset email has been sent to ${user.email}.`);

    } catch (err) {
        console.error("Error in forgotPassword:", err);
        return res.status(500).send('An error occurred. Please try again later.');
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const findTokenQuery = "SELECT * FROM users WHERE resetPasswordToken = ? AND resetPasswordExpires > ?";
        const [results] = await db.promise().query(findTokenQuery, [token, Date.now()]);

        if (results.length === 0) {
            return res.status(400).send('Password reset token is invalid or has expired.');
        }

        const user = results[0];
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const updatePasswordQuery = `UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE email = ?`;
        await db.promise().query(updatePasswordQuery, [hashedPassword, user.email]);

        // SEND CONFIRMATION EMAIL
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
        await emailQueue.add('sendResetConfirmation', mailOptions);

        res.status(200).send('Password has been successfully reset.');

    } catch (err) {
        console.error("Error in resetPassword:", err);
        return res.status(500).send('An error occurred during the password reset process.');
    }
};

export const editPassword = async (req, res) => {
    authenticateUser(req, res, async () => {
        try {
            const authenticatedUser = req.user;
            if (!authenticatedUser) {
                return res.status(401).send('Unauthorized. Please log in.');
            }
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body; 

            const findUserQuery = "SELECT * FROM users WHERE id = ?";
            const [results] = await db.promise().query(findUserQuery, [userId]);
            if (results.length === 0) {
                return res.status(404).send('User not found.');
            }
            const user = results[0];
            const isMatch = await bcrypt.compare(currentPassword, user.password);       
            if (!isMatch) {
                return res.status(400).send('Current password is incorrect.');
            }   
            const salt = await bcrypt.genSalt(10);
            const hashedNewPassword = await bcrypt.hash(newPassword, salt);       
            const updatePasswordQuery = "UPDATE users SET password = ? WHERE id = ?";
            await db.promise().query(updatePasswordQuery, [hashedNewPassword, userId]);

            //PASSWORD CHANGE CONFIRMATION EMAIL
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
        await emailQueue.add('sendPasswordChange', mailOptions); 
             
            res.status(200).json('Password has been successfully updated.');
        } catch (err) {
            console.error("Error in editPassword:", err);
            return res.status(500).send('An error occurred while updating the password.');
        } 
    });     
};