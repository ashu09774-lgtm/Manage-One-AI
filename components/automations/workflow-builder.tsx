"use client"

import { useCallback, useState } from "react"
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"

import { TriggerNode } from "./nodes/trigger-node"
import { ActionNode } from "./nodes/action-node"
import { ConditionNode } from "./nodes/condition-node"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Save, Plus, X, Sparkles } from "lucide-react"

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
}

const initialNodes: Node[] = [
  {
    id: "trigger-1",
    type: "trigger",
    position: { x: 250, y: 50 },
    data: { label: "Task Created", description: "When a new task is created" },
  },
]

const initialEdges: Edge[] = []

export function WorkflowBuilder({
  initialGraph,
  onSave,
}: {
  initialGraph?: { nodes: Node[]; edges: Edge[] }
  onSave: (graph: { nodes: Node[]; edges: Edge[] }) => void
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialGraph?.nodes || initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialGraph?.edges || initialEdges)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [aiPrompt, setAiPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim()) return
    setIsGenerating(true)
    setError("")
    
    try {
      const res = await fetch("/api/automations/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error ?? "Failed to generate workflow")
      
      setNodes(data.nodes)
      setEdges(data.edges)
      setAiPrompt("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI Generation Failed")
    } finally {
      setIsGenerating(false)
    }
  }

  const handleAddNode = (type: "trigger" | "action" | "condition", label: string) => {
    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 250, y: 250 },
      data: { label },
    }
    setNodes((nds) => [...nds, newNode])
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input 
          placeholder="e.g., Schedule a meeting on Zoom and notify the members..." 
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerateAI()}
          disabled={isGenerating}
        />
        <Button onClick={handleGenerateAI} disabled={isGenerating || !aiPrompt.trim()}>
          {isGenerating ? <Spinner className="h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2 text-yellow-500" />}
          Generate with AI
        </Button>
      </div>
      
      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex h-[600px] w-full border border-border rounded-lg overflow-hidden bg-background relative">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {isSidebarOpen && (
        <div className="w-80 border-l border-border bg-card p-4 flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg">Nodes</h3>
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6 flex-1">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Triggers</h4>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleAddNode("trigger", "Task Created")}>
                <Plus className="h-4 w-4 mr-2" /> Task Created
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleAddNode("trigger", "Task Completed")}>
                <Plus className="h-4 w-4 mr-2" /> Task Completed
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleAddNode("trigger", "Webhook")}>
                <Plus className="h-4 w-4 mr-2" /> Webhook
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Logic</h4>
              <Button variant="outline" className="w-full justify-start border-orange-500/20 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400" onClick={() => handleAddNode("condition", "If / Else")}>
                <Plus className="h-4 w-4 mr-2" /> If / Else Condition
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Actions</h4>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleAddNode("action", "Create Zoom Meeting")}>
                <Plus className="h-4 w-4 mr-2" /> Zoom Meeting
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleAddNode("action", "Google Calendar Event")}>
                <Plus className="h-4 w-4 mr-2" /> Calendar Event
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleAddNode("action", "Send Email")}>
                <Plus className="h-4 w-4 mr-2" /> Send Email
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => handleAddNode("action", "Create Task")}>
                <Plus className="h-4 w-4 mr-2" /> Create Task
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-border mt-auto">
            <Button className="w-full" onClick={() => onSave({ nodes, edges })}>
              <Save className="h-4 w-4 mr-2" />
              Save Workflow
            </Button>
          </div>
        </div>
      )}
      {!isSidebarOpen && (
          <div className="absolute right-4 top-4 z-10">
            <Button variant="secondary" onClick={() => setIsSidebarOpen(true)}>
              Open Sidebar
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
