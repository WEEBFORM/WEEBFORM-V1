import express from 'express';
import stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import authenticateUser from '../middlewares/verify.mjs';
import { executeQuery } from '../middlewares/dbExecute.js';
import config from "dotenv";
config();

const router = express.Router();
const stripeInstance = stripe(process.env.STRIPE_SECRET_KEY);

router.post('/create-checkout-session', authenticateUser(), async (req, res) => {
    const { plan } = req.body;
    const userId = req.user.id;
    const session = await stripeInstance.checkout.sessions.create({
        line_items: [
            {
                price: plan === 'monthly' ? process.env.STRIPE_MONTHLY_PRICE_ID : process.env.STRIPE_YEARLY_PRICE_ID,
                quantity: 1,
            },
        ],
        mode: 'subscription',
        metadata: {
            user_id: userId,
            plan: plan,
        },
        success_url: `${process.env.CLIENT_URL}/success?session_id={CHECKOUT_SESSION_ID}`, // Replace with your success URL
        cancel_url: `${process.env.CLIENT_URL}/cancel`, // Replace with your cancel URL,
    });

    const transactionId = session.id
    await executeQuery(
        "INSERT INTO transactions (id, userId, plan, amount, payment_status) VALUES (?, ?, ?, ?, ?)",
        [transactionId, userId, plan, session.amount_total / 100, "pending"]
    );

    res.json({ url: session.url, transactionId: transactionId });

});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.metadata.user_id;
        const plan = session.metadata.plan;
        const transactionId = session.id

        try {
            // Update the database with the successful transaction
            await executeQuery(
                "UPDATE users SET role = 'premium', subscription_expiry = DATE_ADD(NOW(), INTERVAL 1 MONTH) WHERE id = ?",
                [userId]
            );

            await executeQuery(
                "UPDATE transactions SET payment_status = 'completed' WHERE id = ?",
                [transactionId]
            );

            console.log(`User ${userId} upgraded to ${plan} successfully.`);
        } catch (error) {
            console.error("Failed to update database after successful payment:", error);
            return res.status(500).send('Failed to update database');
        }
    }

    res.status(200).end();
});

export default router;