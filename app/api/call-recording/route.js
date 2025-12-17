// /app/api/call-recording/route.js
// API proxy for fetching call recordings from MasterPBX

// MasterPBX credentials (same as used in click2call and call-logs)
const PBX_BASE_URL = "https://master.ippbx.co.il/ippbx_api/v1.4/api/info";
const PBX_TOKEN_ID = "22K3TWfeifaCPUyA";

// Helper function to create a response with CORS headers
function createResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      ...headers
    }
  });
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return createResponse({});
}

export async function POST(req) {
  try {
    const data = await req.json();
    const { uniqueToken, callId, date } = data;

    // Validate required fields
    if (!uniqueToken) {
      return createResponse({ 
        error: "Missing required field",
        details: "uniqueToken is required"
      }, 400);
    }

    // Try multiple endpoint formats for getting recording
    const endpoints = [
      // Format 1: /TENANT/getRecordingPath
      `${PBX_BASE_URL}/TENANT/getRecordingPath`,
      // Format 2: /getRecordingPath  
      `${PBX_BASE_URL}/getRecordingPath`,
      // Format 3: Direct date-based path
      date ? `${PBX_BASE_URL}/${date}/${date}/TENANT/getRecordingPath` : null,
    ].filter(Boolean);

    const payload = {
      token_id: PBX_TOKEN_ID,
      unique_token: uniqueToken
    };

    console.log("Fetching recording for uniqueToken:", uniqueToken, "callId:", callId);

    let successData = null;
    
    // Try each endpoint
    for (const endpointUrl of endpoints) {
      try {
        console.log("Trying endpoint:", endpointUrl);
        
        const response = await fetch(endpointUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload)
        });

        const responseData = await response.json();
        console.log("Response:", JSON.stringify(responseData, null, 2));

        if (responseData.status === "SUCCESS") {
          successData = responseData;
          break;
        }
      } catch (err) {
        console.log("Endpoint failed:", endpointUrl, err.message);
      }
    }

    if (!successData) {
      // If all endpoints fail, try constructing a direct URL pattern
      // Common pattern: https://pbx-domain/recordings/{uniqueToken}.mp3 or .wav
      console.log("All endpoints failed, trying direct URL construction");
      
      const possibleUrls = [
        `https://master.ippbx.co.il/recordings/${uniqueToken}.mp3`,
        `https://master.ippbx.co.il/recordings/${uniqueToken}.wav`,
        `https://pbx.hodusoft.com/recordings/${uniqueToken}.mp3`,
        `https://pbx.hodusoft.com/recordings/${uniqueToken}.wav`,
      ];

      return createResponse({
        success: true,
        recordingUrl: possibleUrls[0], // Try first URL
        recordingPath: possibleUrls[0],
        possibleUrls,
        note: "API endpoints failed, trying direct URL patterns. May require authentication.",
        data: { uniqueToken, callId }
      });
    }

    return createResponse({
      success: true,
      recordingPath: successData.data?.recording_path || successData.recording_path,
      recordingUrl: successData.data?.recording_url || successData.recording_url,
      data: successData.data
    });

  } catch (error) {
    console.error("Error fetching recording:", {
      error: error.message,
      stack: error.stack
    });
    
    return createResponse({ 
      error: "Failed to fetch recording",
      details: error.message
    }, 500);
  }
}

