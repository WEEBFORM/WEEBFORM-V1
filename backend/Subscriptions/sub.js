import { executeQuery } from "../middlewares/dbExecute.js";
import stripe from "stripe";
import cron from "node-cron";
import config from "dotenv";
config();

const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

export const upgradeToPremium = async (userId, plan, transactionId) => {
    let expiryDate = new Date();
    if (plan === "monthly") expiryDate.setMonth(expiryDate.getMonth() + 1);
    else if (plan === "yearly") expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    await executeQuery(
        "INSERT INTO subscriptions (userId, plan, status, expiry_date) VALUES (?, ?, 'active', ?)",
        [userId, plan, expiryDate]
    );
    await executeQuery(
        "UPDATE users SET role = 'premium', subscription_expiry = ? WHERE id = ?",
        [expiryDate, userId]
    );
    await executeQuery(
        "UPDATE transactions SET payment_status = 'completed' WHERE id = ?",
        [transactionId]
    );
};


export const stripeWebhook = async (req, res) => {
    const event = req.body;
    if (event.type === "checkout.session.completed") {
        const { user_id, plan } = event.data.object.metadata;
        await upgradeToPremium(user_id, plan, event.data.object.id);
    }
    res.sendStatus(200); 
};

// Scheduled task to downgrade expired subscriptions
dailyJob = cron.schedule("0 0 * * *", async () => {
    await executeQuery(
        "UPDATE users SET role = 'free', subscription_expiry = NULL WHERE subscription_expiry < NOW() AND role IN ('premium', 'admin')"
    );
    await executeQuery(
        "UPDATE subscriptions SET status = 'expired' WHERE expiry_date < NOW() AND status = 'active'"
    );
    console.log("Expired subscriptions processed.");
});