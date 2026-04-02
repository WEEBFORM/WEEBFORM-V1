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

const isValidCountryCode = (code) =>
    typeof code === 'string' && /^[A-Z]{2}$/.test(code);

const getExchangeRates = async () => {
    let rates = exchangeCache.get("rates");
    if (!rates) {
        try {
            // Hard 5s timeout — never let this hang the whole request
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

// ─── Payment Config ───────────────────────────────────────────────────────────
export const getPaymentConfig = async (req, res) => {
    // Wrap authenticateUser callback in try/catch — if anything throws inside,
    // it previously caused a silent hang until the client timed out.
    authenticateUser(req, res, async () => {
        try {
            const t0 = Date.now();
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ message: "Unauthorised — no user on request" });
            }

            const clientCountry = req.headers['x-client-country']?.trim().toUpperCase();
            const countryCode   = isValidCountryCode(clientCountry) ? clientCountry : 'US';

            console.log(`[PaymentConfig] START userId=${userId} country=${countryCode}`);

            const isAfrica = africanCountries.includes(countryCode);

            // Determine currency
            let localCurrency = getCurrency[countryCode] || 'USD';
            if (!flwSupportedCurrencies.includes(localCurrency)) {
                localCurrency = 'USD';
            }

            // Fetch exchange rates (cached after first call, 5s hard timeout)
            const rates = await getExchangeRates();
            console.log(`[PaymentConfig] rates ready: ${Date.now() - t0}ms`);

            // Calculate pricing
            let monthlyPrice, yearlyPrice;

            if (countryCode === 'NG') {
                monthlyPrice  = 99;
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

            const [users] = await db.promise().query(
                "SELECT email, full_name, username FROM users WHERE id = ?",
                [userId]
            );
            console.log(`[PaymentConfig] DB query done: ${Date.now() - t0}ms`);

            if (!users.length) {
                return res.status(404).json({ message: "User not found" });
            }

            res.status(200).json({
                currency: localCurrency,
                country:  countryCode,
                prices: {
                    monthly:  monthlyPrice,
                    annually: yearlyPrice,
                },
                user: users[0],
            });

            console.log(`[PaymentConfig] DONE: ${Date.now() - t0}ms`);

        } catch (error) {
            // Catches errors that previously caused silent hangs
            console.error("[PaymentConfig] Handler error:", error.message);
            if (!res.headersSent) {
                res.status(500).json({ message: "Server error", error: error.message });
            }
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

    // Acknowledge immediately — Flutterwave retries if it doesn't get 200 quickly
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

            // Verify with Flutterwave before touching the DB
            const verifyRes = await axios.get(
                `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
                { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
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

            if (plan !== 'monthly' && plan !== 'annually') {
                console.error(`[Webhook] Unrecognised plan "${plan}" in tx_ref: ${txRef}`);
                return;
            }

            const interval = plan === 'monthly' ? '1 MONTH' : '1 YEAR';

            const [updateResult] = await db.promise().query(
                `UPDATE users
                 SET role                  = 'premium',
                     subscription_plan     = ?,
                     subscription_end_date = DATE_ADD(NOW(), INTERVAL ${interval}),
                     last_transaction_id   = ?
                 WHERE id = ?`,
                [plan, transactionId, userId]
            );

            if (updateResult.affectedRows === 0) {
                console.error(`[Webhook] UPDATE matched 0 rows — userId ${userId} may not exist.`);
            } else {
                console.log(`[Webhook] User ${userId} upgraded to ${plan} premium. TxID: ${transactionId}`);
            }

        } catch (error) {
            console.error("[Webhook] Processing error:", error.message);
        }
    }
};