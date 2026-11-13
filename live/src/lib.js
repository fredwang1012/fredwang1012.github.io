// Pure helpers for the live service: no network and no secrets, so they can be tested on their own.
export const RATE = 24000;         // Hz, 16-bit mono PCM from the realtime model
export const MAX_QUESTION = 300;   // characters

export function base64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function unbase64(text) {
  const s = atob(text), out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** A WAV file around 16-bit mono PCM. */
export function wav(pcm, rate = RATE) {
  const out = new Uint8Array(44 + pcm.length), v = new DataView(out.buffer);
  const tag = (at, s) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  tag(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); tag(8, "WAVE"); tag(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  tag(36, "data"); v.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

export function concat(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/** A question as the visitor may send it: one line of plain text, or null when it is not usable. */
export function cleanQuestion(value) {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return text && text.length <= MAX_QUESTION ? text : null;
}

/** What the model is given: the question, with the last exchanges before it so "tell me more" has something to refer to. */
export function userTurn(question, history) {
  // the length rule again, next to the question: the model keeps to it far better when it is the last thing it reads
  const brief = "\n\n(Reply in one or two short spoken sentences, 30 words at most, using only the notes.)";
  if (!history.length) return question + brief;
  const past = history.slice(-2).map((h) => `Visitor asked: ${h.q}\nYou answered: ${h.a}`).join("\n");
  return `Earlier in this conversation:\n${past}\n\nThe visitor's new question: ${question}${brief}`;
}

/**
 * Where to cut speech near `target` (a byte offset into 16-bit mono PCM) so that no word is split: the quietest
 * 40 ms within 300 ms either side of it. Returns an even byte offset.
 */
export function quietCut(pcm, target, rate = RATE) {
  const win = Math.floor(rate * 0.04) * 2, reach = Math.floor(rate * 0.3) * 2, step = Math.floor(rate * 0.01) * 2;
  const from = Math.max(0, target - reach), to = Math.min(pcm.length - win, target + reach);
  if (to <= from) return Math.max(0, Math.min(pcm.length, target)) & ~1;
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let best = target & ~1, quietest = Infinity;
  for (let at = from & ~1; at <= to; at += step) {
    let energy = 0;
    for (let i = at; i < at + win; i += 2) energy += Math.abs(view.getInt16(i, true));
    if (energy < quietest) { quietest = energy; best = at + win / 2; }
  }
  return best & ~1;
}

/**
 * A question as the answer store files it: lower case, no punctuation, single spaces. "What is Talkback?" and
 * "what is talkback" are the same question; a different wording is a different one.
 */
export function storeName(question) {
  return String(question).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const REFERS_BACK = /\b(more|that|it|its|this|these|those|them|they|one|ones|again|else|also|same|then|there|earlier|before|previous|above)\b/;

/**
 * Whether the store's name for a question keeps everything in it that the model would read. The name keeps only
 * a-z and 0-9, so words in any other script, and symbols such as emoji, would vanish from it: a question like
 * "What is Talkback? [an instruction in another script]" would be answered as written but filed under
 * "what is talkback", and that answer then served to everyone who asks the plain question. Such a question is
 * answered afresh every time and never kept. Accented Latin letters are fine: they fold to their base letter.
 */
export function namedInFull(question) {
  const folded = String(question).normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return /^[\x20-\x7e]*$/.test(folded);
}

/**
 * Whether a question's answer can be kept and reused: it must mean the same whatever was said before it ("tell me
 * more" and "why is that?" do not), and its name in the store must lose nothing (see namedInFull).
 */
export function standsAlone(question) {
  const name = storeName(question);
  return namedInFull(question) && name.split(" ").length >= 3 && !REFERS_BACK.test(name);
}

/** The video seconds allowed today: the higher allowance up to and including BOOST_UNTIL (YYYY-MM-DD), then the usual one. */
export function dailySeconds(env, today) {
  const number = (v, fallback) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; };
  const usual = number(env.DAILY_SECONDS, 300);
  return env.BOOST_UNTIL && today <= env.BOOST_UNTIL ? number(env.BOOST_DAILY_SECONDS, usual) : usual;
}

export function allowedOrigin(origin, env) {
  if (!origin) return false;
  const list = String(env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.includes(origin)) return true;
  // local previews of the site while developing; never set in production
  return env.ALLOW_LOCALHOST === "1" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
