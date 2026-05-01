import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"

export type PromptTemplate = {
  id: string
  name: string
  category: string
  systemPrompt: string
  promptPrefix: string
  source: "default" | "custom"
}

export type WorkspaceContext = {
  workspaces: Array<{ id: number; name: string; progress: number; tasks: number; completedTasks: number }>
  projects: Array<{ id: number; workspace: string; name: string; progress: number; tasks: number }>
  tasks: Array<{ title: string; status: string; priority: string; dueDate: string | null; workspace: string; project: string | null }>
  activity: Array<{ actor: string; action: string; subject: string; createdAt: string }>
}

type ProviderResult = {
  content: string
  provider: string
  model: string
  status: "success" | "fallback" | "error"
  errorMessage?: string
}

const builtInTemplates: PromptTemplate[] = [
  {
    id: "default-assistant",
    name: "Workspace Assistant",
    category: "assistant",
    source: "default",
    systemPrompt: "You are Manage One AI, a practical assistant for a productivity workspace. Be concise, specific, and action-oriented.",
    promptPrefix: "Use the workspace context when it helps. Prefer recommendations that can be acted on today.",
  },

  {
    id: "task-generation",
    name: "AI Task Generation",
    category: "task_generation",
    source: "default",
    systemPrompt: "Turn goals into concrete tasks. If you identify specific tasks, provide them in a JSON block at the end of your response like this: ```json [{\"title\": \"...\", \"priority\": \"...\", \"description\": \"...\"}] ```.",
    promptPrefix: "If the request is broad, break it into phases and list 5-10 realistic tasks. Always include the JSON block for the identified tasks.",
  },
  {
    id: "smart-suggestions",
    name: "Smart Task Suggestions",
    category: "task_suggestions",
    source: "default",
    systemPrompt: "Review current work and suggest the next best tasks to improve flow, reduce blockers, and raise completion rate.",
    promptPrefix: "Call out urgent, overdue, and high-impact follow-ups first.",
  },
  {
    id: "meeting-summary",
    name: "Meeting Summary Generator",
    category: "meeting_summary",
    source: "default",
    systemPrompt: "Summarize meeting notes into decisions, blockers, owners, and next actions.",
    promptPrefix: "Return sections: Summary, Decisions, Action Items, Risks.",
  },
  {
    id: "document-summary",
    name: "Document Summarizer",
    category: "document_summary",
    source: "default",
    systemPrompt: "Summarize long text clearly and extract the important operational next steps.",
    promptPrefix: "Return: What it says, What matters, What to do next.",
  },
  {
    id: "productivity-recommendations",
    name: "Productivity Recommendations",
    category: "productivity",
    source: "default",
    systemPrompt: "Analyze workload patterns and suggest a better way to prioritize, distribute, and complete work.",
    promptPrefix: "Focus on concrete changes to workload, timing, ownership, and automation.",
  },
]

export async function getPromptTemplates(userId: number) {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT id, name, category, system_prompt AS systemPrompt, prompt_prefix AS promptPrefix
    FROM ai_prompt_templates
    WHERE user_id = ?
    ORDER BY updated_at DESC, id DESC`,
    [userId]
  )

  const customTemplates = rows.map((row) => ({
    id: `custom-${Number(row.id)}`,
    name: String(row.name),
    category: String(row.category),
    systemPrompt: String(row.systemPrompt),
    promptPrefix: String(row.promptPrefix ?? ""),
    source: "custom" as const,
  }))

  return [...builtInTemplates, ...customTemplates]
}

export async function createPromptTemplate(input: {
  userId: number
  name: string
  category: string
  systemPrompt: string
  promptPrefix?: string
}) {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO ai_prompt_templates (user_id, name, category, system_prompt, prompt_prefix)
    VALUES (?, ?, ?, ?, ?)`,
    [input.userId, input.name, input.category, input.systemPrompt, input.promptPrefix ?? null]
  )

  return {
    id: `custom-${result.insertId}`,
    name: input.name,
    category: input.category,
    systemPrompt: input.systemPrompt,
    promptPrefix: input.promptPrefix ?? "",
    source: "custom" as const,
  }
}

