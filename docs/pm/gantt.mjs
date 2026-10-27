// Generates docs/pm/gantt.svg (for the slides) and docs/pm/gantt.md (renders on GitHub)
// from the task list below. Edit the data here, then run:  node docs/pm/gantt.mjs
// No dependencies; any Node >= 20 works.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TITLE = "Country Distance Guessing Game: COP4331 Large Project";
const CHART_START = "2026-10-26"; // Monday of the first week shown
const CHART_END = "2026-11-22"; // Sunday of the last week shown
const STATUS_DATE = "2026-10-27"; // the red "status" line; move it forward when you update `done`
const DEADLINE = "Sun Nov 15, 11:59 pm"; // WebCourses due date

const OWNERS = {
  sam: { name: "Sam: PM + Infrastructure", color: "#7c3aed" },
  noah: { name: "Noah: Database + Search", color: "#0891b2" },
  sebastian: { name: "Sebastian: API + Auth", color: "#ea580c" },
  john: { name: "John: Web (React)", color: "#2563eb" },
  arwa: { name: "Arwa: Mobile (Flutter) + API", color: "#db2777" },
  team: { name: "Team milestones", color: "#1e293b" },
};

const PHASES = [
  { name: "P0 Foundations", start: "2026-10-27", end: "2026-10-31", color: "#e2e8f0" },
  { name: "P1 Auth + data", start: "2026-11-01", end: "2026-11-04", color: "#ddd6fe" },
  { name: "P2 Gameplay", start: "2026-11-05", end: "2026-11-08", color: "#bfdbfe" },
  { name: "P3 Finish", start: "2026-11-09", end: "2026-11-11", color: "#bbf7d0" },
  { name: "P4 Docs + submit", start: "2026-11-12", end: "2026-11-15", color: "#fde68a" },
  { name: "Presentations (TBD)", start: "2026-11-16", end: "2026-11-20", color: "#fecaca" },
];

