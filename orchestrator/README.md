# orchestrator

Bundle orchestrator and index for the alex-makoto plugin suite. Install this alongside the other plugins and every session starts with a routing map: which plugin handles which job, how they hand off to each other, and what takes precedence.

## What it does

A single `SessionStart` hook (`hooks/build-index.js`) emits two blocks into session context:

1. **Generated routing table** — discovered live at hook time, so new or renamed plugins show up with zero edits here:
   - In a repo checkout: walks up to `.claude-plugin/marketplace.json` and reads each plugin's `plugin.json` + `commands/`.
   - When installed from the marketplace cache: scans sibling plugin cache dirs instead.
   - If discovery fails, it degrades to rules-only — it never breaks the session.
2. **Authored rules** — [index-rules.md](index-rules.md), the editorial layer a generator can't infer: natural-language triggers per plugin, hub-and-spoke handoffs (tasks-manager is the hub), and precedence.

No commands, no skills, no state, no API cost. Pure context injection.

## Maintaining

- Add/rename a plugin in the marketplace → table updates itself.
- Change how plugins should chain or when they should trigger → edit `index-rules.md`.

## Test locally

```sh
node orchestrator/hooks/build-index.js
```
