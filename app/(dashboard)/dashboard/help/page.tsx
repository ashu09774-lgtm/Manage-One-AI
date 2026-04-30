"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { 
  Search, 
  BookOpen, 
  MessageCircle, 
  Video, 
  Mail,
  ExternalLink
} from "lucide-react"

const faqs = [
  {
    question: "How do I create a new workspace?",
    answer: "Navigate to the Workspaces page and click the 'New Workspace' button. Enter a name and description for your workspace, then click Create. You can then add tasks and invite team members."
  },
  {
    question: "How does the AI assistant work?",
    answer: "The AI assistant uses advanced language models to help you manage tasks, automate workflows, and provide insights. Simply type your request in the chat interface, and the assistant will help you accomplish your goals."
  },
  {
    question: "Can I invite team members to my workspace?",
    answer: "Yes! Go to the Team page and click 'Invite Member'. Enter their email address and select their role (Admin, Member, or Viewer). They'll receive an invitation email to join your workspace."
  },
  {
    question: "How do I use the Kanban board?",
    answer: "Open any workspace to access its Kanban board. Drag and drop tasks between columns (To Do, In Progress, Review, Done) to update their status. Click the '+' button in any column to add new tasks."
  },
  {
    question: "What integrations are available?",
    answer: "TaskFlow AI integrates with popular tools like Slack, Google Calendar, GitHub, and more. Visit the Settings page to connect your favorite tools and streamline your workflow."
  },
  {
    question: "How do I switch between light and dark mode?",
    answer: "Click the sun/moon icon in the sidebar or header to toggle between themes. You can also set it to follow your system preference in Settings > Appearance."
  },
]

const resources = [
  {
    icon: BookOpen,
    title: "Documentation",
    description: "Comprehensive guides and API reference",
    link: "#"
  },
  {
    icon: Video,
    title: "Video Tutorials",
    description: "Learn with step-by-step video guides",
    link: "#"
  },
  {
    icon: MessageCircle,
    title: "Community Forum",
    description: "Connect with other TaskFlow users",
    link: "#"
  },
  {
    icon: Mail,
    title: "Contact Support",
    description: "Get help from our support team",
    link: "#"
  },
]

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Help Center</h1>
        <p className="text-muted-foreground">
          Find answers and get support
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for help articles..."
              className="pl-12 h-12 text-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <div className="grid gap-4 sm:grid-cols-2">
        {resources.map((resource, index) => (
          <Card key={index} className="transition-colors hover:bg-muted/50">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <resource.icon className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{resource.title}</h3>
                <p className="text-sm text-muted-foreground">{resource.description}</p>
              </div>
              <Button variant="ghost" size="icon">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FAQs */}
      <Card>
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          <CardDescription>
            Quick answers to common questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center sm:flex-row sm:text-left">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <MessageCircle className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold">Still need help?</h3>
            <p className="text-muted-foreground">
              {"Our support team is available 24/7 to assist you"}
            </p>
          </div>
          <Button>Contact Support</Button>
        </CardContent>
      </Card>
    </div>
  )
}
