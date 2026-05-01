"use client"

import { motion } from "framer-motion"
import { FolderPlus, ListTodo, Sparkles, CheckCircle2, ArrowRight } from "lucide-react"

const steps = [
  {
    step: "01",
    icon: FolderPlus,
    title: "Create a Workspace",
    description: "Set up your workspace in seconds. Invite team members, define projects, and organize everything in one place.",
    color: "from-primary to-primary/60",
    iconBg: "bg-primary/10 text-primary",
    mockup: (
      <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-border/50 pb-3">
          <div className="h-8 w-8 rounded-md bg-primary/20 flex items-center justify-center text-primary font-bold">W</div>
          <div>
            <div className="text-sm font-semibold">Engineering Team</div>
            <div className="text-xs text-muted-foreground">4 members • 2 projects</div>
          </div>
        </div>
        <div className="flex -space-x-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-6 w-6 rounded-full border-2 border-background bg-muted" />
          ))}
        </div>
      </div>
    )
  },
  {
    step: "02",
    icon: ListTodo,
    title: "Add Tasks & Collaborate",
    description: "Create tasks with due dates, labels, and subtasks. Comment, attach files, and chat with your team in real-time.",
    color: "from-chart-2 to-chart-2/60",
    iconBg: "bg-chart-2/10 text-chart-2",
    mockup: (
      <div className="flex flex-col gap-2 rounded-lg border border-border/50 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold">Q3 Roadmap</div>
          <div className="text-[10px] bg-chart-2/20 text-chart-2 px-2 py-0.5 rounded">In Progress</div>
        </div>
        <div className="mt-2 space-y-2">
          {["Design System", "Auth Flow", "Database Schema"].map((t, i) => (
            <div key={i} className="flex items-center gap-2 rounded border border-border/50 bg-background/50 p-2">
              <CheckCircle2 className={`h-3 w-3 ${i === 0 ? "text-chart-2" : "text-muted-foreground"}`} />
              <span className={`text-xs ${i === 0 ? "line-through text-muted-foreground" : ""}`}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    step: "03",
    icon: Sparkles,
    title: "Let AI Do the Heavy Lifting",
    description: "Ask the AI assistant to plan your sprint, triage priorities, generate tasks, or automate recurring workflows.",
    color: "from-chart-5 to-chart-5/60",
    iconBg: "bg-chart-5/10 text-chart-5",
    mockup: (
      <div className="flex flex-col gap-3 rounded-lg border border-border/50 bg-card p-4 shadow-sm">
        <div className="text-xs text-muted-foreground self-end bg-muted/50 px-3 py-2 rounded-lg rounded-tr-none">
          Plan my next sprint
        </div>
        <div className="text-xs bg-chart-5/10 text-chart-5 border border-chart-5/20 px-3 py-2 rounded-lg rounded-tl-none">
          <div className="flex items-center gap-1.5 font-semibold mb-2">
            <Sparkles className="h-3 w-3" />
            AI Assistant
          </div>
          I have generated 5 tasks for your next sprint based on overdue items and the Q3 roadmap.
        </div>
      </div>
    )
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative border-t border-border/40 bg-muted/20 py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-chart-2/20 bg-chart-2/5 px-4 py-1.5 text-sm font-medium text-chart-2">
            Quick Setup
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            Up and running in{" "}
            <span className="bg-gradient-to-r from-chart-2 to-chart-3 bg-clip-text text-transparent">
              3 simple steps
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            No complicated setup. No training needed. Start managing work smarter in minutes.
          </p>
        </div>

        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-24">
            {steps.map((step, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className={`flex flex-col gap-12 lg:flex-row lg:items-center ${index % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
              >
                {/* Text Content */}
                <div className="flex-1 space-y-6">
                  <div className={`inline-flex bg-gradient-to-r ${step.color} bg-clip-text text-6xl font-black text-transparent opacity-50`}>
                    {step.step}
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${step.iconBg}`}>
                    <step.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-bold md:text-3xl">{step.title}</h3>
                  <p className="text-lg leading-relaxed text-muted-foreground">{step.description}</p>
                </div>

                {/* Visual Mockup */}
                <div className="flex-1 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted rounded-2xl -rotate-3 scale-105" />
                  <div className="relative rounded-2xl border border-border/40 bg-background p-6 shadow-xl overflow-hidden min-h-[250px] flex items-center justify-center">
                    {step.mockup}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
