import express from 'express';
import { getPaymentConfig, flutterwaveWebhook } from '../../controllers/Users/payment.js';

const router = express.Router();

router.get('/config', getPaymentConfig);
router.post('/webhook', express.json(), flutterwaveWebhook); // Webhook hit by Flutterwave servers

export default router;