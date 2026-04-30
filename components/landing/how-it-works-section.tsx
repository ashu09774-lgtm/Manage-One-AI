"use client"

import { FolderPlus, ListTodo, Sparkles } from "lucide-react"

const steps = [
  {
    step: "01",
    icon: FolderPlus,
    title: "Create a Workspace",
    description: "Set up your workspace in seconds. Invite team members, define projects, and organize everything in one place.",
    color: "from-primary to-primary/60",
    iconBg: "bg-primary/10 text-primary",
  },
  {
    step: "02",
    icon: ListTodo,
    title: "Add Tasks & Collaborate",
    description: "Create tasks with due dates, labels, and subtasks. Comment, attach files, and chat with your team in real-time.",
    color: "from-chart-2 to-chart-2/60",
    iconBg: "bg-chart-2/10 text-chart-2",
  },
  {
    step: "03",
    icon: Sparkles,
    title: "Let AI Do the Heavy Lifting",
    description: "Ask the AI assistant to plan your sprint, triage priorities, generate tasks, or automate recurring workflows.",
    color: "from-chart-5 to-chart-5/60",
    iconBg: "bg-chart-5/10 text-chart-5",
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
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={index} className="group relative">
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="absolute right-0 top-16 hidden h-px w-full translate-x-1/2 bg-gradient-to-r from-border to-transparent md:block" />
                )}

                <div className="relative rounded-xl border border-border/40 bg-card/50 p-6 backdrop-blur-sm transition-all duration-300 hover:border-border hover:shadow-lg">
                  {/* Step number */}
                  <div className={`mb-4 inline-flex bg-gradient-to-r ${step.color} bg-clip-text text-3xl font-black text-transparent`}>
                    {step.step}
                  </div>

                  {/* Icon */}
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${step.iconBg} transition-transform duration-300 group-hover:scale-110`}>
                    <step.icon className="h-6 w-6" />
                  </div>

                  <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
