// app/api/click2call/route.js
import { NextResponse } from 'next/server';

// Use Edge Runtime to potentially bypass IP blocks and reduce latency
export const runtime = 'edge';
export const preferredRegion = 'fra1'; // Frankfurt, closer to Israel

const PBX_BASE_URL = "https://master.ippbx.co.il/ippbx_api/v1.4/api/info/click2call";
const PBX_TOKEN_ID = "22K3TWfeifaCPUyA";
const PBX_EXTENSION_PASSWORD = "bdb307dc55bf1e679c296ee5c73215cb";

export async function POST(req) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for Edge

  try {
    const { phone_number, extension_number } = await req.json();

    if (!phone_number || !extension_number) {
      return NextResponse.json({ error: "Missing phone_number or extension_number" }, { status: 400 });
    }

    // Prepare payload
    const payload = {
      token_id: PBX_TOKEN_ID,
      phone_number: String(phone_number).replace(/\D/g, ''), // Digits only
      extension_number: String(extension_number),
      extension_password: PBX_EXTENSION_PASSWORD
    };

    console.log(`[Click2Call Edge] Proxying for EXT ${extension_number} to ${phone_number}`);

    const response = await fetch(PBX_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    const data = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch (e) {
      jsonData = { message: data };
    }

    if (!response.ok) {
      console.error("[Click2Call Edge] PBX Error:", data);
      return NextResponse.json(jsonData, { status: response.status });
    }

    return NextResponse.json(jsonData);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return NextResponse.json({ 
        error: "PBX Timeout (Edge)", 
        details: "The PBX server took too long to respond. This usually means their firewall is blocking the Edge network IPs." 
      }, { status: 504 });
    }
    console.error("[Click2Call Edge] Proxy Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
