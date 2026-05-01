import { google } from "googleapis"

export async function createGoogleCalendarEvent(summary: string, description: string, startTime: string, endTime: string) {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON

  if (!serviceAccountJson) {
    console.warn("Google Service Account missing, mocking response")
    return {
      htmlLink: "https://calendar.google.com/calendar/r/eventedit?mock",
      id: "mock-event-" + Date.now()
    }
  }

  try {
    const credentials = JSON.parse(serviceAccountJson)
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/calendar.events"],
    })

    const calendar = google.calendar({ version: "v3", auth })

    const response = await calendar.events.insert({
      calendarId: "primary", // Assuming the service account or domain-wide delegation uses primary
      requestBody: {
        summary,
        description,
        start: {
          dateTime: startTime, // ISO format
          timeZone: "UTC",
        },
        end: {
          dateTime: endTime,
          timeZone: "UTC",
        },
      },
    })

    return response.data
  } catch (error) {
    console.error("Google Calendar API Error:", error)
    throw new Error("Failed to create Google Calendar event")
  }
}
