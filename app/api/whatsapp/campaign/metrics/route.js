import { NextResponse } from "next/server";
import { db } from "@/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { REENGAGEMENT_STATES } from "@/lib/whatsappAutomation";

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaignId");

    const logsSnapshot = campaignId
      ? await getDocs(
          query(collection(db, "whatsappCampaignLogs"), where("campaignId", "==", campaignId))
        )
      : await getDocs(query(collection(db, "whatsappCampaignLogs")));

    const leadsSnapshot = await getDocs(query(collection(db, "leads")));
    const logs = logsSnapshot.docs.map((entry) => entry.data());
    const leads = leadsSnapshot.docs.map((entry) => entry.data());

    const metrics = {
      sent: logs.length,
      delivered: logs.length, // Meta statuses can later replace this estimate.
      repliedA: leads.filter((lead) => lead.reengagementState === REENGAGEMENT_STATES.interested)
        .length,
      repliedB: leads.filter((lead) => lead.reengagementState === REENGAGEMENT_STATES.notInterested)
        .length,
      booked: leads.filter((lead) => lead.reengagementState === REENGAGEMENT_STATES.booked).length,
      noResponse: leads.filter((lead) => lead.reengagementState === REENGAGEMENT_STATES.pending)
        .length,
    };

    return NextResponse.json({ campaignId, metrics });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to build campaign metrics", details: error.message },
      { status: 500 }
    );
  }
}

