# claude-plugins

Monorepo of Alex's Claude Code plugins, registered in [.claude-plugin/marketplace.json](.claude-plugin/marketplace.json).

## Git workflow

- **Work on `main`. Do not create separate branches.** All agents and sessions commit directly to `main` unless the user explicitly asks for a branch. Keeping everything on one branch avoids the divergence mess we consolidated on 2026-07-13.
- Commit related changes together with clear messages.
- Do not push to `origin` unless the user asks.
