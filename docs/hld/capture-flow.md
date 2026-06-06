# Relay HLD: Capture Flow

## Capture Sequence

```mermaid
sequenceDiagram
    participant User
    participant Popup as Relay Popup
    participant CS as Content Script
    participant SA as Source Adapter
    participant API as Relay API
    participant BG as Brief Generator
    participant DB as Database

    User->>Popup: Click "Capture"
    Popup->>CS: Request active page extraction
    CS->>SA: Use site-specific extractor
    SA-->>CS: title + sourceUrl + rawMessages
    CS-->>Popup: Normalized capture payload
    Popup->>API: POST /briefs/generate
    API->>BG: Transform raw messages to structured brief
    BG-->>API: brief draft + formattedPayload
    API-->>Popup: Generated brief
    Popup->>API: POST /briefs
    API->>DB: Save brief + raw messages
    DB-->>API: Saved brief
    API-->>Popup: Created brief
    Popup-->>User: Show success + preview
```

## Source Adapter Responsibilities

- detect whether the current site is supported
- identify the active thread
- extract messages
- extract title and source URL
- normalize messages to internal format

## Initial Source Targets

- ChatGPT
- Claude
