"use client"

import { motion } from "framer-motion"
import { Quote } from "lucide-react"

const testimonials = [
  {
    quote: "Manage One AI completely transformed how we manage our sprints. The AI prioritization alone saves me five hours a week.",
    author: "Sarah Jenkins",
    role: "Product Manager at TechFlow",
    avatar: "SJ",
  },
  {
    quote: "We moved from Jira to Manage One and haven't looked back. The node-based automation is incredibly powerful yet easy to use.",
    author: "Michael Chen",
    role: "Engineering Lead at Vertex",
    avatar: "MC",
  },
  {
    quote: "The interface is gorgeous and lightning fast. Having our notes, tasks, and team chat in one place makes everything seamless.",
    author: "Elena Rodriguez",
    role: "Operations Director at Acme Corp",
    avatar: "ER",
  },
]

export function TestimonialsSection() {
  return (
    <section className="relative overflow-hidden border-t border-border/40 bg-background py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            Loved by product teams
          </h2>
          <p className="text-lg text-muted-foreground">
            Don&apos;t just take our word for it. Here&apos;s what our users have to say.
          </p>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative rounded-2xl border border-border/40 bg-muted/20 p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <Quote className="absolute right-6 top-6 h-8 w-8 text-primary/10" />
                <p className="mb-6 text-base leading-relaxed text-foreground md:text-lg">
                  &quot;{testimonial.quote}&quot;
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.author}</div>
                    <div className="text-sm text-muted-foreground">{testimonial.role}</div>
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
