import { getApps, initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

function readServiceAccountFromEnv() {
  // Strategy 1: Individual env vars (most reliable on Vercel — simple strings, no JSON formatting issues)
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "crm-dashboard-2db5f";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail && rawPrivateKey) {
    // Vercel wraps multi-line values in quotes and keeps \n as literal backslash-n — normalize both cases.
    const privateKey = rawPrivateKey.replace(/\\n/g, "\n");
    return { type: "service_account", project_id: projectId, client_email: clientEmail, private_key: privateKey };
  }

  // Strategy 2: Base64-encoded full JSON
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

  // Strategy 3: Raw JSON string
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON.trim());
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY_JSON:", e.message);
    }
  }

  // Strategy 4: Local file path (dev only)
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
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    "crm-dashboard-2db5f";

  if (serviceAccount) {
    console.log("Firebase Admin: initializing with service account for project:", projectId);
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }

  console.warn("Firebase Admin: no service account found — falling back to applicationDefault(). Project:", projectId);
  return initializeApp({ credential: applicationDefault(), projectId });
}

export function getAdminDb() {
  return getFirestore(ensureAdminApp());
}

export function adminServerTimestamp() {
  return FieldValue.serverTimestamp();
}

