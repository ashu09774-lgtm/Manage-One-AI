"use client"

import { useEffect, useRef, useState } from "react"
import { Database, Bot, Workflow, FileText, Shield, Cpu } from "lucide-react"

const stats = [
  {
    icon: Database,
    value: 20,
    suffix: "+",
    label: "Database Tables",
    description: "Production-grade MySQL schema",
  },
  {
    icon: Bot,
    value: 4,
    suffix: "",
    label: "AI Agents",
    description: "Planner, Scheduler, Researcher, Automator",
  },
  {
    icon: Workflow,
    value: 6,
    suffix: "",
    label: "Prompt Templates",
    description: "Pre-built AI workflows",
  },
  {
    icon: FileText,
    value: 15,
    suffix: "+",
    label: "API Endpoints",
    description: "Full REST API coverage",
  },
  {
    icon: Shield,
    value: 57,
    suffix: "",
    label: "UI Components",
    description: "Built on Radix primitives",
  },
  {
    icon: Cpu,
    value: 5,
    suffix: "",
    label: "Test Suites",
    description: "Smoke, goals, deliverables & more",
  },
]

function AnimatedCounter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          let current = 0
          const increment = target / 40
          const timer = setInterval(() => {
            current += increment
            if (current >= target) {
              setCount(target)
              clearInterval(timer)
            } else {
              setCount(Math.floor(current))
            }
          }, 30)
          return () => clearInterval(timer)
        }
      },
      { threshold: 0.3 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [target, hasAnimated])

  return (
    <div ref={ref} className="text-3xl font-bold tabular-nums lg:text-4xl">
      {count}{suffix}
    </div>
  )
}

export function StatsSection() {
  return (
    <section className="relative overflow-hidden border-t border-border/40 py-20 lg:py-24">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.02] to-background" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="mb-3 text-2xl font-bold tracking-tight md:text-3xl">
            Built for real production use
          </h2>
          <p className="text-muted-foreground">
            Not a demo. Not a template. A full-stack platform with real depth.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="group flex flex-col items-center rounded-xl border border-border/30 bg-card/30 p-4 text-center backdrop-blur-sm transition-all duration-300 hover:border-border hover:bg-card/60"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                <stat.icon className="h-5 w-5" />
              </div>
              <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              <div className="mt-1 text-sm font-medium">{stat.label}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
