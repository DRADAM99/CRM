import { NextResponse } from "next/server";
import { getAdminDb, adminServerTimestamp } from "@/lib/firebaseAdmin";
import { getDefaultAvailability, normalizeAvailability } from "@/lib/availability";
import { writeAutomationEvent } from "@/lib/automationServer";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const staffId = url.searchParams.get("staffId");
    const db = getAdminDb();

    if (staffId) {
      const snapshot = await db.collection("staffAvailability").doc(staffId).get();
      if (!snapshot.exists) {
        return NextResponse.json({
          staffId,
          availability: getDefaultAvailability(),
        });
      }
      return NextResponse.json({
        staffId,
        availability: normalizeAvailability(snapshot.data()?.availability),
      });
    }

    const snapshot = await db.collection("staffAvailability").get();
    const availability = snapshot.docs.map((entry) => ({
      staffId: entry.id,
      availability: normalizeAvailability(entry.data()?.availability),
      updatedAt: entry.data()?.updatedAt || null,
      updatedBy: entry.data()?.updatedBy || null,
    }));
    return NextResponse.json({ availability });
  } catch (error) {
    const details = error.message || "Unknown error";
    if (details.includes("Missing or insufficient permissions")) {
      return NextResponse.json(
        {
          error: "Availability backend lacks Firestore permissions",
          details,
          hint: "Configure server-side admin credentials for staff availability endpoints",
        },
        { status: 503 }
      );
    }
    if (details.includes("Unable to detect a Project Id") || details.includes("Could not load the default credentials")) {
      return NextResponse.json(
        {
          error: "Firebase Admin credentials are not configured",
          details,
          hint: "Set FIREBASE_SERVICE_ACCOUNT_KEY_JSON (or BASE64) in environment",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to load staff availability", details },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { staffId, availability, updatedBy = "crm_user" } = body || {};
    if (!staffId) {
      return NextResponse.json({ error: "staffId is required" }, { status: 400 });
    }
    const db = getAdminDb();

    const normalized = normalizeAvailability(availability);
    await db.collection("staffAvailability").doc(staffId).set(
      {
        staffId,
        availability: normalized,
        updatedBy,
        updatedAt: adminServerTimestamp(),
      },
      { merge: true }
    );
    await writeAutomationEvent("staff_availability_updated", { staffId, updatedBy });
    return NextResponse.json({ success: true, staffId, availability: normalized });
  } catch (error) {
    const details = error.message || "Unknown error";
    if (details.includes("Missing or insufficient permissions")) {
      return NextResponse.json(
        {
          error: "Availability backend lacks Firestore permissions",
          details,
          hint: "Configure server-side admin credentials for staff availability endpoints",
        },
        { status: 503 }
      );
    }
    if (details.includes("Unable to detect a Project Id") || details.includes("Could not load the default credentials")) {
      return NextResponse.json(
        {
          error: "Firebase Admin credentials are not configured",
          details,
          hint: "Set FIREBASE_SERVICE_ACCOUNT_KEY_JSON (or BASE64) in environment",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to save staff availability", details },
      { status: 500 }
    );
  }
}

