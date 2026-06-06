# Relay HLD: System Overview

## 1. System Overview

Relay is a browser-extension-first context bridge for AI tools.

It captures conversation state from a supported source tool, converts that state into a structured `brief`, stores it through the Relay API, and later injects the brief into a supported target tool.

## 2. Core Components

```mermaid
flowchart LR
    U[User] --> P[Extension Popup / Panel]
    U --> S1[ChatGPT / Claude / Gemini]

    P --> CS[Content Script]
    CS --> SA[Source Adapter]
    CS --> TA[Target Adapter]

    SA --> API[Relay API]
    API --> BG[Brief Generation Layer]
    API --> DB[(Database)]

    P --> API
    TA --> S2[Target AI Prompt Box]
```

## 3. Main Responsibility Split

### Extension
- Detect current site
- Extract visible conversation messages
- Send capture payload to Relay API
- List saved briefs
- Preview injection payload
- Inject brief into supported target tool

### Relay API
- Validate capture payload
- Generate structured brief
- Save brief
- List briefs
- Fetch brief by id

### Database
- Persist briefs
- Persist raw extracted messages
- Later persist users, sessions, settings, and adapter metadata

## 4. High-Level Design

```mermaid
flowchart TD
    subgraph Browser["Browser"]
        subgraph Ext["Relay Extension"]
            Popup["Popup / Side Panel"]
            BGScript["Background Script"]
            CS["Content Script"]
            Src["Source Adapters"]
            Tgt["Target Adapters"]
        end

        subgraph Sites["Supported Sites"]
            ChatGPT["ChatGPT"]
            Claude["Claude"]
            Gemini["Gemini"]
        end
    end

    subgraph Backend["Relay Backend"]
        API["API Server"]
        BriefGen["Brief Generation Service"]
        Repo["Brief Repository"]
        DB[("Postgres")]
    end

    Popup --> BGScript
    BGScript --> CS
    CS --> Src
    CS --> Tgt

    Src --> ChatGPT
    Src --> Claude
    Src --> Gemini

    Tgt --> ChatGPT
    Tgt --> Claude
    Tgt --> Gemini

    BGScript --> API
    Popup --> API
    API --> BriefGen
    API --> Repo
    Repo --> DB
```

## 5. API Surface

### Current APIs

- `GET /health`
- `POST /briefs/generate`
- `POST /briefs`
- `GET /briefs`
- `GET /briefs/:id`

### Near-Term APIs

- `PATCH /briefs/:id`
- `DELETE /briefs/:id`
- `POST /captures/preview`
- `POST /inject/preview`

## 6. Data Model

```mermaid
erDiagram
    BRIEF {
        string id
        string title
        string summary
        string userIntent
        string sourceTool
        string sourceUrl
        string formattedPayload
        datetime createdAt
        datetime updatedAt
    }

    RAW_MESSAGE {
        string id
        string briefId
        string role
        text content
        datetime timestamp
    }

    BRIEF ||--o{ RAW_MESSAGE : contains
```

## 7. What Is Real vs Planned

### Implemented now
- monorepo scaffold
- shared brief schema
- API scaffold
- popup shell
- supported-site detection
- Postman collection

### Not implemented yet
- real DOM extraction
- real injection
- persistent DB
- auth
- web library UI
