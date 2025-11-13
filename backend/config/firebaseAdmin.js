import admin from 'firebase-admin';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log('[Firebase] Admin SDK initialized successfully.');
    } catch (error) {
        console.error('[Firebase Error] Failed to initialize Firebase Admin SDK:', error);
        process.exit(1);
    }
}

export default admin;