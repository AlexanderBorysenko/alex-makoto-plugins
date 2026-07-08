# Environment Manifest (template)

Slow-changing, human-confirmed knowledge about this project that is NOT derivable from the codebase.
Agents MUST read this before broad-scan (agent-contract §1.3). Entries referenced from maps via `manifest_ref`.

Format: numbered entries, one fact each, with scope tags.

## Entries

1. [infra][rmq] _(example)_ A standalone "RMQ Behavior Modification Service" forces the queues
   listed in its config into retry mode. RabbitMQ cluster runs an old version (3.7) — quorum
   queues unavailable. Owner: platform team.
2. [patterns] _(example)_ Project convention: all outbound HTTP goes through *Gateway classes in
   `*/gateway/`; anything calling HTTP clients directly is a smell worth flagging.
3. [db] _(example)_ Reporting service reads the `orders` table directly (no API) — schema changes
   to `orders` are cross-team events.

_Add entries as facts get confirmed in PCE sessions (perimeter-scan offers this automatically)._
