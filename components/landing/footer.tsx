"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Zap, ArrowRight, Github, Twitter, Linkedin, Heart, CheckCircle2, Mail } from "lucide-react"
import { useState } from "react"

const footerSections = [
  {
    title: "Product",
    links: [
      { name: "Features", href: "#features" },
      { name: "How It Works", href: "#how-it-works" },
      { name: "Pricing", href: "#pricing" },
      { name: "AI Assistant", href: "/dashboard/assistant" },
    ],
  },
  {
    title: "Platform",
    links: [
      { name: "Dashboard", href: "/dashboard" },
      { name: "Analytics", href: "/dashboard/analytics" },
      { name: "Automations", href: "/dashboard/automations" },
      { name: "Workspaces", href: "/dashboard/workspaces" },
    ],
  },
  {
    title: "Account",
    links: [
      { name: "Sign In", href: "/login" },
      { name: "Create Account", href: "/signup" },
      { name: "Reset Password", href: "/forgot-password" },
      { name: "Settings", href: "/dashboard/settings" },
    ],
  },
]

const socialLinks = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Github, href: "#", label: "GitHub" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
]

export function Footer() {
  const [email, setEmail] = useState("")
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim()) {
      setSubscribed(true)
      setEmail("")
      setTimeout(() => setSubscribed(false), 4000)
    }
  }

  return (
    <footer className="relative overflow-hidden">
      {/* Top gradient divider */}
      <div className="relative h-px">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="animate-pulse-glow absolute left-1/2 top-0 h-4 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-xl" />
      </div>

      {/* Background mesh */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />

      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Background orbs */}
      <div className="gradient-orb gradient-orb-1 animate-float-slow" style={{ bottom: "-300px", left: "-100px", opacity: 0.15 }} />
      <div className="gradient-orb gradient-orb-2 animate-float-medium" style={{ bottom: "-200px", right: "-100px", opacity: 0.1 }} />
      <div className="gradient-orb gradient-orb-3 animate-float-fast" style={{ top: "100px", left: "50%", opacity: 0.08 }} />

      <div className="container relative z-10 mx-auto px-4">

        {/* Newsletter — Glassmorphic Card */}
        <div className="relative -mt-1 py-14">
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-primary/[0.08] via-chart-2/[0.04] to-chart-5/[0.06] p-8 shadow-2xl shadow-primary/5 backdrop-blur-xl dark:border-white/[0.06]">
            {/* Inner glow */}
            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.05] to-transparent" />

            <div className="relative z-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mb-1.5 text-lg font-semibold">Stay in the loop</h3>
              <p className="mb-5 text-sm text-muted-foreground">
                Product updates, AI tips, and new feature announcements. No spam.
              </p>
              <form onSubmit={handleSubscribe} className="mx-auto flex max-w-sm gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="h-10 flex-1 rounded-xl border border-white/10 bg-background/40 px-4 text-sm backdrop-blur-sm transition-all placeholder:text-muted-foreground/50 focus:border-primary/40 focus:bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/[0.08]"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-10 gap-1.5 rounded-xl bg-gradient-to-r from-primary to-chart-2 px-5 text-white shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30 hover:brightness-110"
                >
                  {subscribed ? "Subscribed ✓" : (
                    <>Subscribe <ArrowRight className="h-3.5 w-3.5" /></>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid gap-10 pb-10 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand Column */}
          <div className="lg:col-span-5">
            <Link href="/" className="group inline-flex items-center gap-2.5">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary to-chart-2 shadow-lg shadow-primary/25">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div className="absolute -inset-1 -z-10 rounded-xl bg-primary/20 opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Task<span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">Flow</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              AI-powered productivity for modern teams. Manage tasks, orchestrate AI agents,
              automate workflows, and collaborate in real-time — all from one workspace.
            </p>

            {/* Status indicator */}
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-chart-3/20 bg-chart-3/5 px-3 py-1.5 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-chart-3 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-chart-3" />
              </span>
              <span className="font-medium text-chart-3">All systems operational</span>
            </div>

            {/* Social Links */}
            <div className="mt-5 flex items-center gap-2">
              {socialLinks.map((social) => (
                <Link
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="group relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/30 bg-card/30 text-muted-foreground transition-all duration-300 hover:border-primary/30 hover:text-primary"
                >
                  <social.icon className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
                  <div className="absolute -inset-0.5 -z-10 rounded-xl bg-primary/10 opacity-0 blur transition-opacity duration-300 group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </div>

          {/* Link Columns */}
          {footerSections.map((section) => (
            <div key={section.title} className="lg:col-span-2 lg:col-start-auto">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center text-sm text-muted-foreground transition-all duration-200 hover:text-foreground"
                    >
                      <span className="mr-0 h-px w-0 bg-gradient-to-r from-primary to-chart-2 transition-all duration-300 group-hover:mr-2 group-hover:w-4" />
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="relative border-t border-border/10 py-6">
          {/* Gradient on the border */}
          <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground/60">
              <span>© {new Date().getFullYear()} TaskFlow AI</span>
              <span className="hidden text-border/40 md:inline">•</span>
              <span className="flex items-center gap-1">
                Built with Next.js, MySQL & Gemini AI
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <span>Crafted with</span>
              <Heart className="h-3 w-3 fill-red-500/80 text-red-500/80 transition-transform duration-300 hover:scale-125" />
              <span>for teams that ship</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