export async function updatePromptTemplate(input: {
  userId: number
  templateId: number
  name: string
  category: string
  systemPrompt: string
  promptPrefix?: string
}) {
  await db.execute(
    `UPDATE ai_prompt_templates
    SET name = ?, category = ?, system_prompt = ?, prompt_prefix = ?
    WHERE id = ? AND user_id = ?`,
    [input.name, input.category, input.systemPrompt, input.promptPrefix ?? null, input.templateId, input.userId]
  )
}

export async function deletePromptTemplate(userId: number, templateId: number) {
  await db.execute("DELETE FROM ai_prompt_templates WHERE id = ? AND user_id = ?", [templateId, userId])
}

export async function getTemplateById(userId: number, templateId?: string | null) {
  const templates = await getPromptTemplates(userId)
  return templates.find((template) => template.id === templateId) ?? builtInTemplates[0]
}

export async function getWorkspaceContext(userId: number, workspaceId?: number | null): Promise<WorkspaceContext> {
  const workspaceFilter = workspaceId ? "AND w.id = ?" : ""
  const taskFilter = workspaceId ? "AND t.workspace_id = ?" : ""
  const projectFilter = workspaceId ? "AND p.workspace_id = ?" : ""
  const activityFilter = workspaceId ? "AND ae.workspace_id = ?" : ""
  const sharedParams = workspaceId ? [userId, workspaceId] : [userId]

  const [workspaces] = await db.execute<RowDataPacket[]>(
    `SELECT
      w.id,
      w.name,
      COUNT(DISTINCT t.id) AS tasks,
      COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS completedTasks
    FROM workspaces w
    INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = ?
    LEFT JOIN tasks t ON t.workspace_id = w.id
    WHERE w.archived_at IS NULL ${workspaceFilter}
    GROUP BY w.id, w.name
    ORDER BY w.updated_at DESC
    LIMIT 5`,
    sharedParams
  )

  const [projects] = await db.execute<RowDataPacket[]>(
    `SELECT
      p.id,
      p.name,
      w.name AS workspace,
      COUNT(DISTINCT t.id) AS tasks,
      COALESCE(ROUND(COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) / NULLIF(COUNT(DISTINCT t.id), 0) * 100), 0) AS progress
    FROM projects p
    INNER JOIN workspaces w ON w.id = p.workspace_id
    INNER JOIN workspace_members wm ON wm.workspace_id = p.workspace_id AND wm.user_id = ?
    LEFT JOIN tasks t ON t.project_id = p.id
    WHERE p.archived_at IS NULL ${projectFilter}
    GROUP BY p.id, p.name, w.name
    ORDER BY p.updated_at DESC
    LIMIT 8`,
    sharedParams
  )

  const [tasks] = await db.execute<RowDataPacket[]>(
    `SELECT
      t.title,
      t.status,
      t.priority,
      DATE_FORMAT(t.due_date, '%Y-%m-%d') AS dueDate,
      w.name AS workspace,
      p.name AS project
    FROM tasks t
    INNER JOIN workspace_members wm ON wm.workspace_id = t.workspace_id AND wm.user_id = ?
    INNER JOIN workspaces w ON w.id = t.workspace_id
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE 1 = 1 ${taskFilter}
    ORDER BY
      CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
      t.due_date ASC,
      t.updated_at DESC
    LIMIT 12`,
    sharedParams
  )

  const [activity] = await db.execute<RowDataPacket[]>(
    `SELECT
      COALESCE(u.name, 'System') AS actor,
      ae.action,
      COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(ae.metadata, '$.title')),
        JSON_UNQUOTE(JSON_EXTRACT(ae.metadata, '$.name')),
        JSON_UNQUOTE(JSON_EXTRACT(ae.metadata, '$.taskTitle')),
        ae.entity_type
      ) AS subject,
      DATE_FORMAT(ae.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
    FROM activity_events ae
    INNER JOIN workspace_members wm ON wm.workspace_id = ae.workspace_id AND wm.user_id = ?
    LEFT JOIN users u ON u.id = ae.actor_id
    WHERE 1 = 1 ${activityFilter}
    ORDER BY ae.created_at DESC
    LIMIT 8`,
    sharedParams
  )

  return {
    workspaces: workspaces.map((row) => {
      const tasksCount = Number(row.tasks ?? 0)
      const completed = Number(row.completedTasks ?? 0)
      return {
        id: Number(row.id),
        name: String(row.name),
        tasks: tasksCount,
        completedTasks: completed,
        progress: tasksCount ? Math.round((completed / tasksCount) * 100) : 0,
      }
    }),
    projects: projects.map((row) => ({
      id: Number(row.id),
      workspace: String(row.workspace),
      name: String(row.name),
      tasks: Number(row.tasks ?? 0),
      progress: Number(row.progress ?? 0),
    })),
    tasks: tasks.map((row) => ({
      title: String(row.title),
      status: String(row.status),
      priority: String(row.priority),
      dueDate: row.dueDate ? String(row.dueDate) : null,
      workspace: String(row.workspace),
      project: row.project ? String(row.project) : null,
    })),
    activity: activity.map((row) => ({
      actor: String(row.actor),
      action: String(row.action),
      subject: String(row.subject),
      createdAt: String(row.createdAt),
    })),
  }
}

