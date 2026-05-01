import { NextRequest, NextResponse } from "next/server"

const SYSTEM_PROMPT = `
You are an expert Automation Workflow Architect.
Your task is to take a natural language request and convert it into a strict JSON payload representing a React Flow graph.
The user wants to automate tasks. 

Available Node Types:
- "trigger" (Data labels: "Task Created", "Task Completed", "Webhook")
- "action" (Data labels: "Create Zoom Meeting", "Google Calendar Event", "Send Email", "Create Task")
- "condition" (Data labels: "If / Else")

The JSON output MUST EXACTLY match this structure (no markdown, no extra text, just raw JSON):
{
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": { "x": 100, "y": 100 },
      "data": { "label": "Task Created" }
    },
    ...
  ],
  "edges": [
    {
      "id": "e1",
      "source": "trigger-1",
      "target": "action-1"
    },
    ...
  ]
}

Layout guidelines: 
- Space nodes out logically. e.g. x: 100, y: 100 -> x: 100, y: 250 -> x: 100, y: 400.
- Ensure every node is connected via edges.
- Always start with a "trigger" node.

Generate the JSON for the following request:
`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt } = body

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 })
    }

    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT + "\n\nRequest: " + prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          // You could optionally force responseMimeType to application/json in Gemini
          // responseMimeType: "application/json", 
        }
      }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error?.message ?? "Failed to generate workflow")
    }

    let textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
    
    // Clean up markdown formatting if Gemini includes it
    textResponse = textResponse.replace(/^```json/g, "").replace(/^```/g, "").replace(/```$/g, "").trim()
    
    const parsedJson = JSON.parse(textResponse)

    return NextResponse.json(parsedJson)
  } catch (error) {
    console.error("Workflow Generation Error:", error)
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
  }
}
