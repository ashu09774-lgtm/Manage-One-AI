import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

const plans = [
  {
    name: "Starter",
    description: "For individuals and side projects",
    price: "Free",
    period: "forever",
    features: [
      "Up to 3 workspaces",
      "AI assistant (basic)",
      "5 automation rules",
      "Task management & Kanban",
      "1 GB file storage",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    description: "For teams that ship fast",
    price: "$12",
    period: "per user/month",
    features: [
      "Unlimited workspaces",
      "Full AI assistant + multi-agent",
      "Unlimited automations",
      "Priority support",
      "50 GB file storage",
      "Advanced analytics",
      "Custom prompt templates",
    ],
    cta: "Start 14-Day Trial",
    popular: true,
  },
  {
    name: "Team",
    description: "For growing organizations",
    price: "$29",
    period: "per user/month",
    features: [
      "Everything in Pro",
      "SSO & Google Workspace",
      "Audit logging",
      "Dedicated support",
      "Unlimited storage",
      "Custom integrations",
      "Admin dashboard",
      "Data export (JSON/CSV)",
    ],
    cta: "Contact Us",
    popular: false,
  },
]

export function PricingSection() {
  return (
    <section id="pricing" className="relative border-t border-border/40 py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-chart-4/20 bg-chart-4/5 px-4 py-1.5 text-sm font-medium text-chart-4">
            Pricing
          </div>
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            Simple,{" "}
            <span className="bg-gradient-to-r from-chart-4 to-chart-5 bg-clip-text text-transparent">
              transparent
            </span>{" "}
            pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Start free. Upgrade when your team grows. No hidden fees.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`card-glow relative flex flex-col overflow-hidden rounded-xl border p-6 backdrop-blur-sm ${
                plan.popular
                  ? "border-primary/50 bg-gradient-to-b from-primary/5 to-transparent shadow-lg shadow-primary/5"
                  : "border-border/50 bg-card/30"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute right-4 top-4">
                  Most Popular
                </Badge>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period !== "forever" && (
                    <span className="text-sm text-muted-foreground">/{plan.period}</span>
                  )}
                </div>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-chart-3" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link href="/signup" className="mt-auto">
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
