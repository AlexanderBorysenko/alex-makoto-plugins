// PCE map lint — deterministic metric recompute + advisory/hotspot consistency.
// Usage: node lint.mjs <map.json>            (CLI)
//        import { lintMap } from "./lint.mjs" (register-map.mjs)
//
// Design (agent-contract §7): the LLM never selects hotspots and never writes
// metric numbers. Both are recomputed here from the map itself; mismatches are
// hard errors. change_coupling is the only metric taken on trust (git scan is
// external and optional) — absent means 0.

const CONFIRMED_EDGE_KINDS = new Set(["sync_call", "async_msg", "data_dep"]);

/* ---------- deterministic recompute ---------- */

export function recomputeMetrics(doc) {
  const nodes = doc.nodes || [];
  const edges = (doc.edges || []).filter((e) => CONFIRMED_EDGE_KINDS.has(e.kind));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const fanIn = new Map(), fanOut = new Map();
  for (const n of nodes) { fanIn.set(n.id, 0); fanOut.set(n.id, 0); }
  for (const e of edges) {
    if (byId.has(e.from)) fanOut.set(e.from, fanOut.get(e.from) + 1);
    if (byId.has(e.to)) fanIn.set(e.to, fanIn.get(e.to) + 1);
  }

  // flows_count: node participates in a flow iff it appears in any arrow (preface or steps).
  const flowsCount = new Map(nodes.map((n) => [n.id, 0]));
  for (const f of doc.flows || []) {
    const seen = new Set();
    const arrows = [
      ...(f.preface || []),
      ...(f.steps || []).flatMap((s) => s.arrows || []),
    ];
    for (const a of arrows) { seen.add(a.from); seen.add(a.to); }
    for (const id of seen) if (flowsCount.has(id)) flowsCount.set(id, flowsCount.get(id) + 1);
  }

  // cycle_flag: node is on a directed cycle over confirmed edges (iterative DFS with colors).
  const adj = new Map(nodes.map((n) => [n.id, []]));
  for (const e of edges) if (adj.has(e.from) && adj.has(e.to)) adj.get(e.from).push(e.to);
  const onCycle = detectCycleNodes(adj);

  const out = new Map();
  for (const n of nodes) {
    out.set(n.id, {
      fan_in: fanIn.get(n.id),
      fan_out: fanOut.get(n.id),
      flows_count: flowsCount.get(n.id),
      cycle_flag: onCycle.has(n.id) ? 1 : 0,
      change_coupling: n.metrics?.change_coupling ?? 0, // external git scan; trusted if present
    });
  }
  return out;
}

function detectCycleNodes(adj) {
  // Tarjan SCC: any SCC of size >1, or a self-loop, is a cycle.
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [];
  const result = new Set();
  let counter = 0;

  for (const start of adj.keys()) {
    if (index.has(start)) continue;
    // iterative Tarjan
    const work = [[start, 0]];
    while (work.length) {
      const [v, pi] = work[work.length - 1];
      if (pi === 0) {
        index.set(v, counter); low.set(v, counter); counter++;
        stack.push(v); onStack.add(v);
      }
      const neighbors = adj.get(v) || [];
      if (pi < neighbors.length) {
        work[work.length - 1][1]++;
        const w = neighbors[pi];
        if (!index.has(w)) work.push([w, 0]);
        else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
      } else {
        work.pop();
        if (work.length) {
          const [parent] = work[work.length - 1];
          low.set(parent, Math.min(low.get(parent), low.get(v)));
        }
        if (low.get(v) === index.get(v)) {
          const scc = [];
          let w;
          do { w = stack.pop(); onStack.delete(w); scc.push(w); } while (w !== v);
          const selfLoop = scc.length === 1 && (adj.get(v) || []).includes(v);
          if (scc.length > 1 || selfLoop) scc.forEach((id) => result.add(id));
        }
      }
    }
  }
  return result;
}

