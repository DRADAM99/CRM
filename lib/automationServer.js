import { getAdminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";
import { normalizePhoneNumber } from "@/lib/phoneUtils";

export async function writeAutomationEvent(type, payload = {}) {
  try {
    const db = getAdminDb();
    await db.collection("automationEvents").add({
      type,
      payload,
      createdAt: adminServerTimestamp(),
    });
  } catch (error) {
    console.error("automationEvents write failed:", error?.message || error);
  }
}

export async function hasProcessedIdempotencyKey(key, scope) {
  if (!key || !scope) return false;
  const db = getAdminDb();
  const snapshot = await db
    .collection("automationIdempotency")
    .where("key", "==", key)
    .where("scope", "==", scope)
    .limit(1)
    .get();
  return !snapshot.empty;
}

export async function markIdempotencyKey(key, scope, metadata = {}) {
  if (!key || !scope) return;
  const db = getAdminDb();
  await db.collection("automationIdempotency").add({
    key,
    scope,
    metadata,
    createdAt: adminServerTimestamp(),
  });
}

export async function findLeadByPhone(rawPhone) {
  const db = getAdminDb();
  const normalized = normalizePhoneNumber(String(rawPhone || ""));
  if (!normalized) return null;

  const directMatches = await db
    .collection("leads")
    .where("phoneNumber", "==", normalized)
    .limit(20)
    .get();
  if (!directMatches.empty) {
    const sortedByCreatedAt = [...directMatches.docs].sort((a, b) => {
      const aCreated = a.data()?.createdAt?.toDate?.()?.getTime?.() || 0;
      const bCreated = b.data()?.createdAt?.toDate?.()?.getTime?.() || 0;
      return bCreated - aCreated;
    });
    const document = sortedByCreatedAt[0];
    return { id: document.id, ...document.data() };
  }

  // Fallback for mixed phone formats in historical data.
  const recentLeads = await db.collection("leads").orderBy("createdAt", "desc").limit(300).get();
  const matched = recentLeads.docs.find((entry) => {
    const leadPhone = normalizePhoneNumber(entry.data()?.phoneNumber || "");
    return leadPhone === normalized;
  });
  if (!matched) return null;
  return { id: matched.id, ...matched.data() };
}

export async function readStaffDoc(staffId) {
  if (!staffId) return null;
  const db = getAdminDb();
  const snapshot = await db.collection("users").doc(staffId).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

export async function resolveStaffUser({
  staffId,
  email,
  alias,
  fallbackEmail,
  fallbackAlias,
} = {}) {
  const db = getAdminDb();

  if (staffId) {
    const byId = await readStaffDoc(staffId);
    if (byId) return byId;
  }

  const emailToCheck = email || fallbackEmail;
  if (emailToCheck) {
    const emailSnap = await db
      .collection("users")
      .where("email", "==", emailToCheck)
      .limit(1)
      .get();
    if (!emailSnap.empty) {
      const found = emailSnap.docs[0];
      return { id: found.id, ...found.data() };
    }
  }

  const aliasToCheck = alias || fallbackAlias;
  if (aliasToCheck) {
    const aliasSnap = await db
      .collection("users")
      .where("alias", "==", aliasToCheck)
      .limit(1)
      .get();
    if (!aliasSnap.empty) {
      const found = aliasSnap.docs[0];
      return { id: found.id, ...found.data() };
    }
  }

  return null;
}

