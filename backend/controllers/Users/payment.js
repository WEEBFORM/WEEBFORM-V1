import axios from 'axios';
import getCurrency from 'country-to-currency';
import NodeCache from 'node-cache';
import { db } from "../../config/connectDB.js";

const exchangeCache = new NodeCache({ stdTTL: 43200 });
const africanCountries = ["DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CD","CG","CI","DJ","EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU","YT","MA","MZ","NA","NE","NG","RE","RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG","EH","ZM","ZW"];
const flwSupportedCurrencies = ["NGN","GHS","KES","UGX","TZS","ZAR","RWF","XOF","XAF","USD","GBP","EUR"];

const getExchangeRates = async () => {
    let rates = exchangeCache.get("rates");
    if (!rates) {
        try {
            const response = await axios.get(
                "https://api.exchangerate-api.com/v4/latest/USD",
                { timeout: 5000 }
            );
            rates = response.data.rates;
            exchangeCache.set("rates", rates);
        } catch (error) {
            console.error("Failed to fetch exchange rates, using fallback:", error.message);
            rates = { USD: 1, NGN: 1500, EUR: 0.92, GBP: 0.79, ZAR: 19,
                      GHS: 11, KES: 130, UGX: 3735, TZS: 2600, RWF: 1460,
                      XOF: 566, XAF: 566 };
        }
    }
    return rates;
};

export const getPaymentConfig = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ message: "Unauthorised — no user on request" });

        const clientCountry = req.headers['x-client-country']?.trim().toUpperCase();
        const countryCode   = /^[A-Z]{2}$/.test(clientCountry) ? clientCountry : 'US';

        const isAfrica = africanCountries.includes(countryCode);
        let localCurrency = getCurrency[countryCode] || 'USD';
        if (!flwSupportedCurrencies.includes(localCurrency)) localCurrency = 'USD';

        const rates = await getExchangeRates();
        let monthlyPrice, yearlyPrice;

        if (countryCode === 'NG') {
            monthlyPrice = 99; yearlyPrice = 5999; localCurrency = 'NGN';
        } else if (isAfrica) {
            monthlyPrice = Math.ceil((599 / rates['NGN']) * rates[localCurrency]);
            yearlyPrice = Math.ceil((5999 / rates['NGN']) * rates[localCurrency]);
        } else {
            monthlyPrice = Number((1.99 * rates[localCurrency]).toFixed(2));
            yearlyPrice = Number((19.99 * rates[localCurrency]).toFixed(2));
        }

        const [users] = await db.promise().query("SELECT email, full_name, username FROM users WHERE id = ?", [userId]);
        if (!users.length) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ currency: localCurrency, country: countryCode, prices: { monthly: monthlyPrice, annually: yearlyPrice }, user: users[0] });
    } catch (error) {
        console.error("[PaymentConfig] Handler error:", error.message);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const flutterwaveWebhook = async (req, res) => {
    const secretHash = process.env.FLW_WEBHOOK_HASH;
    const signature  = req.headers["verif-hash"];

    if (!signature || signature !== secretHash) {
        return res.status(401).end();
    }

    // Acknowledge immediately to prevent Flutterwave timeouts
    res.status(200).end();

    const payload = req.body;
    if (payload.event === "charge.completed" && payload.data.status === "successful") {
        const transactionId = payload.data.id;
        const txRef = payload.data.tx_ref;

        try {
            const [existing] = await db.promise().query("SELECT id FROM users WHERE last_transaction_id = ?", [transactionId]);
            if (existing.length) return; // Already processed

            const verifyRes = await axios.get(
                `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
                { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
            );

            if (verifyRes.data.data.status !== "successful") return;

            const parts = txRef.split('_');
            const plan = parts[1];  // "monthly" or "annually"
            const userId = parts[2]; // Can be UUID or Int.
            
            // FIX: Removed `isNaN` check because UUID string IDs trigger it and abort the database update silently.
            if (!plan || !userId) return console.error(`[Webhook] Invalid tx_ref: ${txRef}`);

            const interval = plan === 'monthly' ? '1 MONTH' : '1 YEAR';

            const [updateResult] = await db.promise().query(
                `UPDATE users SET role = 'premium', subscription_plan = ?, subscription_end_date = DATE_ADD(NOW(), INTERVAL ${interval}), last_transaction_id = ? WHERE id = ?`,
                [plan, transactionId, userId]
            );

            if (updateResult.affectedRows > 0) {
                 console.log(`[Webhook] User ${userId} upgraded. TxID: ${transactionId}`);
            }
        } catch (error) {
            console.error("[Webhook] Processing error:", error.message);
        }
    }
};