// kind: "task" (default) | "milestone" | "buffer".  done: percent complete, 0-100.
const TASKS = [
  { id: "S1", owner: "sam", name: "Push repo, protect main, issue board", start: "2026-10-27", end: "2026-10-28" },
  { id: "S2", owner: "sam", name: "Droplet, domain, DNS, HTTPS", start: "2026-10-27", end: "2026-10-30" },
  { id: "S3", owner: "sam", name: "nginx + pm2 deploy, deploy.md", start: "2026-10-31", end: "2026-11-02", deps: ["S2"] },
  { id: "S4", owner: "sam", name: "CI on PRs (typecheck/build/test)", start: "2026-11-01", end: "2026-11-03", deps: ["S1"] },
  { id: "S5", owner: "sam", name: "Use case diagram", start: "2026-11-01", end: "2026-11-04" },
  { id: "S6", owner: "sam", name: "Sequence diagram (register/verify)", start: "2026-11-05", end: "2026-11-08", deps: ["B3"] },
  { id: "S7", owner: "sam", name: "Slide deck", start: "2026-11-06", end: "2026-11-13" },
  { id: "S8", owner: "sam", name: "Rehearsals, USB, campus domain check", start: "2026-11-12", end: "2026-11-15", deps: ["M4"] },
  { id: "S9", owner: "sam", name: "Standups, Gantt upkeep, commit checks", start: "2026-10-27", end: "2026-11-15" },

  { id: "N1", owner: "noah", name: "Atlas cluster, app user, allowlist", start: "2026-10-27", end: "2026-10-29" },
  { id: "N2", owner: "noah", name: "Country dataset + seed script", start: "2026-10-30", end: "2026-11-02", deps: ["N1"] },
  { id: "N3", owner: "noah", name: "Data model doc + indexes", start: "2026-10-30", end: "2026-11-03", deps: ["N1"] },
  { id: "N4", owner: "noah", name: "Country search endpoint", start: "2026-11-03", end: "2026-11-05", deps: ["N2"] },
  { id: "N5", owner: "noah", name: "ERD", start: "2026-11-04", end: "2026-11-08", deps: ["N3"] },
  { id: "N6", owner: "noah", name: "OpenAPI spec + SwaggerHub live", start: "2026-11-06", end: "2026-11-10", deps: ["N4"] },
  { id: "N7", owner: "noah", name: "Search integration tests", start: "2026-11-06", end: "2026-11-11", deps: ["N4"] },

  { id: "B1", owner: "sebastian", name: "API contract + shared zod schemas", start: "2026-10-27", end: "2026-10-30" },
  { id: "B2", owner: "sebastian", name: "Email provider + sendMail()", start: "2026-10-31", end: "2026-11-02", deps: ["S2"] },
  { id: "B3", owner: "sebastian", name: "Register, verify, login, JWT", start: "2026-10-31", end: "2026-11-04", deps: ["B1", "N1"] },
  { id: "B4", owner: "sebastian", name: "Forgot / reset password", start: "2026-11-03", end: "2026-11-06", deps: ["B2"] },
  { id: "B5", owner: "sebastian", name: "Game start + guess + scoring", start: "2026-11-05", end: "2026-11-08", deps: ["B3", "N2"] },
  { id: "B6", owner: "sebastian", name: "API tests (Vitest + supertest)", start: "2026-11-09", end: "2026-11-12", deps: ["B5"] },
  { id: "B7", owner: "sebastian", name: "Rate limits, errors, remove demo", start: "2026-11-09", end: "2026-11-11" },

  { id: "J1", owner: "john", name: "Figma web prototype + design tokens", start: "2026-10-27", end: "2026-10-31" },
  { id: "J2", owner: "john", name: "Auth pages + protected routes", start: "2026-11-01", end: "2026-11-05", deps: ["B1", "J1"] },
  { id: "J3", owner: "john", name: "Game page (autocomplete, guesses)", start: "2026-11-06", end: "2026-11-10", deps: ["J2", "N4"] },
  { id: "J4", owner: "john", name: "Leaderboard (paginated) + header", start: "2026-11-09", end: "2026-11-11", deps: ["A3"] },
  { id: "J5", owner: "john", name: "Responsive, a11y, component tests", start: "2026-11-10", end: "2026-11-12" },
  { id: "J6", owner: "john", name: "Activity diagram (game round)", start: "2026-11-09", end: "2026-11-12" },

  { id: "A1", owner: "arwa", name: "Flutter SDK + emulator + scaffold", start: "2026-10-27", end: "2026-10-30" },
  { id: "A2", owner: "arwa", name: "Figma mobile prototype", start: "2026-10-28", end: "2026-11-01" },
  { id: "A3", owner: "arwa", name: "API: /users/me + /leaderboard", start: "2026-11-05", end: "2026-11-08", deps: ["B3", "N3"] },
  { id: "A4", owner: "arwa", name: "Mobile auth screens + token storage", start: "2026-10-31", end: "2026-11-05", deps: ["A1", "B1"] },
  { id: "A5", owner: "arwa", name: "Mobile game screen", start: "2026-11-06", end: "2026-11-10", deps: ["A4", "N4"] },
  { id: "A6", owner: "arwa", name: "Mobile leaderboard + class diagram", start: "2026-11-09", end: "2026-11-12", deps: ["A3"] },
  { id: "A7", owner: "arwa", name: "Widget tests + release APK", start: "2026-11-11", end: "2026-11-13", deps: ["A5"] },

  { id: "M1", owner: "team", name: "M1 Domain live on HTTPS", start: "2026-10-31", kind: "milestone", deps: ["S2"] },
  { id: "M2", owner: "team", name: "M2 Sign-up + email verify live", start: "2026-11-04", kind: "milestone", deps: ["B2", "B3"] },
  { id: "M3", owner: "team", name: "M3 Game API live, mobile login", start: "2026-11-08", kind: "milestone", deps: ["B5", "N4", "A4"] },
  { id: "M4", owner: "team", name: "M4 Feature freeze", start: "2026-11-11", kind: "milestone", deps: ["J3", "J4", "A5"] },
  { id: "M5", owner: "team", name: "M5 Deck, tests, diagrams done", start: "2026-11-13", kind: "milestone", deps: ["S7", "A7"] },
  { id: "M6", owner: "team", name: "M6 All 5 submitted to WebCourses", start: "2026-11-14", kind: "milestone" },
  { id: "M7", owner: "team", name: "DUE 11:59 pm (WebCourses)", start: "2026-11-15", kind: "milestone" },
  { id: "PW", owner: "team", name: "Presentation window (TBD)", start: "2026-11-16", end: "2026-11-20", kind: "buffer" },
];

