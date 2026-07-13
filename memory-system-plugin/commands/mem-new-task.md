---
description: Create a new per-task journal under .claude-memory/tasks/.
argument-hint: <slug-or-description>
---

Invoke the `memory-system` skill and create a new per-task journal.

Arguments: `$ARGUMENTS` (may be a kebab-slug or a free-form description).

Steps:
1. If a description was given (not already a kebab-slug), propose a kebab-slug <=5 words and confirm with the user before creating the file.
2. Create `./.claude-memory/tasks/<slug>.md` using the per-task template defined in the `memory-system` skill (frontmatter + Goal, Related Documents, Key Findings, Decisions, Open Questions, Next Steps).
3. Set frontmatter: `title`, `slug`, `status: open`, `created` and `updated` to today's date, `summary:` (one-line description — ask the user for it or derive from the Goal), `topics: []`.
4. Ask the user for the Goal (1-3 lines) and fill it in.
5. Confirm to the user in 1-2 lines: the new journal path and the next action.
6. From now on in this session, when a spoke plugin (researcher, executor, goggles, superpowers…) produces a document for this task, make sure it carries `task-slug: <slug>` in its frontmatter so `mem-index docs --task <slug>` can link it at wrap-up.
