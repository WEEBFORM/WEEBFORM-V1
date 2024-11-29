import nodemailer from "nodemailer";
import { config } from "dotenv";
config();

export const transporter = nodemailer.createTransport({
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
