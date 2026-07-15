#!/usr/bin/env node
// Export PJM journeys as a self-contained HTML deck (screenshots inlined as data URIs).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const mapFile = args.find(a => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
if (!mapFile) { console.error('usage: node export-deck.mjs <map.json> [--out <dir>]'); process.exit(1); }

const mapPath = path.resolve(mapFile);
const mapDir = path.dirname(mapPath);
const outDir = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : mapDir;
const doc = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
if (!['pjm-0.1', 'pjm-0.2'].includes(doc.protocol_version)) { console.error(`not a PJM document: ${doc.protocol_version}`); process.exit(1); }

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nodeById = new Map((doc.nodes ?? []).map(n => [n.id, n]));
const label = id => nodeById.get(id)?.label ?? id;

function shotDataUri(rel) {
  if (!rel || rel === 'pending') return null;
  const p = path.resolve(mapDir, rel);
  if (!fs.existsSync(p)) return null;
  const ext = path.extname(p).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${fs.readFileSync(p).toString('base64')}`;
}

const journeyHtml = (doc.flows ?? []).map(f => {
  const steps = (f.steps ?? []).map(s => {
    const uri = shotDataUri(s.screenshot);
    const shot = uri
      ? `<img src="${uri}" alt="step ${s.seq}">`
      : `<div class="ph">no capture${s.screenshot === 'pending' ? ' (pending)' : ''}</div>`;
    return `<div class="card">
      <div class="shot">${shot}</div>
      <div class="txt">
        <div class="step-no">Step ${s.seq}${s.screen ? ` · ${esc(label(s.screen))}` : ''}</div>
        <div class="expl">${esc(s.explanation)}</div>
        ${s.business_why ? `<div class="why">Why: ${esc(s.business_why)}</div>` : ''}
        ${s.code_ref ? `<div class="ref">${esc(s.code_ref)}</div>` : ''}
      </div>
    </div>`;
  }).join('\n');
  const sub = [f.actor ? `Actor: ${esc(label(f.actor))}` : '', f.goal ? `Goal: ${esc(f.goal)}` : '', f.variant ? `Variant: ${esc(f.variant)}` : '', f.verified_by ? `Verified: ${esc(f.verified_by)}` : '']
    .filter(Boolean).join(' · ');
  return `<section><h2>${esc(f.title)}</h2><div class="sub">${sub}</div>${steps}</section>`;
}).join('\n');

const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(doc.meta?.title ?? 'PJM deck')}</title>
<style>
 body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f5f5f7;color:#1c1c1e}
 header{padding:24px 32px;background:#fff;border-bottom:1px solid #ddd}
 h1{margin:0 0 4px;font-size:22px} .meta{color:#666;font-size:13px}
 section{max-width:960px;margin:32px auto;padding:0 16px}
 h2{font-size:18px;margin:0 0 2px} .sub{color:#666;font-size:13px;margin-bottom:16px}
 .card{display:flex;gap:16px;background:#fff;border:1px solid #ddd;border-radius:10px;padding:16px;margin-bottom:12px}
 .shot{flex:0 0 380px} .shot img{max-width:100%;border:1px solid #ccc;border-radius:6px}
 .ph{width:100%;min-height:120px;display:flex;align-items:center;justify-content:center;background:#eee;border-radius:6px;color:#999;font-size:13px}
 .txt{flex:1} .step-no{font-weight:600;font-size:13px;color:#888;margin-bottom:4px}
 .expl{margin-bottom:6px} .why{font-size:13px;color:#4a5;font-style:italic}
 .ref{font-size:12px;color:#999;font-family:monospace;margin-top:4px}
 @media(max-width:720px){.card{flex-direction:column}.shot{flex:none}}
</style></head><body>
<header><h1>${esc(doc.meta?.title ?? '')}</h1>
<div class="meta">${esc(doc.meta?.task ?? '')} · generated ${esc(doc.meta?.generated_at ?? '')} · commit ${esc(doc.meta?.commit_hash ?? '')}</div></header>
${journeyHtml}
</body></html>`;

fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${path.basename(mapPath, '.json')}-deck.html`);
fs.writeFileSync(outFile, html);
console.log(outFile);
