import crypto from 'crypto';
import nodemailer from 'nodemailer';
import bcrypt from "bcryptjs";
import { db } from '../../config/connectDB.js';

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
        console.error('SMTP verification failed:',  error);
    } else {
        //console.log("SMTP server is ready to take our messages");
    }
});


export const forgotPassword = (req, res) => {
    const findEmail = "SELECT * FROM users WHERE `email` = ?";
    const email = req.body.email;
    db.query(findEmail, [email], (err, results) => {
        if (err) {
            return res.status(500).send('Error occurred while finding the user.');
        }
        if (results.length === 0) {
            return res.status(400).send('No account with that email address exists.');
        }
        const user = results[0];
        const token = crypto.randomBytes(20).toString('hex');
        const resetPasswordExpires = Date.now() + 2 * 60 * 60;

        const updateToken = "UPDATE users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE email = ?";
        
        db.query(updateToken, [token, resetPasswordExpires, email], (err) => {
            if (err) {
                return res.status(500).send('Error occurred while updating the user with the reset token.'); 
            }

            const mailOptions = {
                to: user.email,
                from: process.env.EMAIL_USER,
                subject: 'Password Reset',
                text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n` +
                      `Please click on the following link, or paste this into your browser to complete the process:\n\n` +
                      `http://weebform.com/reset/${token}\n\n` +
                      `If you did not request this, please ignore this email and your password will remain unchanged.\n`
            };

            transporter.sendMail(mailOptions, (err) => {
                if (err) {
                    return res.status(500).send('Error occurred while sending the email.', err);
                }

                res.status(200).send(`An email has been sent to ${user.email} with further instructions.`);
            });
        });
    });
};


export const resetPassword = (req, res) => {
    const { token } = req.params;
    const { password } = req.body;
  
    const findToken = "SELECT * FROM users WHERE resetPasswordToken = ?";
    db.query(findToken, [token, Date.now()], (err, result) => {
      if (err) {
        return res.status(500).send('Server error.');
      }
  
      if (result.length === 0) {
        return res.status(400).send('Password reset token is invalid or has expired.');
      }
  
      const user = result[0];
      const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(req.body.password, salt);
      const updatePassword = `UPDATE users SET password = ?, resetPasswordToken = NULL, resetPasswordExpires = NULL WHERE email = ?`;
  
      db.query(updatePassword, [hashedPassword, user.email], (err) => {
        if (err) {
          return res.status(500).send('Error updating the password.');
        }
  
        res.status(200).send('Password has been successfully reset.');
      });
    });
  };
  