// ---------- dates ----------

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const toDay = (iso) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
const fromDay = (n) => new Date(n * DAY_MS);
const fmt = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
const fmtRange = (a, b) => {
  if (a === b) return fmt(a);
  const [ma, mb] = [fmt(a).split(" ")[0], fmt(b).split(" ")[0]];
  return ma === mb ? `${fmt(a)}–${fmt(b).split(" ")[1]}` : `${fmt(a)} – ${fmt(b)}`;
};
const endOf = (t) => t.end ?? t.start;
const lengthOf = (t) => toDay(endOf(t)) - toDay(t.start) + 1;

// ---------- validation, so a typo fails loudly instead of drawing nonsense ----------

const ids = new Set(TASKS.map((t) => t.id));
for (const t of TASKS) {
  if (!OWNERS[t.owner]) throw new Error(`${t.id}: unknown owner "${t.owner}"`);
  if (Number.isNaN(toDay(t.start)) || Number.isNaN(toDay(endOf(t)))) throw new Error(`${t.id}: bad date`);
  if (toDay(endOf(t)) < toDay(t.start)) throw new Error(`${t.id}: ends before it starts`);
  if (toDay(t.start) < toDay(CHART_START) || toDay(endOf(t)) > toDay(CHART_END)) {
    throw new Error(`${t.id}: outside ${CHART_START}..${CHART_END}`);
  }
  for (const d of t.deps ?? []) if (!ids.has(d)) throw new Error(`${t.id}: unknown dependency "${d}"`);
}
if (ids.size !== TASKS.length) throw new Error("duplicate task id");

// deps are finish-to-start (a milestone may land on the day its last dep finishes)
const byId = Object.fromEntries(TASKS.map((t) => [t.id, t]));
for (const t of TASKS) {
  for (const d of t.deps ?? []) {
    const slack = toDay(t.start) - toDay(endOf(byId[d]));
    if (slack < (t.kind === "milestone" ? 0 : 1)) console.warn(`warning: ${t.id} starts before ${d} finishes`);
  }
}

// ---------- SVG ----------

const PAD = 24;
const LABEL_W = 300;
const DAY_W = 32;
const ROW_H = 26;
const TITLE_H = 56;
const PHASE_H = 24;
const WEEK_H = 22;
const DATE_H = 20;

const days = toDay(CHART_END) - toDay(CHART_START) + 1;
const x0 = PAD + LABEL_W;
const xOf = (iso) => x0 + (toDay(iso) - toDay(CHART_START)) * DAY_W;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const rows = [];
for (const [key, owner] of Object.entries(OWNERS)) {
  const tasks = TASKS.filter((t) => t.owner === key);
  if (tasks.length === 0) continue;
  rows.push({ owner });
  for (const task of tasks) rows.push({ owner, task });
}

const gridTop = PAD + TITLE_H + PHASE_H + WEEK_H + DATE_H;
const gridBottom = gridTop + rows.length * ROW_H;
const width = x0 + days * DAY_W + PAD;
const height = gridBottom + 64;
const out = [];
const push = (s) => out.push(s);

push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`);
push(`<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#f1f5f9"/><line x1="0" y1="0" x2="0" y2="6" stroke="#94a3b8" stroke-width="2"/></pattern></defs>`);
push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
push(`<text x="${PAD}" y="${PAD + 22}" font-size="20" font-weight="700" fill="#1e293b">${esc(TITLE)}</text>`);
push(`<text x="${PAD}" y="${PAD + 42}" font-size="12" fill="#64748b">Team 18 · ${esc(fmtRange(CHART_START, CHART_END))}, 2026 · due ${esc(DEADLINE)} · status as of ${esc(fmt(STATUS_DATE))}</text>`);

// phase band
const phaseY = PAD + TITLE_H;
for (const p of PHASES) {
  const x = xOf(p.start);
  const w = (toDay(p.end) - toDay(p.start) + 1) * DAY_W;
  push(`<rect x="${x}" y="${phaseY}" width="${w}" height="${PHASE_H - 2}" fill="${p.color}"/>`);
  push(`<text x="${x + w / 2}" y="${phaseY + 15}" font-size="11" font-weight="600" text-anchor="middle" fill="#1e293b">${esc(p.name)}</text>`);
}

