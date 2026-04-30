"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles, CheckCircle2, Bot, BarChart3, Zap, Users, FileText } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background pb-20 pt-8 md:pb-32 md:pt-12">

      {/* Animated gradient orbs */}
      <div className="gradient-orb gradient-orb-1 animate-float-slow" style={{ top: "-200px", left: "-100px" }} />
      <div className="gradient-orb gradient-orb-2 animate-float-medium" style={{ top: "100px", right: "-150px" }} />
      <div className="gradient-orb gradient-orb-3 animate-float-fast" style={{ bottom: "-100px", left: "30%" }} />

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto max-w-5xl text-center">

          {/* Animated Badge */}
          <div className="animate-slide-up mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2 text-sm backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="font-medium text-primary">AI-Powered Workspace</span>
            <span className="text-muted-foreground">— Built with Gemini AI</span>
          </div>

          {/* Headline */}
          <h1 className="animate-slide-up stagger-1 mb-6 text-balance text-4xl font-bold tracking-tight md:text-6xl lg:text-7xl" style={{ opacity: 0 }}>
            Your team&apos;s work,{" "}
            <span className="animate-gradient-shift bg-gradient-to-r from-primary via-chart-2 to-chart-5 bg-clip-text text-transparent">
              powered by AI
            </span>
          </h1>

          {/* Subheadline */}
          <p className="animate-slide-up stagger-2 mx-auto mb-10 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl" style={{ opacity: 0 }}>
            TaskFlow AI manages your tasks, automates repetitive workflows, and gives your team
            an AI assistant that actually understands your projects.
          </p>

          {/* CTA Buttons */}
          <div className="animate-slide-up stagger-3 flex flex-col items-center justify-center gap-4 sm:flex-row" style={{ opacity: 0 }}>
            <Link href="/signup">
              <Button size="lg" className="gap-2 px-8 text-base shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="outline" size="lg" className="gap-2 px-8 text-base">
                <Sparkles className="h-4 w-4" />
                See How It Works
              </Button>
            </Link>
          </div>

          {/* Quick trust signals */}
          <div className="animate-slide-up stagger-4 mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground" style={{ opacity: 0 }}>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-chart-3" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-chart-3" />
              Free tier available
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-chart-3" />
              Works with Google login
            </span>
          </div>

          {/* Dashboard Preview — Rich Mockup */}
          <div className="animate-slide-up stagger-5 relative mx-auto mt-16 max-w-4xl" style={{ opacity: 0 }}>
            {/* Glow behind the card */}
            <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-primary/20 via-chart-2/10 to-chart-5/20 opacity-60 blur-2xl" />

            <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-border bg-muted/60 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-400/80" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400/80" />
                  <div className="h-3 w-3 rounded-full bg-green-400/80" />
                </div>
                <div className="ml-4 flex-1 rounded-md bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                  taskflow-ai.app/dashboard
                </div>
              </div>

              {/* Dashboard content */}
              <div className="grid grid-cols-12 gap-0">
                {/* Sidebar */}
                <div className="col-span-3 border-r border-border/50 bg-muted/20 p-4 lg:col-span-2">
                  <div className="mb-6 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                      <Zap className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                    <span className="hidden text-xs font-bold lg:inline">TaskFlow</span>
                  </div>
                  <div className="space-y-1">
                    {[
                      { icon: BarChart3, label: "Dashboard", active: true },
                      { icon: CheckCircle2, label: "Tasks", active: false },
                      { icon: Users, label: "Team", active: false },
                      { icon: Bot, label: "AI Assistant", active: false },
                      { icon: FileText, label: "Notes", active: false },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                          item.active
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-muted-foreground"
                        }`}
                      >
                        <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="hidden lg:inline">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main content */}
                <div className="col-span-9 space-y-4 p-4 lg:col-span-10 lg:p-6">
                  {/* Greeting & stats */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Good morning, Asha 👋</div>
                      <div className="text-xs text-muted-foreground">You have 4 tasks due today</div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      <Bot className="h-3 w-3" />
                      AI Ready
                    </div>
                  </div>

                  {/* Stat cards */}
                  <div className="grid grid-cols-4 gap-2 lg:gap-3">
                    {[
                      { label: "Active Tasks", value: "24", color: "text-primary" },
                      { label: "Completed", value: "156", color: "text-chart-3" },
                      { label: "Team Members", value: "8", color: "text-chart-2" },
                      { label: "Completion", value: "87%", color: "text-chart-4" },
                    ].map((stat, i) => (
                      <div key={i} className="rounded-lg border border-border/40 bg-background/50 p-2 lg:p-3">
                        <div className={`text-base font-bold lg:text-lg ${stat.color}`}>{stat.value}</div>
                        <div className="text-[10px] text-muted-foreground lg:text-xs">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Task list preview */}
                  <div className="rounded-lg border border-border/40 bg-background/30 p-3">
                    <div className="mb-2 text-xs font-semibold">Recent Tasks</div>
                    <div className="space-y-1.5">
                      {[
                        { title: "Design system audit", status: "In Progress", priority: "high", color: "bg-blue-500" },
                        { title: "API integration tests", status: "Review", priority: "urgent", color: "bg-amber-500" },
                        { title: "Deploy v2.1 to staging", status: "Todo", priority: "medium", color: "bg-muted-foreground" },
                      ].map((task, i) => (
                        <div key={i} className="flex items-center justify-between rounded-md bg-muted/30 px-2.5 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full ${task.color}`} />
                            <span className="text-xs">{task.title}</span>
                          </div>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            task.priority === "urgent"
                              ? "bg-destructive/10 text-destructive"
                              : task.priority === "high"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating AI card */}
            <div className="animate-float-medium absolute -right-4 bottom-8 hidden rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm md:block lg:-right-8">
              <div className="mb-1.5 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-xs font-semibold">AI Assistant</span>
              </div>
              <p className="max-w-[180px] text-[11px] text-muted-foreground">
                &quot;I&apos;ve prioritized 3 tasks based on your upcoming deadlines.&quot;
              </p>
            </div>

            {/* Floating automation card */}
            <div className="animate-float-slow absolute -left-4 top-24 hidden rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm md:block lg:-left-8">
              <div className="mb-1.5 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-chart-3/10">
                  <Zap className="h-3.5 w-3.5 text-chart-3" />
                </div>
                <span className="text-xs font-semibold">Automation</span>
              </div>
              <p className="max-w-[160px] text-[11px] text-muted-foreground">
                Overdue reminder sent to 2 team members
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
