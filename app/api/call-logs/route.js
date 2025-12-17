// /app/api/call-logs/route.js
// API proxy for MasterPBX call log requests

// MasterPBX credentials (same as used in click2call)
const PBX_BASE_URL = "https://master.ippbx.co.il/ippbx_api/v1.4/api/info";
const PBX_TOKEN_ID = "22K3TWfeifaCPUyA";

// Helper function to create a response with CORS headers
function createResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
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
    const { startDate, endDate, extensionNumber } = data;

    // Validate required fields
    if (!startDate || !endDate) {
      return createResponse({ 
        error: "Missing required fields",
        details: "startDate and endDate are required (YYYY-MM-DD format)"
      }, 400);
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      return createResponse({ 
        error: "Invalid date format",
        details: "Dates must be in YYYY-MM-DD format"
      }, 400);
    }

    // Build the MasterPBX API URL
    // Format: /api/info/{startDate}/{endDate}/TENANT/callLog
    const pbxUrl = `${PBX_BASE_URL}/${startDate}/${endDate}/TENANT/callLog`;

    // Build the request payload
    const payload = {
      token_id: PBX_TOKEN_ID,
    };

    // Add extension number filter if provided
    if (extensionNumber) {
      payload.number = String(extensionNumber);
    }

    console.log("Fetching call logs from MasterPBX:", {
      url: pbxUrl,
      extensionNumber: extensionNumber || "all",
      dateRange: `${startDate} to ${endDate}`
    });

    // Make the request to MasterPBX
    const pbxResponse = await fetch(pbxUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload)
    });

    const pbxData = await pbxResponse.json();

    console.log("MasterPBX response status:", pbxData.status, "message:", pbxData.message);
    console.log("MasterPBX sample data:", pbxData.data?.[0] ? JSON.stringify(pbxData.data[0], null, 2) : "no data");

    // Handle "no data found" as valid empty response (not an error)
    if (pbxData.status === "ERROR" && pbxData.message?.includes("Not Found")) {
      console.log("No call logs found for this date/extension - returning empty array");
      return createResponse({
        success: true,
        data: [],
        count: 0,
        dateRange: { startDate, endDate },
        extensionNumber: extensionNumber || null,
        message: "אין שיחות בתאריך זה"
      });
    }

    // Check for actual API errors
    if (pbxData.status !== "SUCCESS") {
      console.error("MasterPBX API error:", pbxData);
      return createResponse({
        success: false,
        error: "MasterPBX API error",
        details: pbxData.message || "Unknown error",
        status: pbxData.status
      }, 200); // Return 200 so frontend can handle gracefully
    }

    // Process and format the call log data
    const callLogs = (pbxData.data || []).map(call => {
      // Calculate duration in seconds from answer_sec field (more accurate)
      const answerSeconds = parseInt(call.answer_sec) || 0;
      // Fallback to calculating from start/end times
      const startTime = new Date(call.start_date);
      const endTime = new Date(call.end_date);
      const calculatedSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
      const durationSeconds = answerSeconds > 0 ? answerSeconds : calculatedSeconds;

      return {
        id: `${call.start_date}-${call.caller}-${call.callee}`,
        callId: call.callid,
        startDate: call.start_date,
        endDate: call.end_date,
        answerTime: call.answer_time,
        caller: call.caller,
        callerName: call.caller_name,
        callee: call.callee,
        calleeName: call.callee_name,
        forward: call.forward,
        durationSeconds,
        durationFormatted: formatDuration(durationSeconds),
        callStatus: call.call_status,
        // Determine call direction based on extension number
        direction: extensionNumber ? 
          (call.caller === String(extensionNumber) ? 'outgoing' : 'incoming') : 
          'unknown',
        incomingCharges: call.incoming_call_charges,
        outgoingCharges: call.outgoing_call_charges,
        // Recording info - unique_token is used to fetch recording
        // Only show recording for answered calls with duration > 5 seconds
        uniqueToken: call.unique_token,
        hasRecording: call.call_status === 'Answered' && answerSeconds >= 5 && call.unique_token,
      };
    });

    // Sort by start date descending (newest first)
    callLogs.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    return createResponse({
      success: true,
      data: callLogs,
      count: callLogs.length,
      dateRange: { startDate, endDate },
      extensionNumber: extensionNumber || null
    });

  } catch (error) {
    console.error("Error fetching call logs:", {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return createResponse({ 
      error: "Failed to fetch call logs",
      details: error.message,
      type: error.name
    }, 500);
  }
}

// Helper function to format duration as HH:MM:SS or MM:SS
function formatDuration(totalSeconds) {
  if (totalSeconds < 0) return "0:00";
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

