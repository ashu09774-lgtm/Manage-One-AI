"use client"
// Branding: Manage One AI

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { Zap, Menu, X, ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"

const navLinks = [
  { name: "Features", href: "#features" },
  { name: "How It Works", href: "#how-it-works" },
  { name: "Pricing", href: "#pricing" },
]

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      {/* Spacer so content doesn't jump */}
      <div className="h-20" />

      <header className="fixed left-0 right-0 top-0 z-50 flex justify-center px-4 pt-3">
        <div
          className={`relative flex w-full max-w-5xl items-center justify-between rounded-2xl border px-5 py-2.5 transition-all duration-500 ${
            scrolled
              ? "border-border/40 bg-background/60 shadow-lg shadow-black/5 backdrop-blur-2xl dark:shadow-black/20"
              : "border-white/10 bg-white/5 backdrop-blur-md dark:border-white/[0.06] dark:bg-white/[0.03]"
          }`}
        >
          {/* Animated gradient border overlay */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl">
            <div className="absolute inset-[-1px] rounded-2xl bg-gradient-to-r from-primary/20 via-transparent to-chart-2/20 opacity-0 transition-opacity duration-500" style={{ opacity: scrolled ? 0.6 : 0 }} />
          </div>

          {/* Inner glow */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent dark:from-white/[0.04]" />

          {/* Logo */}
          <Link href="/" className="group relative z-10 flex items-center gap-2.5">
            <div className="relative">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary via-primary to-chart-2 shadow-lg shadow-primary/30">
                <Zap className="h-4 w-4 text-white" />
              </div>
              {/* Logo glow */}
              <div className="absolute -inset-1 -z-10 rounded-lg bg-primary/20 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
            </div>
            <span className="text-base font-bold tracking-tight">
              Manage <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">One</span>
            </span>
          </Link>

          {/* Desktop Navigation — Pill Style */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center md:flex">
            <div className="flex items-center rounded-xl bg-muted/40 p-1 backdrop-blur-sm dark:bg-white/[0.06]">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="relative rounded-lg px-4 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-background/60 hover:text-foreground dark:hover:bg-white/10"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </nav>

          {/* Desktop Actions */}
          <div className="relative z-10 hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm" className="h-8 text-sm text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="relative h-8 gap-1.5 overflow-hidden bg-gradient-to-r from-primary to-chart-2 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40 hover:brightness-110">
                Get Started
                <ArrowRight className="h-3.5 w-3.5" />
                {/* Shine effect */}
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="relative z-10 flex items-center gap-1.5 md:hidden">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/40 text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground dark:bg-white/[0.06]"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              <div className="relative h-4 w-4">
                <span className={`absolute left-0 block h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ${mobileMenuOpen ? "top-[7px] rotate-45" : "top-[3px]"}`} />
                <span className={`absolute left-0 top-[7px] block h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ${mobileMenuOpen ? "opacity-0" : "opacity-100"}`} />
                <span className={`absolute left-0 block h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ${mobileMenuOpen ? "top-[7px] -rotate-45" : "top-[11px]"}`} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <div
          className={`absolute left-4 right-4 top-[68px] overflow-hidden rounded-2xl border border-border/30 bg-background/90 shadow-2xl shadow-black/10 backdrop-blur-2xl transition-all duration-300 dark:shadow-black/30 md:hidden ${
            mobileMenuOpen ? "max-h-80 opacity-100" : "max-h-0 border-transparent opacity-0"
          }`}
        >
          <nav className="flex flex-col gap-1 p-3">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border/20 pt-3">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full rounded-xl">Sign In</Button>
              </Link>
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full gap-1.5 rounded-xl bg-gradient-to-r from-primary to-chart-2 text-white">
                  Get Started <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </nav>
        </div>
      </header>
    </>
  )
}