export async function getUsageSummary(userId: number) {
  const [[summary]] = await db.execute<RowDataPacket[]>(
    `SELECT
      COUNT(*) AS requests,
      COALESCE(SUM(input_chars), 0) AS inputChars,
      COALESCE(SUM(output_chars), 0) AS outputChars,
      MAX(created_at) AS lastUsedAt
    FROM ai_usage_logs
    WHERE user_id = ?`,
    [userId]
  )

  return {
    requests: Number(summary?.requests ?? 0),
    inputChars: Number(summary?.inputChars ?? 0),
    outputChars: Number(summary?.outputChars ?? 0),
    lastUsedAt: summary?.lastUsedAt ? String(summary.lastUsedAt) : null,
  }
}

export async function logUsage(input: {
  userId: number
  conversationId: number
  provider: string
  model: string
  templateName: string
  inputChars: number
  outputChars: number
  status: "success" | "fallback" | "error"
  errorMessage?: string
}) {
  await db.execute(
    `INSERT INTO ai_usage_logs
      (user_id, conversation_id, provider, model, template_name, input_chars, output_chars, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.userId,
      input.conversationId,
      input.provider,
      input.model,
      input.templateName,
      input.inputChars,
      input.outputChars,
      input.status,
      input.errorMessage ?? null,
    ]
  )
}

export async function generateAssistantReply(input: {
  userId: number
  conversationId: number
  template: PromptTemplate
  content: string
  workspaceId?: number | null
}) {
  const context = await getWorkspaceContext(input.userId, input.workspaceId)
  const prompt = buildPrompt(input.template, input.content, context)

  const result = await callProvider(prompt, input.template, context)
  await logUsage({
    userId: input.userId,
    conversationId: input.conversationId,
    provider: result.provider,
    model: result.model,
    templateName: input.template.name,
    inputChars: prompt.length,
    outputChars: result.content.length,
    status: result.status,
    errorMessage: result.errorMessage,
  })

  return {
    reply: result.content,
    provider: result.provider,
    model: result.model,
    status: result.status,
    context,
  }
}

export async function generateAssistantStream(input: {
  userId: number
  conversationId: number
  template: PromptTemplate
  content: string
  workspaceId?: number | null
  summary?: string | null
}) {
  const context = await getWorkspaceContext(input.userId, input.workspaceId)
  const prompt = buildPrompt(input.template, input.content, context, input.summary)
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash"

  if (!apiKey) {
    throw new Error("Gemini API key not configured for streaming")
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message ?? "Streaming request failed")
  }

  return response.body // Returns a ReadableStream
}

export async function generateContextualAiResponse(input: {
  userId: number
  workspaceId?: number | null
  systemPrompt: string
  promptPrefix?: string
  content: string
  templateName?: string
  conversationId?: number
}) {
  const context = await getWorkspaceContext(input.userId, input.workspaceId)
  const template: PromptTemplate = {
    id: input.templateName ?? "contextual-reply",
    name: input.templateName ?? "Contextual Reply",
    category: "assistant",
    systemPrompt: input.systemPrompt,
    promptPrefix: input.promptPrefix ?? "",
    source: "default",
  }
  const prompt = buildPrompt(template, input.content, context)
  const result = await callProvider(prompt, template, context)

  if (input.conversationId) {
    await logUsage({
      userId: input.userId,
      conversationId: input.conversationId,
      provider: result.provider,
      model: result.model,
      templateName: template.name,
      inputChars: prompt.length,
      outputChars: result.content.length,
      status: result.status,
      errorMessage: result.errorMessage,
    })
  }

  return {
    reply: result.content,
    provider: result.provider,
    model: result.model,
    status: result.status,
    errorMessage: result.errorMessage,
    context,
  }
}

function buildPrompt(template: PromptTemplate, content: string, context: WorkspaceContext, summary?: string | null) {
  return [
    template.systemPrompt,
    template.promptPrefix,
    summary ? `Previous Conversation Summary:\n${summary}\n` : null,
    "Workspace snapshot:",
    JSON.stringify(context, null, 2),
    "User request:",
    content,
  ].filter(Boolean).join("\n\n")
}

export async function summarizeConversation(messages: Array<{ role: string; content: string }>) {
  if (messages.length < 6) return null

  const prompt = `Summarize the following conversation between a user and an AI assistant in 200 words or less. Focus on the core goals, decisions, and tasks identified.
  
  CONVERSATION:
  ${messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}
  
  SUMMARY:`

  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash"

  if (!apiKey) return "Long conversation history (local summary unavailable)"

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    })
    const data = await response.json()
    return extractGeminiText(data)
  } catch (error) {
    console.error("Summarization failed:", error)
    return "Summary failed."
  }
}

async function callProvider(prompt: string, template: PromptTemplate, context: WorkspaceContext): Promise<ProviderResult> {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"

  if (apiKey) {
    try {
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
                {
                  text: prompt,
                },
              ],
            },
          ],
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Provider request failed")
      }

      const output = extractGeminiText(data)

      if (output.trim()) {
        return {
          content: output.trim(),
          provider: "gemini",
          model,
          status: "success",
        }
      }
    } catch (error) {
      const fallback = generateFallbackReply(template, context, prompt)
      return {
        content: fallback,
        provider: "manage-one-local",
        model: "heuristic",
        status: "fallback",
        errorMessage: error instanceof Error ? error.message : "Unknown provider error",
      }
    }
  }

  return {
    content: generateFallbackReply(template, context, prompt),
    provider: "manage-one-local",
    model: "heuristic",
    status: "fallback",
  }
}

function extractGeminiText(response: unknown) {
  const typedResponse = response as {
    text?: string
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>
      }
    }>
  }

  if (typeof typedResponse.text === "string" && typedResponse.text.trim()) {
    return typedResponse.text
  }

  const fragments: string[] = []
  for (const candidate of typedResponse.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (typeof part.text === "string" && part.text.trim()) {
        fragments.push(part.text)
      }
    }
  }

  return fragments.join("\n").trim()
}

function generateFallbackReply(template: PromptTemplate, context: WorkspaceContext, prompt: string) {
  switch (template.category) {
    case "task_generation":
      return fallbackTaskGeneration(context, prompt)
    case "task_suggestions":
      return fallbackSuggestions(context)
    case "meeting_summary":
      return fallbackMeetingSummary(prompt)
    case "document_summary":
      return fallbackDocumentSummary(prompt)
    case "productivity":
      return fallbackProductivity(context)
    default:
      return fallbackGeneral(context)
  }
}

function fallbackTaskGeneration(context: WorkspaceContext, prompt: string) {
  const activeProjects = context.projects.slice(0, 3).map((project) => `- ${project.name} (${project.progress}% complete)`).join("\n") || "- No active projects found"
  return [
    "Suggested task plan",
    "",
    "1. Define the immediate milestone and success criteria.",
    "2. Break the work into 5-7 tasks with one clear outcome each.",
    "3. Assign the urgent or blocked work first, then sequence the rest by dependency.",
    "4. Add due dates to anything that affects another teammate or project deadline.",
    "",
    "Current project context:",
    activeProjects,
    "",
    "Starter checklist:",
    "- Scope the deliverable and document acceptance criteria.",
    "- Create implementation tasks for build, review, and QA.",
    "- Add one task for stakeholder sync or status communication.",
    "- Reserve one task for cleanup, docs, or rollout.",
    "",
    `Prompt focus: ${extractUserIntent(prompt)}`,
  ].join("\n")
}

function fallbackSuggestions(context: WorkspaceContext) {
  const urgentTasks = context.tasks.filter((task) => task.priority === "urgent" || task.status === "review").slice(0, 4)
  const lines = urgentTasks.length
    ? urgentTasks.map((task) => `- ${task.title} in ${task.workspace}${task.project ? ` / ${task.project}` : ""} is ${task.status} with ${task.priority} priority.`)
    : ["- No urgent tasks found. Choose one active project and create the next concrete deliverable."]

  return [
    "Smart task suggestions",
    "",
    "Focus next on the items most likely to unblock the team or move a project across the line:",
    ...lines,
    "",
    "Recommended next moves:",
    "- Close any review-stage work before starting net-new tasks.",
    "- Add due dates to active tasks that still have none.",
    "- Reassign overloaded owners if one workspace has most of the in-progress work.",
  ].join("\n")
}

function fallbackMeetingSummary(prompt: string) {
  return [
    "Meeting summary",
    "",
    "Summary:",
    extractBodyPreview(prompt),
    "",
    "Decisions:",
    "- Confirm scope, owners, and the next delivery checkpoint.",
    "",
    "Action items:",
    "- Create follow-up tasks for each decision with due dates.",
    "- Capture blockers raised during the meeting in the workspace.",
    "",
    "Risks:",
    "- Anything without an owner or deadline is likely to stall.",
  ].join("\n")
}

function fallbackDocumentSummary(prompt: string) {
  return [
    "Document summary",
    "",
    "What it says:",
    extractBodyPreview(prompt),
    "",
    "What matters:",
    "- Identify the concrete commitments, deadlines, and dependencies in the document.",
    "",
    "What to do next:",
    "- Turn the important commitments into tracked tasks.",
    "- Share the summary with the workspace if the document changes team priorities.",
  ].join("\n")
}

function fallbackProductivity(context: WorkspaceContext) {
  const incomplete = context.tasks.filter((task) => task.status !== "done").length
  const done = context.tasks.filter((task) => task.status === "done").length
  return [
    "Productivity recommendations",
    "",
    `You currently have ${incomplete} open tasks and ${done} completed tasks in the recent workspace snapshot.`,
    "",
    "- Reduce work in progress by finishing review and high-priority items before opening new ones.",
    "- Add due dates to priority tasks so project timelines become more reliable.",
    "- Use project grouping consistently so progress reflects real delivery streams.",
    "- Revisit assignments in any workspace where active work is concentrated on one person.",
  ].join("\n")
}

function fallbackGeneral(context: WorkspaceContext) {
  const workspaceSummary = context.workspaces.length
    ? context.workspaces.map((workspace) => `- ${workspace.name}: ${workspace.completedTasks}/${workspace.tasks} tasks done (${workspace.progress}%)`).join("\n")
    : "- No workspace data available yet"

  return [
    "Manage One AI is running in local fallback mode.",
    "",
    "I can still help with task planning, summaries, and workspace recommendations using your saved project data.",
    "",
    "Current workspace snapshot:",
    workspaceSummary,
    "",
    "To enable provider-backed responses, add `GEMINI_API_KEY` and optionally `GEMINI_MODEL` to your environment.",
  ].join("\n")
}

function extractUserIntent(prompt: string) {
  const lines = prompt.split("\n").filter(Boolean)
  return lines[lines.length - 1] ?? "General planning"
}

function extractBodyPreview(prompt: string) {
  const lines = prompt.split("\n").filter(Boolean)
  const requestLine = lines[lines.length - 1] ?? ""
  return requestLine.length > 220 ? `${requestLine.slice(0, 217)}...` : requestLine
}

