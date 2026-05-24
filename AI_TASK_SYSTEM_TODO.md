# AI-Powered Task Management TODO

## Goal

Let the user describe what they need to do in plain language, then have the system create a tracked task plan, monitor progress, and remind the user when the overall AI-generated goal is completed.

## Phase 1 - AI Goal to Tasks

- [x] Create a roadmap file for the AI task system.
- [x] Add database fields that link generated tasks back to an AI agent run.
- [x] Build a backend orchestrator that accepts one natural-language goal.
- [x] Use the existing AI assistant/fallback system to turn the goal into structured tasks.
- [x] Create real task records from the generated plan.
- [x] Record the AI run and agent steps for traceability.
- [x] Notify the user when the task plan has been created.
- [x] Notify the user when all tasks for an AI-generated goal are completed.

## Phase 2 - User Experience

- [x] Add an "AI Task Creator" input to the tasks page.
- [x] Let the user choose workspace and project for AI-created tasks.
- [x] Let the user choose due-date style and whether AI should create subtasks.
- [x] Show a preview of generated tasks before saving.
- [x] Show AI-generated goal groups in the tasks page.
- [x] Add a progress indicator for each AI-generated goal.
- [x] Add a quick action to mark generated goal groups complete.

## Phase 3 - Smarter Completion

- [x] Add rules for tasks the AI can complete directly, such as drafting notes or generating summaries.
- [x] Add action handlers for app-native work: create notes, create reminders, summarize documents, and build checklists.
- [x] Add approval gates before destructive or external actions.
- [x] Add a background sweep for due reminders and goal completion reminders.
- [x] Add email or push delivery for completion reminders based on user settings.

## Phase 4 - Safety and Control

- [x] Add rate limiting for AI task creation.
- [x] Add audit logs for every AI-created task and automated completion.
- [x] Add user confirmation for high-risk tasks.
- [x] Add clear labels so users can see which tasks were AI-created.
- [x] Add tests for task creation, access checks, notifications, and completion detection.
