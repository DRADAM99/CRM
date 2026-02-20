import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

function readServiceAccountFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64) {
    const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64, "base64").toString("utf8");
    return JSON.parse(raw);
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON);
  }
  const keyPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    const raw = readFileSync(keyPath, "utf8");
    return JSON.parse(raw);
  }
  return null;
}

function ensureAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = readServiceAccountFromEnv();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
    });
  }

  // Fallback for environments that provide ADC (e.g. Google Cloud runtime).
  return initializeApp({
    credential: applicationDefault(),
  });
}

export function getAdminDb() {
  return getFirestore(ensureAdminApp());
}

export function adminServerTimestamp() {
  return FieldValue.serverTimestamp();
}

