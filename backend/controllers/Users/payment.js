import axios from 'axios';
import geoip from 'geoip-lite';
import getCurrency from 'country-to-currency';
import NodeCache from 'node-cache';
import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";

// Cache exchange rates for 12 hours to avoid API rate limits
const exchangeCache = new NodeCache({ stdTTL: 43200 });

// List of African country codes (ISO 2-letter)
const africanCountries = [
    "DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CD","CG","CI","DJ","EG","GQ",
    "ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU",
    "YT","MA","MZ","NA","NE","NG","RE","RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ",
    "TG","TN","UG","EH","ZM","ZW"
];

// Currencies natively supported by Flutterwave
const flwSupportedCurrencies = ["NGN","GHS","KES","UGX","TZS","ZAR","RWF","XOF","XAF","USD","GBP","EUR"];

// Fetch live exchange rates (Base USD)
const getExchangeRates = async () => {
    let rates = exchangeCache.get("rates");
    if (!rates) {
        try {
            const response = await axios.get("https://api.exchangerate-api.com/v4/latest/USD");
            rates = response.data.rates;
            exchangeCache.set("rates", rates);
        } catch (error) {
            console.error("Failed to fetch exchange rates:", error.message);
            // Fallback rates if API fails
            rates = { USD: 1, NGN: 1500, EUR: 0.92, GBP: 0.79, ZAR: 19 };
        }
    }
    return rates;
};

// ─── FIX 1: Robust IP extraction ─────────────────────────────────────────────
// x-forwarded-for can be a comma-separated list like "clientIP, proxy1, proxy2".
// We always want the first (leftmost) IP — that's the real client IP.
const extractClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // Take only the first IP in the list and strip whitespace
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress;
};

export const getPaymentConfig = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;

        // 1. Get User IP & Country (with reliable IP extraction)
        let ip = extractClientIp(req);

        // For local dev: fall back to a Nigerian IP so you can test NGN pricing
        if (!ip || ip === '127.0.0.1' || ip === '::1') {
            ip = '102.89.0.0';
        }

        const geo = geoip.lookup(ip);
        const countryCode = geo ? geo.country : 'US';
        const isAfrica = africanCountries.includes(countryCode);

        // 2. Determine Local Currency (fallback to USD if Flutterwave doesn't support it)
        let localCurrency = getCurrency[countryCode] || 'USD';
        if (!flwSupportedCurrencies.includes(localCurrency)) {
            localCurrency = 'USD';
        }

        // 3. Fetch Exchange Rates
        const rates = await getExchangeRates();

        // 4. Calculate Dynamic Pricing
        let monthlyPrice = 0;
        let yearlyPrice = 0;

        if (countryCode === 'NG') {
            // Strictly Fixed for Nigeria
            monthlyPrice = 599;
            yearlyPrice = 5999;
            localCurrency = 'NGN';
        } else if (isAfrica) {
            // African Equivalent of NGN 599 / 5999
            const ngnToUsd = 599 / rates['NGN'];
            const ngnToUsdYearly = 5999 / rates['NGN'];
            monthlyPrice = ngnToUsd * rates[localCurrency];
            yearlyPrice = ngnToUsdYearly * rates[localCurrency];
        } else {
            // Rest of the World: equivalent of $1.99 / $19.99
            monthlyPrice = 1.99 * rates[localCurrency];
            yearlyPrice = 19.99 * rates[localCurrency];
        }

        // Round up to nearest whole number for African currencies, 2dp for others
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
                country: countryCode,
                prices: {
                    monthly: monthlyPrice,
                    annually: yearlyPrice,
                },
                user: users[0],
            });
        } catch (error) {
            res.status(500).json({ message: "Server error", error: error.message });
        }
    });
};

// ─── FIX 2: Reliable webhook with idempotency guard ──────────────────────────
// The webhook MUST be the source of truth for upgrading users. We add:
//   (a) An idempotency check so replayed webhooks don't double-process.
//   (b) Correct parsing of tx_ref — format: sub_<plan>_<userId>_<uuid>
//       "plan" may be "monthly" or "annually" (no underscores in those words),
//       and userId is numeric, so we can safely split and grab indices 1 and 2.
export const flutterwaveWebhook = async (req, res) => {
    const secretHash = process.env.FLW_WEBHOOK_HASH;
    const signature  = req.headers["verif-hash"];

    if (!signature || signature !== secretHash) {
        return res.status(401).end();
    }

    // Always acknowledge immediately — Flutterwave retries if it doesn't get 200 fast
    res.status(200).end();

    const payload = req.body;

    if (payload.event === "charge.completed" && payload.data.status === "successful") {
        const transactionId = payload.data.id;
        const txRef         = payload.data.tx_ref; // "sub_monthly_userId_uuid" or "sub_annually_userId_uuid"

        try {
            // ── Idempotency: skip if this transaction was already processed ──
            const [existing] = await db.promise().query(
                "SELECT id FROM users WHERE last_transaction_id = ?",
                [transactionId]
            );
            if (existing.length) {
                console.log(`[Webhook] Transaction ${transactionId} already processed. Skipping.`);
                return;
            }

            // ── Verify with Flutterwave API (source of truth) ────────────────
            const verifyRes = await axios.get(
                `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
                { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
            );

            if (verifyRes.data.data.status !== "successful") {
                console.warn(`[Webhook] Transaction ${transactionId} verification failed.`);
                return;
            }

            // ── Parse tx_ref ─────────────────────────────────────────────────
            // Format guaranteed by frontend: sub_monthly_<userId>_<uuid>
            //                             or sub_annually_<userId>_<uuid>
            const parts  = txRef.split('_');
            const plan   = parts[1];           // "monthly" or "annually"
            const userId = parts[2];           // numeric user id

            if (!plan || !userId || isNaN(Number(userId))) {
                console.error(`[Webhook] Invalid tx_ref format: ${txRef}`);
                return;
            }

            const interval = plan === 'monthly' ? '1 MONTH' : '1 YEAR';

            // ── Update DB: upgrade user and store transaction id for idempotency
            await db.promise().query(
                `UPDATE users
                 SET role                 = 'premium',
                     subscription_plan   = ?,
                     subscription_end_date = DATE_ADD(NOW(), INTERVAL ${interval}),
                     last_transaction_id = ?
                 WHERE id = ?`,
                [plan, transactionId, userId]
            );

            console.log(`[Webhook] User ${userId} upgraded to ${plan} premium. TxID: ${transactionId}`);
        } catch (error) {
            console.error("[Webhook] Processing error:", error.message);
        }
    }
};