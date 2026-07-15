// PJM map lint — deterministic metric recompute + structural/journey integrity.
// Usage: node lint.mjs <map.json>            (CLI)
//        import { lintMap } from "./lint.mjs" (programmatic)
//
// Design: the LLM never writes metric numbers. They are recomputed here from
// the map itself; mismatches are hard errors.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// Epistemic edges (evidenced_by/refuted_by) are excluded from metrics counting —
// same rule as PCE's CONFIRMED_EDGE_KINDS filter.
const METRICS_EDGE_KINDS = new Set(["uses", "affects", "governed_by", "navigates_to", "suspected_influence"]);

/* ---------- deterministic recompute ---------- */

export function recomputeMetrics(doc) {
  const nodes = doc.nodes || [];
  const edges = (doc.edges || []).filter((e) => METRICS_EDGE_KINDS.has(e.kind));
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

  const out = new Map();
  for (const n of nodes) {
    out.set(n.id, {
      fan_in: fanIn.get(n.id),
      fan_out: fanOut.get(n.id),
      flows_count: flowsCount.get(n.id),
    });
  }
  return out;
}

/* ---------- journey integrity ---------- */

function checkJourneys(doc, mapDir, warnings) {
  const errs = [];
  const nodeById = new Map(doc.nodes.map(n => [n.id, n]));
  for (const flow of doc.flows ?? []) {
    if (flow.actor && !nodeById.has(flow.actor))
      errs.push(`journey ${flow.id}: actor '${flow.actor}' is not a node`);
    else if (flow.actor && nodeById.get(flow.actor).kind !== 'role')
      warnings.push(`journey ${flow.id}: actor '${flow.actor}' is kind '${nodeById.get(flow.actor).kind}', expected 'role'`);
    for (const step of flow.steps ?? []) {
      if (step.screen) {
        const s = nodeById.get(step.screen);
        if (!s) errs.push(`journey ${flow.id} step ${step.seq}: screen '${step.screen}' is not a node`);
        else if (s.kind !== 'screen') errs.push(`journey ${flow.id} step ${step.seq}: '${step.screen}' is kind '${s.kind}', expected 'screen'`);
      }
      if (step.screenshot && step.screenshot !== 'pending') {
        const p = path.resolve(mapDir, step.screenshot);
        if (!fs.existsSync(p)) errs.push(`journey ${flow.id} step ${step.seq}: screenshot missing: ${step.screenshot}`);
      }
    }
  }
  return errs;
}

/* ---------- lint ---------- */

