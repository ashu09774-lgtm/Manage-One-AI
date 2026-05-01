import { memo } from "react"
import { Handle, Position } from "@xyflow/react"
import { Play } from "lucide-react"

export const TriggerNode = memo(({ data }: { data: Record<string, any> }) => {
  return (
    <div className="w-64 rounded-md border-2 border-primary bg-card shadow-sm">
      <div className="flex items-center gap-2 rounded-t-sm bg-primary/10 px-3 py-2">
        <Play className="h-4 w-4 text-primary" />
        <div className="text-sm font-medium text-primary">Trigger</div>
      </div>
      <div className="p-3">
        <div className="text-sm font-medium">{data.label || "Start Event"}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {data.description || "When this happens, the workflow starts."}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary" />
    </div>
  )
})
TriggerNode.displayName = "TriggerNode"
