import nodemailer from "nodemailer";
import { config } from "dotenv";
config();

export const transporter = nodemailer.createTransport({
    host: 'mail.hostinger.com',
    port: 465,
    secure: true, // Use SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    tls: {
        rejectUnauthorized: false
    },
    debug: true // Enable debugging
}); 

transporter.verify((error, success) => {
    if (error) {
        console.error('SMTP verification failed:', error);
    } else {
        console.log("SMTP server is ready to take our messages");
    }
});
