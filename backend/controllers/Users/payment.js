import axios from 'axios';
import getCurrency from 'country-to-currency';
import NodeCache from 'node-cache';
import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";

// Cache exchange rates for 12 hours
const exchangeCache = new NodeCache({ stdTTL: 43200 });

// Cache IP lookups for 1 hour — same user won't re-geolocate on every request
const geoCache = new NodeCache({ stdTTL: 3600 });

const africanCountries = [
    "DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CD","CG","CI","DJ","EG","GQ",
    "ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU",
    "YT","MA","MZ","NA","NE","NG","RE","RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ",
    "TG","TN","UG","EH","ZM","ZW"
];

const flwSupportedCurrencies = ["NGN","GHS","KES","UGX","TZS","ZAR","RWF","XOF","XAF","USD","GBP","EUR"];

// ─── Extract the real client IP from proxy headers ────────────────────────────
const extractClientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress;
};

// ─── Geolocate via ip-api.com (free, 45 req/min, no key needed) ──────────────
// This replaces geoip-lite which ships with a static bundled DB that goes stale
// and misidentifies newer IP ranges (common with African ISPs like MTN, Airtel).
const getCountryFromIp = async (ip) => {
    // Return cached result if available
    const cached = geoCache.get(ip);
    if (cached) return cached;

    try {
        // ip-api.com returns accurate, live data — free tier allows 45 req/min
        const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,countryCode`, {
            timeout: 4000,
        });

        if (response.data.status === 'success') {
            const countryCode = response.data.countryCode;
            geoCache.set(ip, countryCode);
            return countryCode;
        }
    } catch (error) {
        console.error(`[GeoIP] ip-api.com failed for ${ip}:`, error.message);
    }

    // Fallback: try a second provider (ipapi.co) if ip-api.com fails
    try {
        const fallback = await axios.get(`https://ipapi.co/${ip}/country/`, {
            timeout: 4000,
        });
        const countryCode = fallback.data?.trim();
        if (countryCode && countryCode.length === 2) {
            geoCache.set(ip, countryCode);
            return countryCode;
        }
    } catch (err) {
        console.error(`[GeoIP] ipapi.co fallback also failed for ${ip}:`, err.message);
    }

    return null; // Both providers failed
};

const getExchangeRates = async () => {
    let rates = exchangeCache.get("rates");
    if (!rates) {
        try {
            const response = await axios.get("https://api.exchangerate-api.com/v4/latest/USD");
            rates = response.data.rates;
            exchangeCache.set("rates", rates);
        } catch (error) {
            console.error("Failed to fetch exchange rates:", error.message);
            rates = { USD: 1, NGN: 1500, EUR: 0.92, GBP: 0.79, ZAR: 19 };
        }
    }
    return rates;
};

export const getPaymentConfig = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;

        // 1. Extract IP
        let ip = extractClientIp(req);
        const isLocalDev = !ip || ip === '127.0.0.1' || ip === '::1';

        // 2. Geolocate — use live API, skip for localhost (use NG as dev default)
        let countryCode;
        if (isLocalDev) {
            countryCode = 'NG'; // local dev always tests Nigerian pricing
            console.log('[GeoIP] Local dev detected — defaulting to NG');
        } else {
            countryCode = await getCountryFromIp(ip);
            if (!countryCode) {
                console.warn(`[GeoIP] Could not resolve country for IP ${ip} — defaulting to US`);
                countryCode = 'US';
            }
        }

        console.log(`[GeoIP] IP: ${ip} → Country: ${countryCode}`);

        const isAfrica = africanCountries.includes(countryCode);

        // 3. Determine currency
        let localCurrency = getCurrency[countryCode] || 'USD';
        if (!flwSupportedCurrencies.includes(localCurrency)) {
            localCurrency = 'USD';
        }

        // 4. Fetch exchange rates
        const rates = await getExchangeRates();

        // 5. Calculate pricing
        let monthlyPrice, yearlyPrice;

        if (countryCode === 'NG') {
            monthlyPrice = 599;
            yearlyPrice  = 5999;
            localCurrency = 'NGN';
        } else if (isAfrica) {
            const ngnToUsd        = 599  / rates['NGN'];
            const ngnToUsdYearly  = 5999 / rates['NGN'];
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

            // Verify with Flutterwave
            const verifyRes = await axios.get(
                `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
                { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
            );

            if (verifyRes.data.data.status !== "successful") {
                console.warn(`[Webhook] Transaction ${transactionId} not verified.`);
                return;
            }

            // Parse tx_ref: sub_monthly_<userId>_<uuid> or sub_annually_<userId>_<uuid>
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

            console.log(`[Webhook] User ${userId} upgraded to ${plan} premium. TxID: ${transactionId}`);
        } catch (error) {
            console.error("[Webhook] Processing error:", error.message);
        }
    }
};