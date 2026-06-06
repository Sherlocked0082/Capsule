# Relay HLD: Injection Flow

## Injection Sequence

```mermaid
sequenceDiagram
    participant User
    participant Popup as Relay Popup
    participant API as Relay API
    participant CS as Content Script
    participant TA as Target Adapter
    participant Site as Target AI Tool

    User->>Popup: Open saved brief
    Popup->>API: GET /briefs/:id
    API-->>Popup: Brief + formattedPayload
    User->>Popup: Click "Inject"
    Popup->>CS: Inject formattedPayload
    CS->>TA: Use site-specific injector
    TA->>Site: Fill prompt box
    alt auto-submit enabled
        TA->>Site: Trigger submit
    else manual submit
        TA-->>User: Prompt is ready
    end
```

## Target Adapter Responsibilities

- detect prompt input
- insert formatted brief text
- optionally submit
- surface failure when site behavior changes

## Initial Target Sites

- ChatGPT
- Claude
- Gemini

## Fallback

If a target site is unsupported or injection fails:
- copy the formatted payload to clipboard
- prompt the user to paste it manually
