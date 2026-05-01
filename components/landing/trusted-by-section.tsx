"use client"

import { motion } from "framer-motion"

// Mock company logos
const LOGOS = [
  { name: "Acme Corp", icon: "🏢" },
  { name: "GlobalTech", icon: "🌐" },
  { name: "Nexus", icon: "⚡" },
  { name: "Starlight", icon: "⭐" },
  { name: "Pinnacle", icon: "⛰️" },
  { name: "Vertex", icon: "🔺" },
  { name: "Quantum", icon: "⚛️" },
  { name: "Horizon", icon: "🌅" },
]

export function TrustedBySection() {
  return (
    <section className="border-b border-border/40 bg-muted/20 py-12">
      <div className="container mx-auto px-4 text-center">
        <p className="mb-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Trusted by innovative teams worldwide
        </p>
        
        <div className="relative mx-auto max-w-5xl overflow-hidden">
          {/* Gradient masks for smooth fade on edges */}
          <div className="absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-background to-transparent" />
          <div className="absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-background to-transparent" />
          
          <div className="flex w-[200%] gap-8">
            <motion.div
              className="flex w-1/2 justify-between gap-8 whitespace-nowrap"
              animate={{ x: [0, "-100%"] }}
              transition={{ repeat: Infinity, ease: "linear", duration: 25 }}
            >
              {[...LOGOS, ...LOGOS].map((logo, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-2 text-2xl font-bold text-muted-foreground/40 grayscale transition-all hover:text-muted-foreground/80 hover:grayscale-0"
                >
                  <span className="text-3xl">{logo.icon}</span>
                  {logo.name}
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
