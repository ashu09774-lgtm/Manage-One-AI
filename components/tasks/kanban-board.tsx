"use client"

import React, { useState } from "react"
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core"
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card } from "@/components/ui/card"

export interface KanbanColumn {
  id: string
  title: string
  color?: string
}

export interface KanbanTask {
  id: string | number
  status: string
  sort_order?: number
}

interface KanbanBoardProps<T extends KanbanTask> {
  columns: readonly KanbanColumn[]
  tasks: T[]
  onTaskMove: (taskId: string | number, newStatus: string, newIndex: number) => void
  renderTask: (task: T, isDragging: boolean) => React.ReactNode
  renderColumnHeader?: (column: KanbanColumn, taskCount: number) => React.ReactNode
}

interface SortableTaskProps {
  task: KanbanTask
  renderTask: (task: KanbanTask, isDragging: boolean) => React.ReactNode
}

function SortableTask({ task, renderTask }: SortableTaskProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "Task", task },
  })

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`touch-none ${isDragging ? "opacity-50" : ""}`}>
      {renderTask(task, isDragging)}
    </div>
  )
}

interface KanbanColumnContainerProps {
  column: KanbanColumn
  tasks: KanbanTask[]
  renderTask: (task: KanbanTask, isDragging: boolean) => React.ReactNode
  renderHeader?: (column: KanbanColumn, taskCount: number) => React.ReactNode
}

function KanbanColumnContainer({ column, tasks, renderTask, renderHeader }: KanbanColumnContainerProps) {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: { type: "Column", column },
  })

  return (
    <div ref={setNodeRef} className="flex w-80 flex-shrink-0 flex-col rounded-lg border border-border bg-muted/30 pb-2">
      {renderHeader ? (
        renderHeader(column, tasks.length)
      ) : (
        <div className="flex items-center justify-between border-b border-border p-3">
          <h3 className="font-semibold">{column.title}</h3>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">{tasks.length}</span>
        </div>
      )}
      
      <div className="flex flex-1 flex-col gap-2 p-2">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTask key={task.id} task={task} renderTask={renderTask} />
          ))}
        </SortableContext>
        {tasks.length === 0 && <p className="p-2 text-sm text-muted-foreground">No tasks</p>}
      </div>
    </div>
  )
}

export function KanbanBoard<T extends KanbanTask>({
  columns,
  tasks,
  onTaskMove,
  renderTask,
  renderColumnHeader,
}: KanbanBoardProps<T>) {
  const [activeTask, setActiveTask] = useState<T | null>(null)
  const [localTasks, setLocalTasks] = useState<T[]>(tasks)

  // Sync with prop when it changes from outside
  React.useEffect(() => {
    setLocalTasks(tasks)
  }, [tasks])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    if (active.data.current?.type === "Task") {
      setActiveTask(active.data.current.task)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    if (activeId === overId) return

    const isActiveTask = active.data.current?.type === "Task"
    const isOverTask = over.data.current?.type === "Task"
    const isOverColumn = over.data.current?.type === "Column"

    if (!isActiveTask) return

    // Dropping a Task over another Task
    if (isActiveTask && isOverTask) {
      setLocalTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId)
        const overIndex = tasks.findIndex((t) => t.id === overId)
        
        if (tasks[activeIndex].status !== tasks[overIndex].status) {
          const newTasks = [...tasks]
          newTasks[activeIndex].status = tasks[overIndex].status
          return arrayMove(newTasks, activeIndex, overIndex)
        }
        return arrayMove(tasks, activeIndex, overIndex)
      })
    }

    // Dropping a Task over an empty Column
    if (isActiveTask && isOverColumn) {
      setLocalTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId)
        const newTasks = [...tasks]
        newTasks[activeIndex].status = overId as string
        return arrayMove(newTasks, activeIndex, newTasks.length - 1)
      })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    if (activeId === overId) return

    const activeIndex = localTasks.findIndex((t) => t.id === activeId)
    const task = localTasks[activeIndex]
    
    // Calculate new index within the specific column
    const columnTasks = localTasks.filter(t => t.status === task.status)
    const newIndexInColumn = columnTasks.findIndex(t => t.id === task.id)
    
    onTaskMove(task.id, task.status, newIndexInColumn)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 pb-4 overflow-x-auto min-h-[400px]">
        {columns.map((column) => (
          <KanbanColumnContainer
            key={column.id}
            column={column}
            tasks={localTasks.filter((task) => task.status === column.id)}
            renderTask={renderTask as any}
            renderHeader={renderColumnHeader}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) }}>
        {activeTask ? (
          <div className="rotate-2 scale-105 shadow-xl">
            {renderTask(activeTask, true)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
