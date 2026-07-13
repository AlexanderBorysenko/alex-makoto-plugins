---
description: Bootstrap research tooling — .claude-memory/research/ store, graphify index (with approval), Serena activation.
---

Invoke the `researcher` skill and run its **Setup workflow** section:

1. If a legacy `.claude-research/` dir exists and `.claude-memory/research/` does not: offer to migrate (`git mv`/`mv .claude-research .claude-memory/research`) — one store, no duplicates.
2. Create `.claude-memory/research/` (config.md, INDEX.md, findings/) from the plugin templates if missing; ask for project name and domain notes.
3. Ask commit-vs-gitignore for the store and record it.
4. Offer graphify indexing (state token cost, require explicit approval) and Serena activation for whichever the SessionStart status block reported missing.
5. Finish by printing the status block.
