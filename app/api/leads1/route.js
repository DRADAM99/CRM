// /app/api/leads/route.js

import { db } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(request) {
  try {
    const body = await request.json();

    const { full_name, phone, source, message, email } = body;

    // Basic validation
    if (!full_name || !phone || !source || !message || !email) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
      });
    }

    const newLead = {
      full_name,
      phone,
      source,
      message,
      email,
      status: "new",
      createdAt: serverTimestamp(),
      conversationSummary: [],
    };

    await addDoc(collection(db, "leads"), newLead);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error("Error saving lead:", error);
    return new Response(JSON.stringify({ error: "Failed to process lead" }), {
      status: 500,
    });
  }
}