// week + date headers, weekend shading, grid lines
const weekY = phaseY + PHASE_H;
const dateY = weekY + WEEK_H;
for (let i = 0; i < days; i++) {
  const d = fromDay(toDay(CHART_START) + i);
  const x = x0 + i * DAY_W;
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) push(`<rect x="${x}" y="${dateY}" width="${DAY_W}" height="${gridBottom - dateY}" fill="#f8fafc"/>`);
  if (dow === 1) {
    push(`<text x="${x + 4}" y="${weekY + 15}" font-size="11" font-weight="600" fill="#334155">Week of ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}</text>`);
    push(`<line x1="${x}" y1="${weekY}" x2="${x}" y2="${gridBottom}" stroke="#cbd5e1"/>`);
  } else {
    push(`<line x1="${x}" y1="${dateY}" x2="${x}" y2="${gridBottom}" stroke="#f1f5f9"/>`);
  }
  push(`<text x="${x + DAY_W / 2}" y="${dateY + 14}" font-size="10" text-anchor="middle" fill="#64748b">${d.getUTCDate()}</text>`);
}
push(`<line x1="${x0}" y1="${dateY + DATE_H}" x2="${width - PAD}" y2="${dateY + DATE_H}" stroke="#cbd5e1"/>`);

// rows
rows.forEach((row, i) => {
  const y = gridTop + i * ROW_H;
  const { owner, task } = row;
  if (!task) {
    push(`<rect x="${PAD}" y="${y + 1}" width="${LABEL_W - 8}" height="${ROW_H - 2}" rx="3" fill="${owner.color}"/>`);
    push(`<text x="${PAD + 10}" y="${y + 17}" font-size="12" font-weight="700" fill="#ffffff">${esc(owner.name)}</text>`);
    push(`<rect x="${x0}" y="${y}" width="${days * DAY_W}" height="${ROW_H}" fill="${owner.color}" fill-opacity="0.06"/>`);
    return;
  }

  push(`<text x="${PAD + 10}" y="${y + 17}" font-size="12" fill="#1e293b"><tspan fill="#94a3b8">${esc(task.id)}</tspan>  ${esc(task.name)}</text>`);
  push(`<line x1="${PAD}" y1="${y + ROW_H}" x2="${width - PAD}" y2="${y + ROW_H}" stroke="#f1f5f9"/>`);

  const x = xOf(task.start);
  const label = fmtRange(task.start, endOf(task));
  if (task.kind === "milestone") {
    const cx = x + DAY_W / 2;
    const cy = y + ROW_H / 2;
    push(`<polygon points="${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}" fill="${owner.color}"/>`);
    push(`<text x="${cx + 13}" y="${y + 17}" font-size="10" fill="#475569">${esc(label)}</text>`);
    return;
  }

  const w = lengthOf(task) * DAY_W - 4;
  const barY = y + 5;
  const barH = ROW_H - 10;
  if (task.kind === "buffer") {
    push(`<rect x="${x + 2}" y="${barY}" width="${w}" height="${barH}" rx="4" fill="url(#hatch)" stroke="#94a3b8"/>`);
  } else {
    const done = Math.max(0, Math.min(100, task.done ?? 0));
    push(`<rect x="${x + 2}" y="${barY}" width="${w}" height="${barH}" rx="4" fill="${owner.color}" fill-opacity="0.28" stroke="${owner.color}"/>`);
    if (done > 0) push(`<rect x="${x + 2}" y="${barY}" width="${(w * done) / 100}" height="${barH}" rx="4" fill="${owner.color}"/>`);
  }
  // date range beside the bar; flip to the left side if it would run off the chart
  const right = x + 2 + w + 6;
  if (right + 70 < width - PAD) {
    push(`<text x="${right}" y="${y + 17}" font-size="10" fill="#475569">${esc(label)}</text>`);
  } else {
    push(`<text x="${x - 4}" y="${y + 17}" font-size="10" text-anchor="end" fill="#475569">${esc(label)}</text>`);
  }
});

// status line
const sx = xOf(STATUS_DATE) + DAY_W / 2;
push(`<line x1="${sx}" y1="${weekY}" x2="${sx}" y2="${gridBottom}" stroke="#dc2626" stroke-width="2" stroke-dasharray="5 3"/>`);

