# ADR 001: Extension-First Architecture

## Status

Accepted

## Context

Relay exists to move context across AI tools where the pain already happens inside browser-based chat products.

## Decision

Relay will start as a browser-extension-first product, with a backend API behind it.

## Why

- the core workflow begins inside existing AI tools
- context extraction requires page-level integration
- injection requires prompt-box integration
- extension UX is lower-friction than asking users to leave their tool and use a separate app first

## Consequences

### Positive
- strongest wedge into real workflow pain
- shortest path to proving capture and injection
- lets us support multiple AI tools without owning the primary chat surface

### Negative
- site adapters are brittle because DOMs change
- extension permissions and browser runtime constraints add complexity
- testing is more involved than a pure web app
