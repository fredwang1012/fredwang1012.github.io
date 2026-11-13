// Checks the widget's client-side matcher against questions.json, without a browser.
//   node tools/avatar/test_match.mjs            summary and failures
//   node tools/avatar/test_match.mjs -v         every query with its score
// 1. Typed questions (match_cases.json) must land on the expected answer, and the "no_answer" ones must fall back.
//    This is what decides the exit code. The weights in widget.js were tuned on these, so add new cases when a
//    real question goes wrong instead of trusting the pass rate.
// 2. Held-out paraphrases: each recorded phrasing is removed from the index and asked. This is a harder, honest
//    reading of how the matcher copes with wording it has not seen; a miss should fall back, not play another answer.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const verbose = process.argv.includes("-v");
const sandbox = { module: { exports: {} } };
vm.runInNewContext(readFileSync(join(here, "../../app/public/avatar/widget.js"), "utf8"), sandbox);
const M = sandbox.module.exports;

const q = JSON.parse(readFileSync(join(here, "questions.json"), "utf8"));
let answers = {};
try { answers = JSON.parse(readFileSync(join(here, "answers.json"), "utf8")).answers; } catch { /* not written yet */ }
const clips = [
  ...q.fallbacks.map((f) => ({ ...f, kind: "fallback" })),
  ...q.questions.map((x) => ({ ...x, kind: "answer", answer: answers[x.id]?.answer || "" })),
];
const cases = JSON.parse(readFileSync(join(here, "match_cases.json"), "utf8"));
const outcome = (r) => (r.type === "answer" ? r.clip.id : r.type);

// 1. typed questions
const index = M.buildIndex(clips);
let ok = 0, fail = 0;
const report = (good, query, r, want) => {
  if (good) ok++; else fail++;
  if (!good || verbose) console.log(`${good ? "ok  " : "MISS"}  ${JSON.stringify(query)} -> ${outcome(r)} (${r.score.toFixed(2)})${good ? "" : `, want ${want}`}`);
};
for (const c of cases.cases) { const r = M.match(index, c.q); report(outcome(r) === c.want, c.q, r, c.want); }
for (const query of cases.no_answer) { const r = M.match(index, query); report(r.type !== "answer", query, r, "a fallback"); }

// 2. held-out paraphrases
let held = 0, found = 0, wrong = 0;
for (const c of clips.filter((c) => c.kind === "answer")) {
  for (const phrase of [c.question, ...(c.paraphrases || [])]) {
    const rest = clips.map((x) => (x.id !== c.id ? x : {
      ...x, question: phrase === x.question ? x.paraphrases[0] : x.question, paraphrases: x.paraphrases.filter((p) => p !== phrase),
    }));
    const r = M.match(M.buildIndex(rest), phrase);
    held++;
    if (outcome(r) === c.id) found++;
    else {
      if (r.type === "answer") wrong++;
      if (verbose || r.type === "answer") console.log(`held-out  ${JSON.stringify(phrase)} -> ${outcome(r)} (${r.score.toFixed(2)}), want ${c.id}`);
    }
  }
}

console.log(`\ntyped questions: ${ok}/${ok + fail} as expected`);
console.log(`held-out paraphrases: ${found}/${held} found, ${held - found - wrong} fell back, ${wrong} played another answer`);
console.log(`weights ${JSON.stringify(M.W)}`);
process.exitCode = fail ? 1 : 0;