// legend
const ly = gridBottom + 30;
const legend = [
  `<rect x="${x0}" y="${ly - 10}" width="28" height="14" rx="3" fill="#64748b" fill-opacity="0.28" stroke="#64748b"/><text x="${x0 + 36}" y="${ly + 1}" font-size="11" fill="#334155">Planned</text>`,
  `<rect x="${x0 + 110}" y="${ly - 10}" width="28" height="14" rx="3" fill="#64748b"/><text x="${x0 + 146}" y="${ly + 1}" font-size="11" fill="#334155">Completed portion</text>`,
  `<polygon points="${x0 + 284},${ly - 10} ${x0 + 291},${ly - 3} ${x0 + 284},${ly + 4} ${x0 + 277},${ly - 3}" fill="#1e293b"/><text x="${x0 + 299}" y="${ly + 1}" font-size="11" fill="#334155">Milestone</text>`,
  `<rect x="${x0 + 380}" y="${ly - 10}" width="28" height="14" rx="3" fill="url(#hatch)" stroke="#94a3b8"/><text x="${x0 + 416}" y="${ly + 1}" font-size="11" fill="#334155">Buffer / external</text>`,
  `<line x1="${x0 + 530}" y1="${ly - 10}" x2="${x0 + 530}" y2="${ly + 4}" stroke="#dc2626" stroke-width="2" stroke-dasharray="5 3"/><text x="${x0 + 540}" y="${ly + 1}" font-size="11" fill="#334155">Status date</text>`,
];
push(...legend);
push(`<text x="${PAD}" y="${ly + 1}" font-size="11" fill="#64748b">Generated by docs/pm/gantt.mjs</text>`);
push("</svg>");

// ---------- Markdown (Mermaid renders natively on GitHub) ----------

const mermaidName = (s) => s.replace(/:/g, " –").replace(/[;#]/g, " ");
const md = [];
md.push("<!-- Generated by docs/pm/gantt.mjs. Edit that file and re-run it, not this one. -->");
md.push("# Gantt chart", "");
md.push(`Status as of **${fmt(STATUS_DATE)}, 2026**. Regenerate after edits with \`node docs/pm/gantt.mjs\`.`, "");
md.push(`> **Deadline:** ${DEADLINE} on WebCourses. Features freeze Wed Nov 11, the deck and docs are done Fri Nov 13, and`);
md.push("> all five submissions go in Sat Nov 14, which leaves Sunday as the only buffer day. Presentation slots aren't");
md.push("> assigned yet. Once ours is known, update `PW` and the last phase in `gantt.mjs`.", "");
md.push("![Gantt chart](gantt.svg)", "");
md.push("```mermaid", "gantt");
md.push(`  title ${mermaidName(TITLE)}`, "  dateFormat YYYY-MM-DD", "  axisFormat %b %d");
for (const [key, owner] of Object.entries(OWNERS)) {
  const tasks = TASKS.filter((t) => t.owner === key);
  if (tasks.length === 0) continue;
  md.push(`  section ${mermaidName(owner.name)}`);
  for (const t of tasks) {
    const tags = t.kind === "milestone" ? "milestone, " : (t.done ?? 0) >= 100 ? "done, " : "";
    const length = t.kind === "milestone" ? "0d" : `${lengthOf(t)}d`;
    md.push(`    ${mermaidName(t.name)} :${tags}${t.id}, ${t.start}, ${length}`);
  }
}
md.push("```", "");
md.push("## Task table", "");
md.push("| ID | Task | Owner | Start | End | Days | Depends on | Done |");
md.push("|---|---|---|---|---|---|---|---|");
for (const t of TASKS) {
  const owner = OWNERS[t.owner].name.split(":")[0];
  const deps = (t.deps ?? []).join(", ") || "–";
  const done = t.kind === "milestone" ? "◆" : `${t.done ?? 0}%`;
  md.push(`| ${t.id} | ${t.name} | ${owner} | ${fmt(t.start)} | ${fmt(endOf(t))} | ${lengthOf(t)} | ${deps} | ${done} |`);
}
md.push("");
md.push("## Critical path", "");
md.push("Atlas (N1) → countries seeded (N2) → search (N4) → web and mobile game screens (J3, A5) → feature freeze (M4).");
md.push("Game logic (B5) runs alongside. The screens build against the agreed contract and wire up guesses once B5 lands on Nov 8.");
md.push("Domain + HTTPS (S2) gates email sending (B2), which gates live verification (M2). A slip on any of these moves the freeze, so raise it at standup the day it happens.");
md.push("");

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, "gantt.svg"), `${out.join("\n")}\n`);
writeFileSync(join(here, "gantt.md"), md.join("\n"));
console.log(`wrote gantt.svg (${width}x${height}) and gantt.md: ${TASKS.length} tasks`);