export function tangleScores(doc, metrics = recomputeMetrics(doc)) {
  // agent-contract §7: 0.35*norm(fan_in*fan_out) + 0.25*norm(flows_count)
  //                    + 0.25*change_coupling + 0.15*cycle_flag
  const vals = [...metrics.values()];
  const maxFan = Math.max(1, ...vals.map((m) => m.fan_in * m.fan_out));
  const maxFlows = Math.max(1, ...vals.map((m) => m.flows_count));
  const scores = new Map();
  for (const [id, m] of metrics) {
    scores.set(id,
      0.35 * ((m.fan_in * m.fan_out) / maxFan) +
      0.25 * (m.flows_count / maxFlows) +
      0.25 * m.change_coupling +
      0.15 * m.cycle_flag);
  }
  return scores;
}

export function hotspotEligible(doc, metrics = recomputeMetrics(doc)) {
  // Eligible = passes absolute floor AND (top-3 by tangle_score OR score > p75).
  // Floor keeps tiny maps from promoting everything; relative part adapts to map size.
  const scores = tangleScores(doc, metrics);
  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const p75 = quantile(sorted.map(([, s]) => s), 0.75);
  const top3 = new Set(sorted.slice(0, 3).map(([id]) => id));

  const eligible = new Set();
  for (const [id, m] of metrics) {
    const floor = m.fan_in + m.fan_out >= 3 && m.flows_count >= 2;
    if (floor && (top3.has(id) || scores.get(id) > p75)) eligible.add(id);
  }
  return { eligible, scores };
}

function quantile(values, q) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/* ---------- lint ---------- */

