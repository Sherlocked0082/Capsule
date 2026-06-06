# Capsule

Capsule is a context bridge for AI tools.

It captures the working state from one tool, turns it into a structured brief, stores it in a reusable library, and injects it into another supported tool.

## V1 Goal

Build a usable MVP that proves the full loop:

1. Capture a conversation from a supported AI chat tool.
2. Convert that conversation into a structured brief.
3. Save the brief to a backend.
4. Browse saved briefs in a library.
5. Inject a brief into another supported AI chat tool.

## Product Thesis

AI workflows break when context is trapped inside one tool.

The product solves that by separating context from the chat UI. Instead of treating a conversation as something tied to ChatGPT, Claude, or Gemini, Capsule turns the important parts of that conversation into a portable object that can be reused anywhere.

## Core Concept

The saved object should not just be raw transcript text.

The core object for V1 is a `brief`.

A brief is a structured summary of a conversation state:

- title
- summary
- user intent
- constraints
- key decisions
- technical details
- source metadata
- raw extracted messages

## V1 Scope

### In scope

- Browser extension
- Capture from supported AI chat tools
- Structured brief generation
- Brief library
- Inject into supported AI chat tools
- Manual inject
- Optional auto-submit toggle
- Authentication
- Persistent backend storage

### Out of scope

- Team collaboration
- Attachments
- Gmail capture
- Folder hierarchies
- MCP
- Full semantic search
- Billing
- Public sharing
- Enterprise permissions

## V1 Supported Integrations

### Sources

- ChatGPT
- Claude

### Targets

- ChatGPT
- Claude
- Gemini

### Fallback

If a target site is unsupported or injection fails, the extension should copy the formatted brief to clipboard and prompt the user to paste it manually.

## User Flow

### Capture flow

1. User opens a supported AI chat.
2. Extension detects the site and active conversation.
3. User clicks `Capture`.
4. Content script extracts visible messages and metadata.
5. Extension sends extracted data to backend.
6. Backend generates a structured brief.
7. Brief is saved.
8. User sees success state and can open the brief.

### Reuse flow

1. User opens another supported AI chat tool.
2. User opens Capsule panel.
3. User selects a saved brief.
4. User previews the formatted injection payload.
5. User clicks `Inject`.
6. Extension inserts the brief into the prompt box.
7. User submits manually or enables auto-submit.

## System Architecture

The architecture should be adapter-based.

`source adapters -> universal brief schema -> target adapters`

### Pieces

- Browser extension
- Backend API
- Database
- Brief generation pipeline
- Source adapters
- Target adapters

### Source adapter responsibilities

- detect whether the current site is supported
- identify the active thread
- extract messages
- extract title and source URL
- normalize messages to internal format

### Target adapter responsibilities

- detect prompt input
- insert formatted brief text
- optionally submit
- surface failure when site behavior changes

## Data Model

### Brief

- `id`
- `title`
- `summary`
- `userIntent`
- `constraints`
- `keyDecisions`
- `technicalDetails`
- `sourceTool`
- `sourceUrl`
- `rawMessages`
- `formattedPayload`
- `createdAt`
- `updatedAt`

### Raw message

- `role`
- `content`
- `timestamp` optional

## Brief Generation

V1 can use an LLM-backed transformation step, but the output must be strict and predictable.

The backend should transform raw messages into a structured JSON brief, then render that into the formatted payload used for injection.

### Injection payload shape

The payload should be concise and stateful, for example:

`ACTIVE BRIEF CONTEXT`

- User intent
- Key decisions made
- Constraints or requirements identified
- Technical details

The receiving model does not need the whole transcript if the state is preserved well.

## UX Surfaces

### Extension popup

- current site status
- capture button
- recent briefs
- login state

### Side panel or floating drawer

- brief list
- search input
- selected brief preview
- inject button
- auto-submit toggle

### Web app

- sign in
- brief library
- brief detail view

## Engineering Priorities

1. Reliability of capture
2. Reliability of injection
3. Quality of brief generation
4. Clear preview before sending
5. Fast fallback when automation fails

## Build Order

1. Finalize V1 spec
2. Create repo structure
3. Implement backend and database
4. Implement extension shell
5. Implement ChatGPT source adapter
6. Implement brief generation
7. Implement Claude target adapter
8. Implement library UI
9. Add ChatGPT and Gemini targets
10. Harden failure handling and polish UX

## First Milestone

The first milestone is simple:

- capture from ChatGPT
- generate a brief
- save it
- inject it into Claude

