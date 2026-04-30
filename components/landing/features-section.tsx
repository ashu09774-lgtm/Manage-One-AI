"use client"

import {
  Brain,
  Workflow,
  Users,
  Bot,
  Kanban,
  BarChart3,
} from "lucide-react"

const features = [
  {
    icon: Brain,
    title: "AI Task Planning",
    description: "Describe your project goal in plain English. The AI breaks it into actionable tasks with priorities, assignees, and due date suggestions.",
    gradient: "from-primary/10 to-chart-2/10",
    iconBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
  },
  {
    icon: Bot,
    title: "Multi-Agent System",
    description: "4 specialized AI agents — Planner, Scheduler, Researcher, and Automator — collaborate on complex goals and deliver structured reports.",
    gradient: "from-chart-2/10 to-chart-3/10",
    iconBg: "bg-chart-2/10 text-chart-2 group-hover:bg-chart-2 group-hover:text-white",
  },
  {
    icon: Workflow,
    title: "Smart Automations",
    description: "Set trigger-action rules for overdue reminders, recurring task cloning, and completion follow-ups. Run them manually or on schedule.",
    gradient: "from-chart-3/10 to-chart-4/10",
    iconBg: "bg-chart-3/10 text-chart-3 group-hover:bg-chart-3 group-hover:text-white",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description: "Workspace chat, shared documents, task comments with @mentions, and a live activity feed keep everyone in sync.",
    gradient: "from-chart-4/10 to-chart-5/10",
    iconBg: "bg-chart-4/10 text-chart-4 group-hover:bg-chart-4 group-hover:text-white",
  },
  {
    icon: Kanban,
    title: "Flexible Task Views",
    description: "Organize work with list view, Kanban boards, and calendar layouts. Add labels, subtasks, attachments, and due dates to every task.",
    gradient: "from-chart-5/10 to-primary/10",
    iconBg: "bg-chart-5/10 text-chart-5 group-hover:bg-chart-5 group-hover:text-white",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Track completion rates, workload distribution, priority breakdowns, and project health with visual charts and AI-powered insights.",
    gradient: "from-primary/10 to-chart-5/10",
    iconBg: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative overflow-hidden border-t border-border/40 py-24 lg:py-32">
      {/* Background gradient */}
      <div className="gradient-orb gradient-orb-2 animate-float-slow" style={{ top: "20%", right: "-200px", opacity: 0.5 }} />

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
            Real Features, No Hype
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            Everything your team{" "}
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              actually needs
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Built-in AI assistance, task management, and automation — working together out of the box.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`card-glow group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br ${feature.gradient} p-6 backdrop-blur-sm`}
            >
              {/* Shimmer overlay on hover */}
              <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                <div className="animate-shimmer h-full w-full" />
              </div>

              <div className="relative z-10">
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-300 ${feature.iconBg}`}>
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
