# ADR 002: Brief Schema

## Status

Accepted

## Context

Raw conversation transcripts are too large, too noisy, and too tool-specific to be the primary reusable object.

## Decision

Relay will use `brief` as the core reusable object.

## Brief Shape

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

## Why

- makes context portable across tools
- preserves working state without replaying whole transcripts
- gives a predictable payload for injection
- supports future editing, search, and reuse

## Consequences

### Positive
- smaller prompt payloads
- clearer previews
- easier storage and retrieval
- more consistent downstream behavior

### Negative
- requires a transformation step
- quality depends on summarization quality
- some nuance from the original thread can be lost
