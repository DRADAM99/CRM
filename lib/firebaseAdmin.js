import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

function readServiceAccountFromEnv() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64) {
    try {
      const raw = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64.trim(),
        "base64"
      ).toString("utf8");
      return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY_BASE64:", e.message);
    }
  }
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON.trim());
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY_JSON:", e.message);
    }
  }
  const keyPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyPath) {
    try {
      const raw = readFileSync(keyPath, "utf8");
      return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to read service account file:", e.message);
    }
  }
  return null;
}

function ensureAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = readServiceAccountFromEnv();
  const projectId =
    serviceAccount?.project_id ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    "crm-dashboard-2db5f";

  if (serviceAccount) {
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }

  // Fallback for environments that provide ADC (e.g. Google Cloud runtime).
  console.warn("No service account found — falling back to applicationDefault(). Project:", projectId);
  return initializeApp({ credential: applicationDefault(), projectId });
}

export function getAdminDb() {
  return getFirestore(ensureAdminApp());
}

export function adminServerTimestamp() {
  return FieldValue.serverTimestamp();
}