export function lintMap(doc, mapDir = process.cwd()) {
  const errors = [], warnings = [];
  const nodeIds = new Set((doc.nodes || []).map((n) => n.id));
  const edgeIds = new Set((doc.edges || []).map((e) => e.id));
  const displayById = new Map((doc.nodes || []).map((n) => [n.id, n.display_id]));
  const ref = (id) => `${displayById.get(id) || "?"}/${id}`;

  if (!["pjm-0.1", "pjm-0.2"].includes(doc.protocol_version)) errors.push("protocol_version must be 'pjm-0.1' or 'pjm-0.2'");
  if (!doc.meta?.commit_hash) errors.push("meta.commit_hash missing (maps are ephemeral — stamp them)");
  if (!doc.meta?.source_root && !doc.code_snippets)
    warnings.push("meta.source_root missing and no code_snippets — viewer cannot show code for source_refs ('Open in IDE' dead)");

  // Language adherence (contract §11): prose must be in the human's session language.
  // Lint cannot infer it, so it cross-checks a declared meta.session_language against the
  // actual prose script — a Cyrillic-script declaration with zero Cyrillic prose is a hard
  // mismatch (English map authored in a Ukrainian session).
  const lang = (doc.meta?.session_language || "").toLowerCase().slice(0, 2);
  if (!doc.meta?.session_language) {
    warnings.push("meta.session_language absent — set it to the human's session language so prose-language adherence can be checked (contract §11)");
  } else {
    const prose = (doc.nodes || []).map((n) => n.summary || "")
      .concat((doc.edges || []).map((e) => e.label || ""))
      .concat([doc.meta?.title || "", doc.meta?.task || ""])
      .concat((doc.tours || []).flatMap((t) => (t.steps || []).map((s) => s.md || "")))
      .join(" ");
    const CYRILLIC_LANGS = new Set(["uk", "ru", "be", "bg", "sr", "mk"]);
    if (CYRILLIC_LANGS.has(lang) && prose.trim() && !/[Ѐ-ӿ]/.test(prose))
      errors.push(`prose language: meta.session_language='${doc.meta.session_language}' but no Cyrillic found in any summary/label/tour text — prose must be in the session language (contract §11)`);
  }

  // Perimeter closure + evidence.
  for (const n of doc.nodes || []) {
    if (!n.resolution) errors.push(`node ${ref(n.id)}: no resolution (perimeter closure violated)`);
    if ((n.resolution === "suspected" || n.resolution === "dismissed") && !n.evidence)
      errors.push(`node ${ref(n.id)}: ${n.resolution} without evidence`);
    // source_refs items are "file:line" strings (schema); an object {file,line} renders as
    // [object Object] and breaks showCode — reject at authoring time.
    if (n.source_refs != null) {
      if (!Array.isArray(n.source_refs))
        errors.push(`node ${ref(n.id)}: source_refs must be an array of "file:line" strings`);
      else n.source_refs.forEach((r, i) => {
        if (typeof r !== "string")
          errors.push(`node ${ref(n.id)}: source_refs[${i}] must be a "file:line" string, not ${Array.isArray(r) ? "array" : typeof r} (renders as [object Object] in the viewer)`);
        else if (!/^.+:\d+(-\d+)?$/.test(r))
          errors.push(`node ${ref(n.id)}: source_refs[${i}]='${r}' must match file:lineStart[-lineEnd]`);
      });
    }
  }
  const EDGE_KINDS = new Set(["uses", "affects", "governed_by", "navigates_to", "suspected_influence", "evidenced_by", "refuted_by"]);
  for (const e of doc.edges || []) {
    if (!nodeIds.has(e.from)) errors.push(`edge ${e.display_id || e.id}: from '${e.from}' not a node`);
    if (!nodeIds.has(e.to)) errors.push(`edge ${e.display_id || e.id}: to '${e.to}' not a node`);
    if (!EDGE_KINDS.has(e.kind)) errors.push(`edge ${e.display_id || e.id}: kind '${e.kind}' not in PJM enum`);
    if (e.kind === "suspected_influence" && !e.evidence)
      errors.push(`edge ${e.display_id || e.id}: suspected_influence without evidence`);
  }

  // Flow well-formedness: participants/arrow refs valid; stack balance = soft
  // (async handoffs may legitimately leave calls open — must be explained, not rejected).
  const FLOW_KINDS = new Set(["happy_path", "failure_path", "bug_path", "edge_case", "proposed"]);
  for (const f of doc.flows || []) {
    if (!FLOW_KINDS.has(f.kind)) errors.push(`flow ${f.id}: unknown kind '${f.kind}'`);
    if (f.kind === "bug_path" && doc.meta?.intent === "explain")
      warnings.push(`flow ${f.id}: bug_path under intent=explain — designed failure handling should be failure_path; bug_path asserts an actual defect`);
    for (const p of f.participants || []) {
      if (!nodeIds.has(p)) errors.push(`flow ${f.id}: participants entry '${p}' not a node`);
    }
    let stack = 0;
    const stepArrows = (f.steps || []).flatMap((s) => s.arrows || []);
    for (const a of [...(f.preface || []), ...stepArrows]) {
      if (a.edge && !edgeIds.has(a.edge)) errors.push(`flow ${f.id}: arrow references unknown edge '${a.edge}'`);
      if (!nodeIds.has(a.from)) errors.push(`flow ${f.id}: arrow.from '${a.from}' not a node`);
      if (!nodeIds.has(a.to)) errors.push(`flow ${f.id}: arrow.to '${a.to}' not a node`);
    }
    // Stack balance over STEPS only — preface is context ("how we got here"),
    // its unmatched calls are expected by design.
    for (const a of stepArrows) {
      if (a.type === "call") stack++;
      else if (a.type === "return") stack--;
    }
    if (stack !== 0) warnings.push(`flow ${f.id}: call/return stack unbalanced (${stack > 0 ? "+" : ""}${stack}) — fine only for explained async handoffs`);
  }

  // Journey integrity: screen refs exist and are kind='screen'; screenshots exist on disk.
  errors.push(...checkJourneys(doc, mapDir, warnings));

  // tours: ref integrity
  const flowIds = new Set((doc.flows || []).map(f => f.id));
  const tourIds = new Set();
  for (const t of doc.tours || []) {
    if (!t.id || !t.title || !Array.isArray(t.steps) || t.steps.length === 0) {
      errors.push(`tour ${t.id || "?"}: requires id, title and non-empty steps`);
      continue;
    }
    if (tourIds.has(t.id)) errors.push(`tour ${t.id}: duplicate tour id`);
    tourIds.add(t.id);
    for (const s of t.steps) {
      for (const ref_node_edge of s.focus || []) {
        if (!nodeIds.has(ref_node_edge) && !edgeIds.has(ref_node_edge)) {
          errors.push(`tour ${t.id}: step ${s.seq}: focus ref '${ref_node_edge}' is neither a node nor an edge id`);
        }
      }
      if (s.flow_ref && !flowIds.has(s.flow_ref)) {
        errors.push(`tour ${t.id}: step ${s.seq}: unknown flow_ref '${s.flow_ref}'`);
      }
      if (!s.md) errors.push(`tour ${t.id}: step ${s.seq}: missing md`);
    }
  }

  // Deterministic metrics: LLM-written numbers are hard errors.
  const metrics = recomputeMetrics(doc);
  for (const n of doc.nodes || []) {
    if (!n.metrics) continue;
    const real = metrics.get(n.id);
    for (const key of ["fan_in", "fan_out", "flows_count"]) {
      if (n.metrics[key] !== undefined && n.metrics[key] !== real[key])
        errors.push(`node ${ref(n.id)}: metrics.${key}=${n.metrics[key]} but recomputed=${real[key]} — metrics must be deterministic, never LLM-written`);
    }
  }

  return { errors, warnings, metrics };
}

/* ---------- CLI ---------- */

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const { readFile } = await import("node:fs/promises");
  const src = process.argv[2];
  if (!src) { console.error("usage: node lint.mjs <map.json>"); process.exit(1); }
  const doc = JSON.parse(await readFile(src, "utf8"));
  const mapDir = path.dirname(path.resolve(src));
  const { errors, warnings, metrics } = lintMap(doc, mapDir);
  console.log("deterministic metrics:");
  for (const [id, m] of metrics) {
    const n = doc.nodes.find((x) => x.id === id);
    console.log(`  ${(n.display_id || "").padEnd(4)} ${id.padEnd(18)} fan_in=${m.fan_in} fan_out=${m.fan_out} flows=${m.flows_count}`);
  }
  if (warnings.length) console.log("\nWARNINGS:\n - " + warnings.join("\n - "));
  if (errors.length) { console.error("\nERRORS:\n - " + errors.join("\n - ")); process.exit(2); }
  console.log("\nlint OK");
}
