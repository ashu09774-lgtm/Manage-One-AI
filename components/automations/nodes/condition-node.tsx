import { memo } from "react"
import { Handle, Position } from "@xyflow/react"
import { GitBranch } from "lucide-react"

export const ConditionNode = memo(({ data }: { data: Record<string, any> }) => {
  return (
    <div className="w-64 rounded-md border border-border bg-card shadow-sm">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground" />
      <div className="flex items-center gap-2 rounded-t-sm bg-orange-500/10 px-3 py-2 border-b border-border">
        <GitBranch className="h-4 w-4 text-orange-500" />
        <div className="text-sm font-medium text-orange-500">Condition</div>
      </div>
      <div className="p-3">
        <div className="text-sm font-medium">{data.label || "If / Else"}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {data.description || "Branch based on data."}
        </div>
      </div>
      
      {/* True / False handles */}
      <div className="relative h-6 bg-muted/30 border-t border-border rounded-b-sm flex justify-between px-4 items-center">
        <span className="text-[10px] uppercase text-green-500 font-bold">True</span>
        <span className="text-[10px] uppercase text-red-500 font-bold">False</span>
        
        <Handle 
          type="source" 
          position={Position.Bottom} 
          id="true" 
          className="w-3 h-3 bg-green-500" 
          style={{ left: '20%' }} 
        />
        <Handle 
          type="source" 
          position={Position.Bottom} 
          id="false" 
          className="w-3 h-3 bg-red-500" 
          style={{ left: '80%' }} 
        />
      </div>
    </div>
  )
})
ConditionNode.displayName = "ConditionNode"
