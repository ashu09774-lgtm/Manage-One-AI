import { memo } from "react"
import { Handle, Position } from "@xyflow/react"
import { Zap } from "lucide-react"

export const ActionNode = memo(({ data }: { data: Record<string, any> }) => {
  return (
    <div className="w-64 rounded-md border border-border bg-card shadow-sm">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground" />
      <div className="flex items-center gap-2 rounded-t-sm bg-muted/50 px-3 py-2 border-b border-border">
        <Zap className="h-4 w-4 text-foreground" />
        <div className="text-sm font-medium">Action</div>
      </div>
      <div className="p-3">
        <div className="text-sm font-medium">{data.label || "Do Something"}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {data.description || "Performs a task or API call."}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-muted-foreground" />
    </div>
  )
})
ActionNode.displayName = "ActionNode"
