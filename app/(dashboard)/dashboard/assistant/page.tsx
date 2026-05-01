"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Bot, Brain, FileText, Lightbulb, NotebookText, Save, Send, Sparkles, Trash2, User, WandSparkles, Zap } from "lucide-react"

interface UserData {
  id: string
}

interface Message {
  id: number
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string
}

interface PromptTemplate {
  id: string
  name: string
  category: string
  systemPrompt: string
  promptPrefix: string
  source: "default" | "custom"
}

interface WorkspaceOption {
  id: number
  name: string
}

interface UsageSummary {
  requests: number
  inputChars: number
  outputChars: number
  lastUsedAt: string | null
}

interface AgentInfo {
  type: "planner" | "scheduler" | "research" | "automation"
  title: string
}

interface AgentRun {
  id: number
  workspaceId: number | null
  goal: string
  status: "queued" | "running" | "success" | "failed"
  finalOutput: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

interface AgentStep {
  id: number
  agentType: AgentInfo["type"]
  stepOrder: number
  status: AgentRun["status"]
  inputText: string | null
  outputText: string | null
  errorMessage: string | null
  startedAt: string | null
  finishedAt: string | null
}

interface AgentRunDetail extends AgentRun {
  steps: AgentStep[]
}

const quickActions = [
  { icon: Zap, label: "AI Task Generation", templateCategory: "task_generation", prompt: "Generate a task plan for my next project milestone." },
  { icon: Brain, label: "Smart Suggestions", templateCategory: "task_suggestions", prompt: "What should the team focus on next based on the current workspace?" },
  { icon: NotebookText, label: "Meeting Summary", templateCategory: "meeting_summary", prompt: "Summarize these meeting notes and turn them into actions." },
  { icon: FileText, label: "Document Summary", templateCategory: "document_summary", prompt: "Summarize this document and extract the operational next steps." },
  { icon: Lightbulb, label: "Productivity Advice", templateCategory: "productivity", prompt: "Give me productivity recommendations for this workspace." },
  { icon: Sparkles, label: "General Assistant", templateCategory: "assistant", prompt: "Help me prioritize my work for today." },
]

const emptyTemplateForm = {
  name: "",
  category: "assistant",
  systemPrompt: "",
  promptPrefix: "",
}

export default function AssistantPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [provider, setProvider] = useState("manage-one-local")
  const [selectedTemplateId, setSelectedTemplateId] = useState("default-assistant")
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("all")
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([])
  const [usage, setUsage] = useState<UsageSummary>({ requests: 0, inputChars: 0, outputChars: 0, lastUsedAt: null })
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([])
  const [selectedRun, setSelectedRun] = useState<AgentRunDetail | null>(null)
  const [agentGoal, setAgentGoal] = useState("")
  const [isLaunchingRun, setIsLaunchingRun] = useState(false)
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [error, setError] = useState("")
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null)
  const [isCreatingTasks, setIsCreatingTasks] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const storedUser = localStorage.getItem("manageone_user")
    if (storedUser) setUser(JSON.parse(storedUser))
  }, [])

  useEffect(() => {
    if (!user?.id) return
    void loadAssistantData()
  }, [user])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null,
    [templates, selectedTemplateId]
  )

  async function loadAssistantData() {
    if (!user?.id) return

    const response = await fetch(`/api/assistant?userId=${user.id}`)
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not load assistant")
      return
    }

    setMessages(data.messages)
    setProvider(data.provider)
    setTemplates(data.templates)
    setWorkspaces(data.workspaces)
    setUsage(data.usage)
    await loadAgentRuns(data.workspaces)
    if (data.templates.length > 0) {
      setSelectedTemplateId((current) => current || data.templates[0].id)
    }
  }

  async function loadAgentRuns(existingWorkspaces?: WorkspaceOption[]) {
    if (!user?.id) return

    const response = await fetch(`/api/agents?userId=${user.id}`)
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not load agent runs")
      return
    }

    setAgents(data.agents)
    setAgentRuns(data.runs)
    const firstRun = data.runs[0]
    if (firstRun) {
      await loadAgentRunDetail(firstRun.id)
    } else {
      setSelectedRun(null)
    }
    if (existingWorkspaces) {
      setWorkspaces(existingWorkspaces)
    }
  }

  async function loadAgentRunDetail(runId: number) {
    const response = await fetch(`/api/agents/${runId}?userId=${user?.id}`)
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not load agent run")
      return
    }

    setSelectedRun(data.run)
  }

  async function handleSend(override?: { text?: string; templateId?: string }) {
    const messageText = override?.text ?? input
    const templateId = override?.templateId ?? selectedTemplateId

    if (!messageText.trim() || !user?.id) return

    setInput("")
    setIsSending(true)
    setError("")

    // Optimistically add user message
    const userMessageId = Date.now()
    setMessages((current) => [
      ...current,
      { id: userMessageId, role: "user", content: messageText, createdAt: new Date().toISOString() },
    ])

    try {
      const response = await fetch("/api/assistant/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          content: messageText,
          templateId,
          workspaceId: selectedWorkspaceId === "all" ? null : Number(selectedWorkspaceId),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? "Streaming failed")
      }

      if (!response.body) throw new Error("No response body")

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""
      setStreamingMessage("")

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamingMessage(accumulated)
      }

      // Once done, add the final message to the list and clear streaming state
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", content: accumulated, createdAt: new Date().toISOString() },
      ])
      setStreamingMessage(null)
      
      setUsage((current) => ({
        ...current,
        requests: current.requests + 1,
        inputChars: current.inputChars + messageText.length,
        outputChars: current.outputChars + accumulated.length,
        lastUsedAt: new Date().toISOString(),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete AI request")
    } finally {
      setIsSending(false)
    }
  }

  async function saveTemplate() {
    if (!user?.id || !templateForm.name.trim() || !templateForm.systemPrompt.trim()) return

    setIsSavingTemplate(true)
    setError("")
    const method = editingTemplateId ? "PATCH" : "POST"
    const url = editingTemplateId
      ? `/api/assistant/prompts/${editingTemplateId}`
      : "/api/assistant/prompts"

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        ...templateForm,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not save prompt template")
      setIsSavingTemplate(false)
      return
    }

    if (editingTemplateId) {
      setTemplates((current) =>
        current.map((template) =>
          template.id === editingTemplateId
            ? { ...template, ...templateForm, source: "custom" }
            : template
        )
      )
    } else {
      setTemplates((current) => [data.template, ...current])
      setSelectedTemplateId(data.template.id)
    }

    setTemplateForm(emptyTemplateForm)
    setEditingTemplateId(null)
    setIsSavingTemplate(false)
  }

  async function deleteTemplate(templateId: string) {
    if (!user?.id) return

    const response = await fetch(`/api/assistant/prompts/${templateId}?userId=${user.id}`, {
      method: "DELETE",
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not delete prompt template")
      return
    }

    setTemplates((current) => current.filter((template) => template.id !== templateId))
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId("default-assistant")
    }
    if (editingTemplateId === templateId) {
      setEditingTemplateId(null)
      setTemplateForm(emptyTemplateForm)
    }
  }

  function startEditingTemplate(template: PromptTemplate) {
    if (template.source !== "custom") return
    setEditingTemplateId(template.id)
    setTemplateForm({
      name: template.name,
      category: template.category,
      systemPrompt: template.systemPrompt,
      promptPrefix: template.promptPrefix,
    })
  }

  async function launchAgentRun() {
    if (!user?.id || !agentGoal.trim()) return

    setIsLaunchingRun(true)
    setError("")
    const response = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        workspaceId: selectedWorkspaceId === "all" ? null : Number(selectedWorkspaceId),
        goal: agentGoal,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Could not execute agent run")
      setIsLaunchingRun(false)
      return
    }

    setAgentGoal("")
    await loadAgentRuns()
    if (data.run?.id) {
      await loadAgentRunDetail(data.run.id)
    }
    setIsLaunchingRun(false)
  }

  async function convertToTasks(content: string) {
    if (!user?.id || isCreatingTasks) return
    
    const jsonMatch = content.match(/```json\s+([\s\S]+?)\s+```/)
    if (!jsonMatch) return

    try {
      setIsCreatingTasks(true)
      const tasksToCreate = JSON.parse(jsonMatch[1])
      if (!Array.isArray(tasksToCreate)) throw new Error("Invalid task format")

      const workspaceId = selectedWorkspaceId === "all" ? null : Number(selectedWorkspaceId)
      if (!workspaceId) {
        toast.error("Please select a workspace first")
        return
      }

      const response = await fetch("/api/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          workspaceId,
          tasks: tasksToCreate.map((t) => ({
            title: t.title,
            priority: t.priority || "medium",
            description: t.description || "",
            status: "todo",
          })),
        }),
      })

      if (!response.ok) throw new Error("Could not create tasks")
      
      toast.success(`Successfully created ${tasksToCreate.length} tasks!`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse or create tasks")
    } finally {
      setIsCreatingTasks(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Assistant</h1>
          <p className="text-muted-foreground">Workspace-aware summaries, task generation, recommendations, and prompt-managed chat.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={provider === "gemini" ? "default" : "secondary"}>
            Provider: {provider === "gemini" ? "Gemini" : "Local fallback"}
          </Badge>
          <Badge variant="outline">{usage.requests} requests logged</Badge>
        </div>
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <UsageCard title="Requests" value={usage.requests} />
        <UsageCard title="Input Chars" value={usage.inputChars} />
        <UsageCard title="Output Chars" value={usage.outputChars} />
        <UsageCard title="Templates" value={templates.length} />
        <UsageCard title="Workspaces" value={workspaces.length} />
        <UsageCard title="Last Used" value={usage.lastUsedAt ? new Date(usage.lastUsedAt).toLocaleDateString() : "Never"} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((action) => {
          const template = templates.find((item) => item.category === action.templateCategory) ?? templates[0]
          return (
            <Card key={action.label} className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => handleSend({ text: action.prompt, templateId: template?.id })}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <action.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{template?.name ?? "Built-in template"}</div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList>
          <TabsTrigger value="chat">Assistant</TabsTrigger>
          <TabsTrigger value="agents">Multi-Agent</TabsTrigger>
          <TabsTrigger value="prompts">Prompt Management</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <div className="grid gap-6 xl:grid-cols-[1.4fr,0.6fr]">
            <Card className="flex h-[680px] flex-col">
              <CardHeader className="border-b">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                      <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Manage One AI</CardTitle>
                      <CardDescription>
                        {selectedTemplate ? `${selectedTemplate.name} is active` : "Select a template to guide replies"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                      <SelectTrigger className="w-full min-w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Workspaces</SelectItem>
                        {workspaces.map((workspace) => <SelectItem key={workspace.id} value={String(workspace.id)}>{workspace.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                      <SelectTrigger className="w-full min-w-[220px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.length === 0 && !streamingMessage ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">No messages yet. Ask for a task plan, summary, or recommendation.</p>
                  ) : (
                    <>
                      {messages.map((message) => (
                        <div key={message.id} className={`flex items-start gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={message.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted"}>
                              {message.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className={`max-w-[85%] rounded-lg p-3 ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                            <p className="mt-1 text-xs opacity-70">{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                            {message.role === "assistant" && message.content.includes("```json") && (
                              <div className="mt-3 border-t border-border pt-3">
                                <Button size="sm" variant="outline" className="gap-2" onClick={() => convertToTasks(message.content)} disabled={isCreatingTasks}>
                                  <Plus className="h-4 w-4" />
                                  Convert to Tasks
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {streamingMessage !== null && (
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                              <Bot className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="max-w-[85%] rounded-lg bg-muted p-3">
                            <p className="whitespace-pre-wrap text-sm">{streamingMessage}</p>
                            <span className="mt-1 inline-block h-4 w-1 animate-pulse bg-primary" />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t p-4">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleSend()
                  }}
                  className="space-y-3"
                >
                  <Textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask for task generation, a meeting summary, a document summary, or productivity advice..."
                    className="min-h-24"
                    disabled={isSending}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={!input.trim() || isSending}>
                      <Send className="h-4 w-4" />
                      Send
                    </Button>
                  </div>
                </form>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Template Details</CardTitle>
                <CardDescription>Prompt guidance currently shaping the assistant reply.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedTemplate ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{selectedTemplate.name}</span>
                        <Badge variant={selectedTemplate.source === "custom" ? "default" : "secondary"}>{selectedTemplate.source}</Badge>
                      </div>
                      <Badge variant="outline">{selectedTemplate.category}</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div>
                        <div className="font-medium">System Prompt</div>
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selectedTemplate.systemPrompt}</p>
                      </div>
                      <div>
                        <div className="font-medium">Prompt Prefix</div>
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selectedTemplate.promptPrefix || "None"}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No template selected.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents">
          <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Launch Multi-Agent Run</CardTitle>
                  <CardDescription>Planner, scheduler, research, and automation agents will collaborate in sequence and store a trace for each step.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {agents.map((agent) => (
                      <div key={agent.type} className="rounded-lg border border-border p-3">
                        <div className="font-medium">{agent.title}</div>
                        <div className="text-xs text-muted-foreground">{agent.type}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Label>Goal</Label>
                    <Textarea
                      value={agentGoal}
                      onChange={(event) => setAgentGoal(event.target.value)}
                      className="min-h-28"
                      placeholder="Plan a product launch, sequence the work, identify unknowns, and suggest automation opportunities."
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={launchAgentRun} disabled={isLaunchingRun || !agentGoal.trim()}>
                      <WandSparkles className="h-4 w-4" />
                      Run Agents
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Run History</CardTitle>
                  <CardDescription>Recent orchestration runs and their overall status.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {agentRuns.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No multi-agent runs yet.</p>
                  ) : (
                    agentRuns.map((run) => (
                      <button
                        key={run.id}
                        type="button"
                        className={`w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${selectedRun?.id === run.id ? "border-primary" : "border-border"}`}
                        onClick={() => loadAgentRunDetail(run.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium">{run.goal}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{new Date(run.updatedAt).toLocaleString()}</div>
                          </div>
                          <Badge variant={run.status === "success" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>{run.status}</Badge>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Trace Log</CardTitle>
                <CardDescription>Agent communication workflow, outputs, and failure details for the selected run.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedRun ? (
                  <p className="text-sm text-muted-foreground">Select a run to inspect its orchestration trace.</p>
                ) : (
                  <>
                    <div className="rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">Goal</div>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{selectedRun.goal}</p>
                        </div>
                        <Badge variant={selectedRun.status === "success" ? "default" : selectedRun.status === "failed" ? "destructive" : "secondary"}>
                          {selectedRun.status}
                        </Badge>
                      </div>
                      {selectedRun.errorMessage && (
                        <div className="mt-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{selectedRun.errorMessage}</div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {selectedRun.steps.map((step) => (
                        <div key={step.id} className="rounded-lg border border-border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-medium">{step.stepOrder}. {step.agentType}</div>
                              <div className="text-xs text-muted-foreground">
                                {step.startedAt ? new Date(step.startedAt).toLocaleString() : "Not started"}
                              </div>
                            </div>
                            <Badge variant={step.status === "success" ? "default" : step.status === "failed" ? "destructive" : "secondary"}>{step.status}</Badge>
                          </div>
                          <div className="mt-3 grid gap-3">
                            {step.inputText && (
                              <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground">Input</div>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{step.inputText}</p>
                              </div>
                            )}
                            {step.outputText && (
                              <div>
                                <div className="text-xs font-medium uppercase text-muted-foreground">Output</div>
                                <p className="mt-1 whitespace-pre-wrap text-sm">{step.outputText}</p>
                              </div>
                            )}
                            {step.errorMessage && (
                              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{step.errorMessage}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedRun.finalOutput && (
                      <div className="rounded-lg border border-border p-4">
                        <div className="font-medium">Final Orchestration Summary</div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{selectedRun.finalOutput}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="prompts">
          <div className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
            <Card>
              <CardHeader>
                <CardTitle>{editingTemplateId ? "Edit Prompt Template" : "Create Prompt Template"}</CardTitle>
                <CardDescription>Save reusable instructions for different AI workflows.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={templateForm.category} onValueChange={(value) => setTemplateForm((current) => ({ ...current, category: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="assistant">Assistant</SelectItem>
                      <SelectItem value="task_generation">Task Generation</SelectItem>
                      <SelectItem value="task_suggestions">Smart Suggestions</SelectItem>
                      <SelectItem value="meeting_summary">Meeting Summary</SelectItem>
                      <SelectItem value="document_summary">Document Summary</SelectItem>
                      <SelectItem value="productivity">Productivity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>System Prompt</Label>
                  <Textarea value={templateForm.systemPrompt} onChange={(event) => setTemplateForm((current) => ({ ...current, systemPrompt: event.target.value }))} className="min-h-32" />
                </div>
                <div className="space-y-2">
                  <Label>Prompt Prefix</Label>
                  <Textarea value={templateForm.promptPrefix} onChange={(event) => setTemplateForm((current) => ({ ...current, promptPrefix: event.target.value }))} className="min-h-24" />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {editingTemplateId && (
                    <Button variant="outline" onClick={() => { setEditingTemplateId(null); setTemplateForm(emptyTemplateForm) }}>
                      Cancel
                    </Button>
                  )}
                  <Button onClick={saveTemplate} disabled={isSavingTemplate}>
                    <Save className="h-4 w-4" />
                    {editingTemplateId ? "Update Template" : "Save Template"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Available Templates</CardTitle>
                <CardDescription>Built-ins cover the core AI module, and custom prompts let you tune the assistant.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{template.name}</span>
                          <Badge variant="outline">{template.category}</Badge>
                          <Badge variant={template.source === "custom" ? "default" : "secondary"}>{template.source}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{template.systemPrompt}</p>
                        {template.promptPrefix && <p className="text-xs text-muted-foreground">{template.promptPrefix}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedTemplateId(template.id)}>Use</Button>
                        {template.source === "custom" && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => startEditingTemplate(template)}>Edit</Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteTemplate(template.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function UsageCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-sm text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  )
}

