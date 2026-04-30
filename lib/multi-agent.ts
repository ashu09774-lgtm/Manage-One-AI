import type { ResultSetHeader, RowDataPacket } from "mysql2"
import { db } from "@/lib/db"
import { generateContextualAiResponse, type WorkspaceContext } from "@/lib/ai"

export type AgentType = "planner" | "scheduler" | "research" | "automation"

type AgentSpec = {
  type: AgentType
  title: string
  systemPrompt: string
  promptPrefix: string
}

type AgentRunRow = RowDataPacket & {
  id: number
  workspaceId: number | null
  goal: string
  status: "queued" | "running" | "success" | "failed"
  finalOutput: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

type AgentStepRow = RowDataPacket & {
  id: number
  agentType: AgentType
  stepOrder: number
  status: "queued" | "running" | "success" | "failed"
  inputText: string | null
  outputText: string | null
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
}

const agentSpecs: AgentSpec[] = [
  {
    type: "planner",
    title: "Planner Agent",
    systemPrompt: "You are the planning agent. Break a goal into phases, concrete milestones, constraints, and success criteria.",
    promptPrefix: "Return sections: Objective, Phases, Risks, Success Criteria.",
  },
  {
    type: "scheduler",
    title: "Scheduler Agent",
    systemPrompt: "You are the scheduling agent. Sequence work into a realistic near-term execution plan with owners, order, and timing suggestions.",
    promptPrefix: "Use the planner output. Return sections: Immediate Next Steps, Sequencing, Suggested Owners, Timing Notes.",
  },
  {
    type: "research",
    title: "Research Agent",
    systemPrompt: "You are the research agent. Identify missing information, assumptions, blockers, and the questions the team should answer before execution.",
    promptPrefix: "Use the prior agent outputs. Return sections: Known Facts, Unknowns, Recommended Checks, Decision Support.",
  },
  {
    type: "automation",
    title: "Automation Agent",
    systemPrompt: "You are the automation agent. Identify repeatable work and turn it into workflow ideas, reminders, and follow-up actions.",
    promptPrefix: "Use the prior agent outputs. Return sections: Automation Opportunities, Trigger Ideas, Manual Fallback, Suggested Implementation Order.",
  },
]

export async function createAgentRun(input: { userId: number; workspaceId?: number | null; goal: string }) {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO ai_agent_runs (user_id, workspace_id, goal, status)
    VALUES (?, ?, ?, 'queued')`,
    [input.userId, input.workspaceId ?? null, input.goal]
  )

  for (const [index, spec] of agentSpecs.entries()) {
    await db.execute(
      `INSERT INTO ai_agent_steps (run_id, agent_type, step_order, status)
      VALUES (?, ?, ?, 'queued')`,
      [result.insertId, spec.type, index + 1]
    )
  }

  return result.insertId
}

export async function executeAgentRun(input: { runId: number; userId: number; workspaceId?: number | null; goal: string }) {
  await db.execute(
    "UPDATE ai_agent_runs SET status = 'running', error_message = NULL WHERE id = ? AND user_id = ?",
    [input.runId, input.userId]
  )

  let contextForSummary: WorkspaceContext | null = null
  const outputs = new Map<AgentType, string>()

  try {
    for (const [index, spec] of agentSpecs.entries()) {
      const priorOutputs = agentSpecs
        .slice(0, index)
        .map((priorSpec) => `${priorSpec.title} output:\n${outputs.get(priorSpec.type) ?? "None"}`)
        .join("\n\n")

      const stepInput = [
        `Goal:\n${input.goal}`,
        priorOutputs ? `Prior agent outputs:\n${priorOutputs}` : "",
      ].filter(Boolean).join("\n\n")

      await db.execute(
        `UPDATE ai_agent_steps
        SET status = 'running', input_text = ?, started_at = CURRENT_TIMESTAMP, error_message = NULL
        WHERE run_id = ? AND agent_type = ?`,
        [stepInput, input.runId, spec.type]
      )

      try {
        const result = await generateContextualAiResponse({
          userId: input.userId,
          workspaceId: input.workspaceId,
          systemPrompt: spec.systemPrompt,
          promptPrefix: spec.promptPrefix,
          content: stepInput,
          templateName: spec.title,
        })

        contextForSummary = result.context
        outputs.set(spec.type, result.reply)

        await db.execute(
          `UPDATE ai_agent_steps
          SET status = 'success', output_text = ?, finished_at = CURRENT_TIMESTAMP
          WHERE run_id = ? AND agent_type = ?`,
          [result.reply, input.runId, spec.type]
        )
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown agent failure"
        await db.execute(
          `UPDATE ai_agent_steps
          SET status = 'failed', error_message = ?, finished_at = CURRENT_TIMESTAMP
          WHERE run_id = ? AND agent_type = ?`,
          [errorMessage, input.runId, spec.type]
        )

        const partialSummary = buildFailureSummary(input.goal, outputs, spec.type, errorMessage, contextForSummary)
        await db.execute(
          `UPDATE ai_agent_runs
          SET status = 'failed', final_output = ?, error_message = ?
          WHERE id = ? AND user_id = ?`,
          [partialSummary, errorMessage, input.runId, input.userId]
        )
        return
      }
    }

    const finalOutput = buildFinalSummary(input.goal, outputs, contextForSummary)
    await db.execute(
      `UPDATE ai_agent_runs
      SET status = 'success', final_output = ?, error_message = NULL
      WHERE id = ? AND user_id = ?`,
      [finalOutput, input.runId, input.userId]
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown orchestration failure"
    await db.execute(
      `UPDATE ai_agent_runs
      SET status = 'failed', error_message = ?, final_output = ?
      WHERE id = ? AND user_id = ?`,
      [errorMessage, buildFailureSummary(input.goal, outputs, null, errorMessage, contextForSummary), input.runId, input.userId]
    )
  }
}

export async function getAgentRuns(userId: number, workspaceId?: number | null) {
  const filter = workspaceId ? "AND workspace_id = ?" : ""
  const params = workspaceId ? [userId, workspaceId] : [userId]
  const [runs] = await db.execute<AgentRunRow[]>(
    `SELECT
      id,
      workspace_id AS workspaceId,
      goal,
      status,
      final_output AS finalOutput,
      error_message AS errorMessage,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
    FROM ai_agent_runs
    WHERE user_id = ? ${filter}
    ORDER BY updated_at DESC
    LIMIT 20`,
    params
  )

  return runs.map((run) => ({
    id: Number(run.id),
    workspaceId: run.workspaceId === null ? null : Number(run.workspaceId),
    goal: String(run.goal),
    status: run.status,
    finalOutput: run.finalOutput ? String(run.finalOutput) : null,
    errorMessage: run.errorMessage ? String(run.errorMessage) : null,
    createdAt: String(run.createdAt),
    updatedAt: String(run.updatedAt),
  }))
}

export async function getAgentRunDetail(userId: number, runId: number) {
  const [[run]] = await db.execute<AgentRunRow[]>(
    `SELECT
      id,
      workspace_id AS workspaceId,
      goal,
      status,
      final_output AS finalOutput,
      error_message AS errorMessage,
      DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,
      DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updatedAt
    FROM ai_agent_runs
    WHERE id = ? AND user_id = ?
    LIMIT 1`,
    [runId, userId]
  )

  if (!run) {
    return null
  }

  const [steps] = await db.execute<AgentStepRow[]>(
    `SELECT
      id,
      agent_type AS agentType,
      step_order AS stepOrder,
      status,
      input_text AS inputText,
      output_text AS outputText,
      error_message AS errorMessage,
      DATE_FORMAT(started_at, '%Y-%m-%d %H:%i:%s') AS startedAt,
      DATE_FORMAT(finished_at, '%Y-%m-%d %H:%i:%s') AS finishedAt
    FROM ai_agent_steps
    WHERE run_id = ?
    ORDER BY step_order ASC, id ASC`,
    [runId]
  )

  return {
    id: Number(run.id),
    workspaceId: run.workspaceId === null ? null : Number(run.workspaceId),
    goal: String(run.goal),
    status: run.status,
    finalOutput: run.finalOutput ? String(run.finalOutput) : null,
    errorMessage: run.errorMessage ? String(run.errorMessage) : null,
    createdAt: String(run.createdAt),
    updatedAt: String(run.updatedAt),
    steps: steps.map((step) => ({
      id: Number(step.id),
      agentType: step.agentType,
      stepOrder: Number(step.stepOrder),
      status: step.status,
      inputText: step.inputText ? String(step.inputText) : null,
      outputText: step.outputText ? String(step.outputText) : null,
      errorMessage: step.errorMessage ? String(step.errorMessage) : null,
      startedAt: step.startedAt ? String(step.startedAt) : null,
      finishedAt: step.finishedAt ? String(step.finishedAt) : null,
    })),
  }
}

function buildFinalSummary(goal: string, outputs: Map<AgentType, string>, context: WorkspaceContext | null) {
  const workspaceLine = context?.workspaces.length
    ? context.workspaces.map((workspace) => `${workspace.name} (${workspace.progress}% complete)`).join(", ")
    : "No workspace snapshot available"

  return [
    "Multi-agent orchestration summary",
    "",
    `Goal: ${goal}`,
    `Workspace snapshot: ${workspaceLine}`,
    "",
    ...agentSpecs.map((spec) => `${spec.title}\n${outputs.get(spec.type) ?? "No output"}`),
  ].join("\n\n")
}

function buildFailureSummary(goal: string, outputs: Map<AgentType, string>, failedAgent: AgentType | null, errorMessage: string, context: WorkspaceContext | null) {
  const completed = agentSpecs
    .filter((spec) => outputs.has(spec.type))
    .map((spec) => `${spec.title}\n${outputs.get(spec.type) ?? ""}`)
    .join("\n\n")

  return [
    "Multi-agent run failed",
    "",
    `Goal: ${goal}`,
    failedAgent ? `Failed agent: ${failedAgent}` : "Failed during orchestration",
    `Error: ${errorMessage}`,
    context?.workspaces.length ? `Workspace snapshot: ${context.workspaces.map((workspace) => workspace.name).join(", ")}` : "",
    completed ? `Completed outputs:\n\n${completed}` : "No agent outputs were completed before failure.",
  ].filter(Boolean).join("\n\n")
}

export function getAgentCatalog() {
  return agentSpecs.map((spec) => ({
    type: spec.type,
    title: spec.title,
  }))
}
