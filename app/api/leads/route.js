// /app/api/leads/route.js

import { db } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function POST(req) {
  try {
    const data = await req.json();

    if (!data.full_name || !data.phone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
      });
    }

    await addDoc(collection(db, "leads"), {
      fullName: data.full_name,
      phoneNumber: data.phone,
      message: data.message || "",
      email: data.email || "",
      source: data.source || "unknown",
      status: "חדש",
      createdAt: serverTimestamp(),
      conversationSummary: [],
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
    });

  } catch (error) {
    console.error("Error saving lead:", error);
    return new Response(JSON.stringify({ error: "Failed to process lead" }), {
      status: 500,
    });
  }
}

