import axios from 'axios';
import getCurrency from 'country-to-currency';
import NodeCache from 'node-cache';
import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";

// Cache exchange rates for 12 hours
const exchangeCache = new NodeCache({ stdTTL: 43200 });

const africanCountries = [
    "DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CD","CG","CI","DJ","EG","GQ",
    "ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU",
    "YT","MA","MZ","NA","NE","NG","RE","RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ",
    "TG","TN","UG","EH","ZM","ZW"
];

const flwSupportedCurrencies = ["NGN","GHS","KES","UGX","TZS","ZAR","RWF","XOF","XAF","USD","GBP","EUR"];

// Valid ISO 3166-1 alpha-2 country code check
const isValidCountryCode = (code) =>
    typeof code === 'string' && /^[A-Z]{2}$/.test(code);

const getExchangeRates = async () => {
    let rates = exchangeCache.get("rates");
    if (rates) return rates; // instant cache hit

    try {
        const response = await axios.get(
            "https://api.exchangerate-api.com/v4/latest/USD",
            { timeout: 5000 } // ← fail fast, don't block the endpoint
        );
        rates = response.data.rates;
        exchangeCache.set("rates", rates);
    } catch (error) {
        console.error("Failed to fetch exchange rates:", error.message);
        // Broad fallback covering all FLW-supported African currencies
        rates = {
            USD: 1,    NGN: 1580, EUR: 0.92, GBP: 0.79,
            ZAR: 19,   KES: 130,  GHS: 15,   UGX: 3800,
            TZS: 2700, RWF: 1300, XOF: 600,  XAF: 600,
        };
        // Cache fallback too — stops hammering a dead API on every request
        exchangeCache.set("rates", rates);
    }
    return rates;
};

export const getPaymentConfig = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;

        // Country is detected on the client (ip-api.com) and forwarded here.
        // This avoids all server-side IP/proxy detection issues.
        const clientCountry = req.headers['x-client-country']?.trim().toUpperCase();
        const countryCode   = isValidCountryCode(clientCountry) ? clientCountry : 'US';

        console.log(`[PaymentConfig] userId=${userId} country=${countryCode} (client-sent: ${clientCountry})`);

        const isAfrica = africanCountries.includes(countryCode);

        // getCurrency is a FUNCTION, not an object — call it correctly
        let localCurrency = getCurrency(countryCode) || 'USD';
        if (!flwSupportedCurrencies.includes(localCurrency)) {
            localCurrency = 'USD';
        }

        const rates = await getExchangeRates();

        let monthlyPrice, yearlyPrice;

        if (countryCode === 'NG') {
            monthlyPrice  = 199;
            yearlyPrice   = 5999;
            localCurrency = 'NGN';
        } else if (isAfrica) {
            const ngnToUsd       = 599  / rates['NGN'];
            const ngnToUsdYearly = 5999 / rates['NGN'];
            monthlyPrice = ngnToUsd       * rates[localCurrency];
            yearlyPrice  = ngnToUsdYearly * rates[localCurrency];
        } else {
            monthlyPrice = 1.99  * rates[localCurrency];
            yearlyPrice  = 19.99 * rates[localCurrency];
        }

        monthlyPrice = isAfrica ? Math.ceil(monthlyPrice) : Number(monthlyPrice.toFixed(2));
        yearlyPrice  = isAfrica ? Math.ceil(yearlyPrice)  : Number(yearlyPrice.toFixed(2));

        try {
            const [users] = await db.promise().query(
                "SELECT email, full_name, username FROM users WHERE id = ?",
                [userId]
            );
            if (!users.length) return res.status(404).json({ message: "User not found" });

            res.status(200).json({
                currency: localCurrency,
                country:  countryCode,
                prices: {
                    monthly:  monthlyPrice,
                    annually: yearlyPrice,
                },
                user: users[0],
            });
        } catch (error) {
            res.status(500).json({ message: "Server error", error: error.message });
        }
    });
};

// ─── Flutterwave Webhook ──────────────────────────────────────────────────────
export const flutterwaveWebhook = async (req, res) => {
    const secretHash = process.env.FLW_WEBHOOK_HASH;
    const signature  = req.headers["verif-hash"];

    if (!signature || signature !== secretHash) {
        return res.status(401).end();
    }

    // Acknowledge immediately — Flutterwave retries if it doesn't get 200 fast
    res.status(200).end();

    const payload = req.body;

    if (payload.event === "charge.completed" && payload.data.status === "successful") {
        const transactionId = payload.data.id;
        const txRef         = payload.data.tx_ref;

        try {
            // Idempotency: skip already-processed transactions
            const [existing] = await db.promise().query(
                "SELECT id FROM users WHERE last_transaction_id = ?",
                [transactionId]
            );
            if (existing.length) {
                console.log(`[Webhook] Transaction ${transactionId} already processed. Skipping.`);
                return;
            }

            // Verify with Flutterwave (with timeout so it doesn't hang)
            const verifyRes = await axios.get(
                `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
                {
                    headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` },
                    timeout: 8000,
                }
            );

            if (verifyRes.data.data.status !== "successful") {
                console.warn(`[Webhook] Transaction ${transactionId} not verified.`);
                return;
            }

            // tx_ref format: sub_monthly_<userId>_<uuid> or sub_annually_<userId>_<uuid>
            const parts  = txRef.split('_');
            const plan   = parts[1];  // "monthly" or "annually"
            const userId = parts[2];  // numeric user id

            if (!plan || !userId || isNaN(Number(userId))) {
                console.error(`[Webhook] Invalid tx_ref format: ${txRef}`);
                return;
            }

            const interval = plan === 'monthly' ? '1 MONTH' : '1 YEAR';

            await db.promise().query(
                `UPDATE users
                 SET role                  = 'premium',
                     subscription_plan     = ?,
                     subscription_end_date = DATE_ADD(NOW(), INTERVAL ${interval}),
                     last_transaction_id   = ?
                 WHERE id = ?`,
                [plan, transactionId, userId]
            );

            console.log(`[Webhook] User ${userId} → ${plan} premium. TxID: ${transactionId}`);
        } catch (error) {
            console.error("[Webhook] Processing error:", error.message);
        }
    }
};