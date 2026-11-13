// Run: node --test live/test
import assert from "node:assert/strict";
import { test } from "node:test";
import { RATE, allowedOrigin, base64, cleanQuestion, concat, quietCut, unbase64, userTurn, wav } from "../src/lib.js";

test("a question is one line of plain text, at most 300 characters", () => {
  assert.equal(cleanQuestion("  what did\n you\tdo? "), "what did you do?");
  assert.equal(cleanQuestion("x".repeat(300)).length, 300);
  for (const bad of ["", "   ", "x".repeat(301), 5, null, undefined, { text: "hi" }, ["hi"]]) assert.equal(cleanQuestion(bad), null);
  assert.equal(cleanQuestion("a\u0000b\u0007c"), "a b c");
});

test("only the listed origins may open a session; localhost only when switched on", () => {
  const env = { ALLOWED_ORIGINS: "https://fredwang1012.github.io, https://example.org" };
  assert.equal(allowedOrigin("https://fredwang1012.github.io", env), true);
  assert.equal(allowedOrigin("https://example.org", env), true);
  for (const o of [null, "", "https://fredwang1012.github.io.evil.com", "http://fredwang1012.github.io", "http://127.0.0.1:4173", "null"]) assert.equal(allowedOrigin(o, env), false);
  assert.equal(allowedOrigin("http://127.0.0.1:4173", { ...env, ALLOW_LOCALHOST: "1" }), true);
  assert.equal(allowedOrigin("http://localhost.evil.com", { ...env, ALLOW_LOCALHOST: "1" }), false);
});

test("the model is given the question, the length rule, and the last two exchanges", () => {
  assert.match(userTurn("What is Talkback?", []), /^What is Talkback\?\n\n\(Reply in one or two short spoken sentences/);
  const turn = userTurn("and your part?", [{ q: "q1", a: "a1" }, { q: "q2", a: "a2" }, { q: "q3", a: "a3" }]);
  assert.ok(!turn.includes("q1") && turn.includes("q2") && turn.includes("a3"));
  assert.match(turn, /The visitor's new question: and your part\?/);
});

test("base64 round-trips bytes of any length", () => {
  const bytes = new Uint8Array(100000).map((_, i) => (i * 31) & 255);
  assert.deepEqual(unbase64(base64(bytes)), bytes);
  assert.equal(base64(new Uint8Array(0)), "");
});

test("a WAV header describes 16-bit mono PCM at the model's rate", () => {
  const pcm = new Uint8Array(RATE * 2), file = wav(pcm), v = new DataView(file.buffer);
  assert.equal(file.length, 44 + pcm.length);
  assert.equal(String.fromCharCode(...file.subarray(0, 4)) + String.fromCharCode(...file.subarray(8, 12)), "RIFFWAVE");
  assert.deepEqual([v.getUint16(22, true), v.getUint32(24, true), v.getUint16(34, true), v.getUint32(40, true)], [1, RATE, 16, pcm.length]);
  assert.deepEqual(concat([new Uint8Array([1, 2]), new Uint8Array(0), new Uint8Array([3])]), new Uint8Array([1, 2, 3]));
});

test("speech is cut in the nearest pause, never mid-word", () => {
  const pcm = new Uint8Array(RATE * 2 * 3), v = new DataView(pcm.buffer);
  for (let i = 0; i < RATE * 3; i++) {
    const t = i / RATE, quiet = t > 1.2 && t < 1.3;
    v.setInt16(i * 2, quiet ? 0 : Math.round(8000 * Math.sin(2 * Math.PI * 220 * t)), true);
  }
  const cut = quietCut(pcm, RATE * 2 * 1.05) / 2 / RATE;
  assert.ok(cut > 1.2 && cut < 1.3, `cut at ${cut}s`);
  assert.equal(quietCut(pcm, RATE * 2 * 1.05) % 2, 0);
  assert.equal(quietCut(new Uint8Array(10), 4) % 2, 0);   // too short to search: still a whole sample
});

import { dailySeconds, standsAlone, storeName } from "../src/lib.js";

test("the answer store files a question by its words, not its punctuation or case", () => {
  assert.equal(storeName("  What is Talkback?? "), "what is talkback");
  assert.equal(storeName("What's your résumé like"), storeName("whats your resume like") === storeName("What's your résumé like") ? storeName("What's your résumé like") : "what s your resume like");
  assert.notEqual(storeName("what is talkback"), storeName("what was talkback"));
});

test("only a question that means the same without what came before is kept", () => {
  for (const q of ["What is Talkback?", "what did you do at BCI", "Where did you study?"]) assert.equal(standsAlone(q), true, q);
  for (const q of ["tell me more", "why is that?", "and then?", "what about it", "hi", "who are", "can you say that again please"]) assert.equal(standsAlone(q), false, q);
});

test("the daily allowance is higher up to and including the boost date, then the usual one", () => {
  const env = { DAILY_SECONDS: "300", BOOST_UNTIL: "2026-11-17", BOOST_DAILY_SECONDS: "6000" };
  assert.equal(dailySeconds(env, "2026-11-13"), 6000);
  assert.equal(dailySeconds(env, "2026-11-17"), 6000);
  assert.equal(dailySeconds(env, "2026-11-18"), 300);
  assert.equal(dailySeconds({ DAILY_SECONDS: "300" }, "2026-11-13"), 300);
  assert.equal(dailySeconds({}, "2026-11-13"), 300);
});
