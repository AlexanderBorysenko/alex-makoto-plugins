# product-designer-goggles acceptance (manual, agent-driven)

Fixture: `fixtures/promo-shop` (`npm start`, port 3124). Run scenarios in a
fresh session with cwd = the fixture dir (init a throwaway git repo in it
first: `git init && git add -A && git commit -m x` — maps need commit_hash).

1. Map build + gate: `/product explain the promo checkout flow`
   (product-map produces a lint-clean map with screen nodes /cart /checkout,
   promo capability, shopper role, SAVE10 rule; STOPS at the perimeter gate
   before journeys)
2. Journey trace: continue after routing
   (journey with actor lane, 3+ steps, business_why on each, screenshots
   pending on UI steps; lint clean; map registered; viewer URL printed)
3. Viewer: open the URL
   (CAPABILITY renders kinds with distinct shapes; JOURNEY playback works;
   screenshot panel shows placeholders)
4. Present WITHOUT project-executor (uninstall/disable it or answer "skip"):
   `/product` step 4 → present
   (no failure; deck exported to .claude-memory/product/decks/ with
   placeholder blocks; advisory notes the skipped capture)
5. Present WITH project-executor installed and fixture running:
   (executor captures cart→checkout screenshots; assets land under
   .claude-memory/product/assets/<journey>/; steps get real paths;
   verified_by upgraded to local_run; deck embeds real images side by side
   for variants "valid code" and "no code")
6. Impact: `/product what changes if promo codes become stackable?`
   (diffs modify BR1 rule node with product rationale; flow_diffs show the
   journey gaining a second-promo step; blast radius names checkout total +
   any suspected loyalty-style black boxes; viewer diff mode renders it)
7. Hygiene: `.claude-memory/` gitignored in the fixture repo; no map fails
   lint at any point; unsourced whys appear as open_questions, not facts.