export function lintMap(doc) {
  const errors = [], warnings = [];
  const nodeIds = new Set((doc.nodes || []).map((n) => n.id));
  const edgeIds = new Set((doc.edges || []).map((e) => e.id));
  const displayById = new Map((doc.nodes || []).map((n) => [n.id, n.display_id]));
  const ref = (id) => `${displayById.get(id) || "?"}/${id}`;

  if (doc.protocol_version !== "0.4") errors.push("protocol_version must be '0.4'");
  if (!doc.meta?.commit_hash) errors.push("meta.commit_hash missing (maps are ephemeral — stamp them)");
  if (!doc.meta?.source_root && !doc.code_snippets)
    warnings.push("meta.source_root missing and no code_snippets — viewer cannot show code for source_refs ('Open in IDE' dead; contract §8)");

  // Perimeter closure + evidence (contract §2/§3).
  for (const n of doc.nodes || []) {
    if (!n.resolution) errors.push(`node ${ref(n.id)}: no resolution (perimeter closure violated)`);
    if ((n.resolution === "suspected" || n.resolution === "dismissed") && !n.evidence)
      errors.push(`node ${ref(n.id)}: ${n.resolution} without evidence (contract §2)`);
  }
  for (const e of doc.edges || []) {
    if (!nodeIds.has(e.from)) errors.push(`edge ${e.display_id || e.id}: from '${e.from}' not a node`);
    if (!nodeIds.has(e.to)) errors.push(`edge ${e.display_id || e.id}: to '${e.to}' not a node`);
    if (e.kind === "suspected_influence" && !e.evidence)
      errors.push(`edge ${e.display_id || e.id}: suspected_influence without evidence (contract §2)`);
  }

  // Flow well-formedness (contract §5): arrow refs valid; stack balance = soft
  // (async handoffs may legitimately leave calls open — must be explained, not rejected).
  const FLOW_KINDS = new Set(["happy_path", "failure_path", "bug_path", "edge_case", "proposed"]);
  for (const f of doc.flows || []) {
    if (!FLOW_KINDS.has(f.kind)) errors.push(`flow ${f.id}: unknown kind '${f.kind}'`);
    if (f.kind === "bug_path" && doc.meta?.intent === "explain")
      warnings.push(`flow ${f.id}: bug_path under intent=explain — designed failure handling should be failure_path; bug_path asserts an actual defect (contract §9)`);
    let stack = 0;
    const stepArrows = (f.steps || []).flatMap((s) => s.arrows || []);
    for (const a of [...(f.preface || []), ...stepArrows]) {
      if (a.edge && !edgeIds.has(a.edge)) errors.push(`flow ${f.id}: arrow references unknown edge '${a.edge}'`);
      if (!nodeIds.has(a.from)) errors.push(`flow ${f.id}: arrow.from '${a.from}' not a node`);
      if (!nodeIds.has(a.to)) errors.push(`flow ${f.id}: arrow.to '${a.to}' not a node`);
    }
    // Stack balance over STEPS only — preface is context ("how we got here"),
    // its unmatched calls are expected by design (contract §5).
    for (const a of stepArrows) {
      if (a.type === "call") stack++;
      else if (a.type === "return") stack--;
    }
    if (stack !== 0) warnings.push(`flow ${f.id}: call/return stack unbalanced (${stack > 0 ? "+" : ""}${stack}) — fine only for explained async handoffs (contract §5)`);
  }

  // Deterministic metrics: LLM-written numbers are hard errors (contract §7).
  const metrics = recomputeMetrics(doc);
  for (const n of doc.nodes || []) {
    if (!n.metrics) continue;
    const real = metrics.get(n.id);
    for (const key of ["fan_in", "fan_out", "flows_count"]) {
      if (n.metrics[key] !== undefined && n.metrics[key] !== real[key])
        errors.push(`node ${ref(n.id)}: metrics.${key}=${n.metrics[key]} but recomputed=${real[key]} — metrics must be deterministic, never LLM-written (contract §7)`);
    }
  }

  // Hotspot consistency: every advisory hotspot must be in the deterministic eligible set.
  const hotspots = doc.advisory?.hotspots || [];
  if (hotspots.length) {
    const { eligible, scores } = hotspotEligible(doc, metrics);
    for (const h of hotspots) {
      // hotspots reference nodes by display_id or id — resolve both.
      const node = (doc.nodes || []).find((n) => n.id === h.node || n.display_id === h.node);
      if (!node) { errors.push(`hotspot '${h.node}': references unknown node`); continue; }
      if (!eligible.has(node.id)) {
        const m = metrics.get(node.id);
        errors.push(
          `hotspot '${h.node}' (${node.label}): not in deterministic eligible set ` +
          `(fan_in=${m.fan_in}, fan_out=${m.fan_out}, flows=${m.flows_count}, tangle=${scores.get(node.id).toFixed(2)}) — ` +
          `hotspots are selected by metrics, not nominated by the LLM (contract §7). ` +
          `Perf/logic observations belong in advisory.notes[].`
        );
      }
    }
  }

  return { errors, warnings, metrics };
}

/* ---------- CLI ---------- */

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === (await import("node:path")).resolve(process.argv[1])) {
  const { readFile } = await import("node:fs/promises");
  const src = process.argv[2];
  if (!src) { console.error("usage: node lint.mjs <map.json>"); process.exit(1); }
  const doc = JSON.parse(await readFile(src, "utf8"));
  const { errors, warnings, metrics } = lintMap(doc);
  const { eligible, scores } = hotspotEligible(doc, metrics);
  console.log("deterministic metrics:");
  for (const [id, m] of metrics) {
    const n = doc.nodes.find((x) => x.id === id);
    console.log(`  ${(n.display_id || "").padEnd(4)} ${id.padEnd(18)} fan_in=${m.fan_in} fan_out=${m.fan_out} flows=${m.flows_count} cycle=${m.cycle_flag} tangle=${scores.get(id).toFixed(2)}${eligible.has(id) ? "  << HOTSPOT-ELIGIBLE" : ""}`);
  }
  if (warnings.length) console.log("\nWARNINGS:\n - " + warnings.join("\n - "));
  if (errors.length) { console.error("\nERRORS:\n - " + errors.join("\n - ")); process.exit(2); }
  console.log("\nlint OK");
}
