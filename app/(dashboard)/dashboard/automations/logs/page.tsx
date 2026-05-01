"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2, XCircle, Clock, Search, History, Terminal } from "lucide-react"
import { Input } from "@/components/ui/input"

interface AutomationRun {
  id: number
  automationId: number
  automationName: string
  triggerType: string
  status: "success" | "failed" | "partial"
  startedAt: string
  finishedAt: string | null
  errorMessage: string | null
}

interface AutomationLog {
  id: number
  runId: number
  nodeId: string
  nodeType: string
  status: "success" | "failed" | "skipped"
  inputData: any
  outputData: any
  errorDetails: string | null
  createdAt: string
}

export default function AutomationLogsPage() {
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [logs, setLogs] = useState<AutomationLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    void fetchRuns()
  }, [])

  useEffect(() => {
    if (selectedRunId) {
      void fetchLogs(selectedRunId)
    }
  }, [selectedRunId])

  async function fetchRuns() {
    try {
      const user = JSON.parse(localStorage.getItem("manageone_user") || "{}")
      const response = await fetch(`/api/automations/runs?userId=${user.id}`)
      const data = await response.json()
      setRuns(data.runs || [])
      if (data.runs?.length > 0) {
        setSelectedRunId(data.runs[0].id)
      }
    } catch (err) {
      console.error("Failed to fetch runs:", err)
    } finally {
      setIsLoading(false)
    }
  }

  async function fetchLogs(runId: number) {
    try {
      const user = JSON.parse(localStorage.getItem("manageone_user") || "{}")
      const response = await fetch(`/api/automations/runs/${runId}/logs?userId=${user.id}`)
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (err) {
      console.error("Failed to fetch logs:", err)
    }
  }

  const filteredRuns = runs.filter(run => 
    run.automationName.toLowerCase().includes(search.toLowerCase()) ||
    run.triggerType.toLowerCase().includes(search.toLowerCase())
  )

  const selectedRun = runs.find(r => r.id === selectedRunId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automation Logs</h1>
        <p className="text-muted-foreground">Monitor execution history and debug automated workflows.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[400px,1fr]">
        <Card className="flex h-[700px] flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Run History
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter runs..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-4 pt-0">
              {filteredRuns.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setSelectedRunId(run.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted ${
                    selectedRunId === run.id ? "border-primary bg-primary/5" : "border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{run.automationName}</span>
                    {run.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{run.triggerType}</span>
                    <span>{new Date(run.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </button>
              ))}
              {filteredRuns.length === 0 && !isLoading && (
                <p className="py-8 text-center text-sm text-muted-foreground">No runs found.</p>
              )}
            </div>
          </ScrollArea>
        </Card>

        <div className="space-y-6">
          {selectedRun ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedRun.automationName}</CardTitle>
                      <CardDescription>Run ID: {selectedRun.id}</CardDescription>
                    </div>
                    <Badge variant={selectedRun.status === "success" ? "default" : "destructive"}>
                      {selectedRun.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Started</span>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(selectedRun.startedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Trigger</span>
                    <div className="text-sm font-medium">{selectedRun.triggerType}</div>
                  </div>
                  {selectedRun.errorMessage && (
                    <div className="col-span-full rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      <strong>Error:</strong> {selectedRun.errorMessage}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="flex flex-col h-[460px]">
                <CardHeader className="border-b">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Step Trace
                  </CardTitle>
                </CardHeader>
                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Node ID</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="text-right">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">{log.nodeId}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{log.nodeType}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {log.status === "success" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-destructive" />
                              )}
                              <span className="text-xs capitalize">{log.status}</span>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            {log.errorDetails ? (
                              <span className="text-xs text-destructive">{log.errorDetails}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground truncate block">
                                {JSON.stringify(log.outputData)}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {logs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No logs available for this run.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            </>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              Select a run to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

