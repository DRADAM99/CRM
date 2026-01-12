// app/api/click2call/route.js
import { NextResponse } from 'next/server';

const PBX_BASE_URL = "https://master.ippbx.co.il/ippbx_api/v1.4/api/info/click2call";
const PBX_TOKEN_ID = "22K3TWfeifaCPUyA";
const PBX_EXTENSION_PASSWORD = "bdb307dc55bf1e679c296ee5c73215cb";

export async function POST(req) {
  try {
    const { phone_number, extension_number } = await req.json();

    if (!phone_number || !extension_number) {
      return NextResponse.json({ error: "Missing phone_number or extension_number" }, { status: 400 });
    }

    const payload = {
      token_id: PBX_TOKEN_ID,
      phone_number: String(phone_number).replace(/^#/, ''),
      extension_number: String(extension_number),
      extension_password: PBX_EXTENSION_PASSWORD
    };

    console.log("Proxying click2call request to MasterPBX:", {
      extension_number,
      phone_number: payload.phone_number
    });

    const response = await fetch(PBX_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload)
    });

    const data = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch (e) {
      jsonData = { message: data };
    }

    if (!response.ok) {
      console.error("MasterPBX click2call error:", data);
      return NextResponse.json(jsonData || { error: "Failed to initiate call via PBX" }, { status: response.status });
    }

    return NextResponse.json(jsonData);
  } catch (error) {
    console.error("Error in click2call proxy:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
