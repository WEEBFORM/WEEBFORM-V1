import axios from 'axios';
import geoip from 'geoip-lite';
import getCurrency from 'country-to-currency';
import NodeCache from 'node-cache';
import { db } from "../../config/connectDB.js";
import { authenticateUser } from "../../middlewares/verify.mjs";

// Cache exchange rates for 12 hours to avoid API rate limits
const exchangeCache = new NodeCache({ stdTTL: 43200 }); 

// List of African country codes (ISO 2-letter)
const africanCountries =[
    "DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CD","CG","CI","DJ","EG","GQ",
    "ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU",
    "YT","MA","MZ","NA","NE","NG","RE","RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ",
    "TG","TN","UG","EH","ZM","ZW"
];

// Currencies natively supported by Flutterwave
const flwSupportedCurrencies =["NGN", "GHS", "KES", "UGX", "TZS", "ZAR", "RWF", "XOF", "XAF", "USD", "GBP", "EUR"];

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

export const getPaymentConfig = async (req, res) => {
    authenticateUser(req, res, async () => {
        const userId = req.user.id;

        // 1. Get User IP & Country (handle proxy chains correctly)
        let ip = req.headers['x-forwarded-for']
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : req.socket.remoteAddress;

        // Strip IPv6-mapped IPv4 prefix
        if (ip && ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');

        // Fallback to Nigerian IP for local dev
        if (!ip || ip === '127.0.0.1' || ip === '::1') ip = '102.89.0.0';

        const geo = geoip.lookup(ip);
        const countryCode = geo ? geo.country : 'US';
        const isAfrica = africanCountries.includes(countryCode);

        // 2. Determine Local Currency
        let localCurrency = getCurrency(countryCode) || 'USD'; // ← fixed: call as function
        if (!flwSupportedCurrencies.includes(localCurrency)) {
            localCurrency = 'USD';
        }

        // 3. Fetch Exchange Rates
        const rates = await getExchangeRates();

        // 4. Calculate Dynamic Pricing
        let monthlyPrice = 0;
        let yearlyPrice = 0;

        if (countryCode === 'NG') {
            monthlyPrice = 599;
            yearlyPrice = 5999;
            localCurrency = 'NGN';
        } else if (isAfrica) {
            const ngnToUsd = 599 / rates['NGN'];
            const ngnToUsdYearly = 5999 / rates['NGN'];
            monthlyPrice = ngnToUsd * rates[localCurrency];
            yearlyPrice = ngnToUsdYearly * rates[localCurrency];
        } else {
            monthlyPrice = 1.99 * rates[localCurrency];
            yearlyPrice = 19.99 * rates[localCurrency];
        }

        monthlyPrice = isAfrica ? Math.ceil(monthlyPrice) : Number(monthlyPrice.toFixed(2));
        yearlyPrice = isAfrica ? Math.ceil(yearlyPrice) : Number(yearlyPrice.toFixed(2));

        try {
            const [users] = await db.promise().query(
                "SELECT email, full_name, username FROM users WHERE id = ?", [userId]
            );
            if (!users.length) return res.status(404).json({ message: "User not found" });

            res.status(200).json({
                currency: localCurrency,
                country: countryCode,
                prices: { monthly: monthlyPrice, annually: yearlyPrice },
                user: users[0]
            });
        } catch (error) {
            res.status(500).json({ message: "Server error", error: error.message });
        }
    });
};

// Webhook for Flutterwave to verify payment
export const flutterwaveWebhook = async (req, res) => {
    const secretHash = process.env.FLW_WEBHOOK_HASH;
    const signature = req.headers["verif-hash"];

    if (!signature || signature !== secretHash) {
        return res.status(401).end();
    }

    const payload = req.body;

    if (payload.event === "charge.completed" && payload.data.status === "successful") {
        const transactionId = payload.data.id;
        const txRef = payload.data.tx_ref; // Format: "sub_monthly_userId_uuid"
        
        try {
            // Verify payment directly with Flutterwave API for strict security
            const response = await axios.get(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
                headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` }
            });

            if (response.data.data.status === "successful") {
                const parts = txRef.split('_'); 
                const plan = parts[1]; // 'monthly' or 'annually'
                const userId = parts[2]; // User ID
                
                const interval = plan === 'monthly' ? '1 MONTH' : '1 YEAR';

                // Update Database
                const q = `
                    UPDATE users 
                    SET 
                        role = 'premium', 
                        subscription_plan = ?, 
                        subscription_end_date = DATE_ADD(NOW(), INTERVAL ${interval})
                    WHERE id = ?
                `;
                
                await db.promise().query(q, [plan, userId]);
                console.log(`User ${userId} upgraded to ${plan} premium via Flutterwave.`);
            }
        } catch (error) {
            console.error("Webhook processing error:", error.message);
        }
    }

    res.status(200).end(); // Always acknowledge receipt to stop Flutterwave from retrying
};