import axios from "axios"

export async function createZoomMeeting(topic: string, startTime: string, duration: number) {
  // In a real application, you would implement Server-to-Server OAuth
  // https://developers.zoom.us/docs/internal-apps/s2s-oauth/
  
  const accountId = process.env.ZOOM_ACCOUNT_ID
  const clientId = process.env.ZOOM_CLIENT_ID
  const clientSecret = process.env.ZOOM_CLIENT_SECRET

  if (!accountId || !clientId || !clientSecret) {
    console.warn("Zoom credentials missing, mocking response")
    return {
      join_url: "https://zoom.us/j/mock-meeting-" + Date.now(),
      id: Date.now().toString(),
      topic
    }
  }

  try {
    // 1. Get Access Token
    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
    const tokenResponse = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
      null,
      {
        headers: {
          Authorization: `Basic ${authString}`,
        },
      }
    )

    const accessToken = tokenResponse.data.access_token

    // 2. Create Meeting
    const meetingResponse = await axios.post(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic,
        type: 2, // Scheduled meeting
        start_time: startTime,
        duration,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          mute_upon_entry: true,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    )

    return meetingResponse.data
  } catch (error) {
    console.error("Zoom API Error:", error)
    throw new Error("Failed to create Zoom meeting")
  }
}
