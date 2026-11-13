// The live half of the avatar.
//
// A visitor's browser opens a WebSocket to /talk and sends a question. This Worker asks Boson's realtime model for a
// spoken answer in the cloned voice, sends the words to the browser as they come, then has Boson lip-sync the portrait
// to that audio and passes the video through as it renders.
//
// Why it is a Worker and not a call from the page: the Boson key, the voice id and the instructions never leave this
// file's side of the connection. The browser can send one thing, a question. It cannot choose the voice, the
// instructions or the text that is spoken, so the cloned voice only ever says what the model answered under rules.md.
import { RATE, allowedOrigin, base64, cleanQuestion, concat, dailySeconds, plausibleSpeech, quietCut, standsAlone, storeName, unbase64, userTurn, wav } from "./lib.js";
import RULES from "./rules.md";
import NOTES from "../../tools/avatar/knowledge.md";
import PORTRAIT from "../../tools/avatar/portrait.jpg";

const BOSON = "https://api.boson.ai";
const MAX_SPEECH_S = 45;            // the renderer takes at most 60 s; an answer this long has already broken the rules
const MIN_GAP_MS = 1500;            // between two questions on one connection
// The renderer takes longer to start the more audio it is given, so an answer can be filmed in two parts: its opening
// (cut at the first pause after OPENING_MS) as soon as that has been spoken, and the rest while the opening plays.
// It is off unless SPLIT_ANSWERS is "1": measured on 2026-11-13, Boson slows each render down when two run at once,
// so the video stalled mid-sentence for 1 to 2 s and did not start sooner in the browser. One render plays cleanly.
const OPENING_MS = 2500;
const MIN_REST_MS = 1500;           // a tail shorter than this is not worth a second render
const SESSION_MS = 10 * 60 * 1000;  // a connection is closed after this long
const MAX_STORED_VIDEO = 20 * 1024 * 1024;        // one answer; a KV value may be 25 MB
const MAX_STORE_BYTES = 850 * 1024 * 1024;        // all answers together; the free plan stores 1 GB
const MAX_FILL_BYTES = 600 * 1024 * 1024;         // how much of that the preload may use: the rest is for visitors' own questions

// The notes file is written for people too: only the facts go to the model, not the editing notes around them.
const END = NOTES.indexOf("## Page anchors");
const FACTS = NOTES.slice(NOTES.indexOf("## Who I am"), END < 0 ? NOTES.length : END).trim();
const INSTRUCTIONS = RULES.trim() + "\n\n<notes>\n" + FACTS + "\n</notes>\n";

let portraitUri = null;  // base64 once per isolate
function portrait() {
  if (!portraitUri) portraitUri = "data:image/jpeg;base64," + base64(new Uint8Array(PORTRAIT));
  return portraitUri;
}

const today = () => new Date().toISOString().slice(0, 10);
const int = (v, fallback) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : fallback; };

async function visitorKey(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const data = new TextEncoder().encode(`${env.VISITOR_SALT || "dev"}|${ip}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));  // the address itself is never stored
  return "v:" + today() + ":" + base64(hash.subarray(0, 12));
}

/** Seconds of video left today, for everyone together. */
async function secondsLeft(env) {
  const used = int(await env.USAGE.get("s:" + today()), 0);
  return dailySeconds(env, today()) - used;
}

async function addSeconds(env, seconds) {
  const key = "s:" + today();
  const used = int(await env.USAGE.get(key), 0);  // read then write: two answers at once can undercount by one answer
  await env.USAGE.put(key, String(used + Math.ceil(seconds)), { expirationTtl: 3 * 86400 });
}

async function countAsk(env, key) {
  const n = int(await env.USAGE.get(key), 0) + 1;
  await env.USAGE.put(key, String(n), { expirationTtl: 2 * 86400 });
  return n;
}

// ---------------------------------------------------------------- the answer store
// Every answer to a question that stands on its own is kept: the video in ANSWERS, the words in its metadata. The
// next visitor who asks the same thing gets it at once, it costs nothing, and it still plays when the Boson credit
// has run out. Answers are filed on a shelf. STORE_SHELF names it; change the name to start an empty one (after a
// new voice or portrait, say). After an edit to the notes, the answers it affects are removed one by one instead,
// so the hundreds it does not affect are kept. With no name set, the shelf is a hash of the notes, rules, voice
// and size, and any edit starts a fresh one.
let shelf = null;
async function answerKey(question, env) {
  if (!shelf && env.STORE_SHELF) shelf = String(env.STORE_SHELF).replace(/[^A-Za-z0-9_-]/g, "");
  if (!shelf) {
    const made = new TextEncoder().encode(`${INSTRUCTIONS}|${env.BOSON_VOICE}|${env.VIDEO_SIZE || "640x640"}`);
    shelf = base64(new Uint8Array(await crypto.subtle.digest("SHA-256", made)).subarray(0, 6)).replace(/[+/=]/g, "");
  }
  const name = new TextEncoder().encode(storeName(question));
  const hash = base64(new Uint8Array(await crypto.subtle.digest("SHA-256", name)).subarray(0, 15)).replace(/[+/=]/g, "-");
  return `a:${shelf}:${hash}`;
}

// The model gets a detail wrong in roughly one answer in nine (read on 2026-11-13: 19 of 169). Asked once, that is
// one wrong answer; kept and replayed, it is the same wrong answer to everyone. So a kept answer is served again
// only after it has been read: the key "ok:<shelf>" lists the approved ones (tools/avatar/review_store.py writes
// it). An answer that is kept but not yet approved waits in the store, and the question is answered afresh.
//
// An approval is for the words that were read, not for the question: each entry is "<question hash>.<text hash>".
// If the answer under a question is ever a different one (removed and made again, or remade by the preload), its
// text hash differs and it is unapproved until it has been read too.
let okList = null, okAt = 0;
async function textTag(text) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text))));
  return Array.from(hash.subarray(0, 6), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function approved(env, key, text) {
  if (!okList || Date.now() - okAt > 60000) {
    try {
      const list = await env.ANSWERS.get(`ok:${key.split(":")[1]}`, "json");
      okList = new Set(Array.isArray(list) ? list : []);
    } catch (_) { okList = okList || new Set(); }
    okAt = Date.now();
  }
  return okList.has(`${key.split(":")[2]}.${await textTag(text)}`);
}

async function storedAnswer(env, key) {
  try {
    const hit = await env.ANSWERS.getWithMetadata(key, "arrayBuffer");
    return hit && hit.value && hit.metadata && hit.metadata.text ? { video: new Uint8Array(hit.value), text: hit.metadata.text, seconds: hit.metadata.seconds || 0 } : null;
  } catch (_) { return { failed: true }; }   // not "nothing there": the caller must not write over what it could not read
}

/** Keep an answer. Returns "kept", or why not: "full" (no room within `limit` bytes), "size", "failed". */
async function storeAnswer(env, key, question, spoken, chunks, limit) {
  try {
    const video = concat(chunks);
    if (!video.length || video.length > MAX_STORED_VIDEO) return "size";
    if (!plausibleSpeech(spoken.text, spoken.seconds)) return "stumbled";   // the speech ran long or short for its words
    const used = int(await env.USAGE.get("stored"), 0);
    if (used + video.length > limit) return "full";
    await env.ANSWERS.put(key, video, { metadata: { text: spoken.text.slice(0, 600), seconds: +spoken.seconds.toFixed(2), q: question.slice(0, 120), at: today() } });
    await env.USAGE.put("stored", String(used + video.length));
    return "kept";
  } catch (_) { return "failed"; }   // over the day's writes, or the store is unreachable: the answer was still given
}

/** Remove a kept answer (the preload does this when it hears that one is wrong). */
async function forgetAnswer(env, key) {
  try {
    const hit = await env.ANSWERS.getWithMetadata(key, "arrayBuffer");
    if (!hit || !hit.value) return false;
    await env.ANSWERS.delete(key);
    const used = int(await env.USAGE.get("stored"), 0);
    await env.USAGE.put("stored", String(Math.max(0, used - hit.value.byteLength)));
    return true;
  } catch (_) { return false; }
}

function cors(origin) {
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin", "Cache-Control": "no-store" };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), origin = request.headers.get("Origin");
    if (url.pathname === "/health") {
      const ok = allowedOrigin(origin, env);
      // generates: whether a visitor's question may be answered by the model there and then (see LIVE_FOR_VISITORS)
      const generates = env.LIVE_FOR_VISITORS === "1";
      const live = generates ? !!env.BOSON_API_KEY && !!env.BOSON_VOICE && (await secondsLeft(env)) > 0 : true;
      return Response.json({ ok: true, live, generates }, { headers: ok ? cors(origin) : { "Cache-Control": "no-store" } });
    }
    if (url.pathname !== "/talk") return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    if (!allowedOrigin(origin, env)) return new Response("Forbidden", { status: 403 });
    if (env.LIVE_FOR_VISITORS === "1" && (!env.BOSON_API_KEY || !env.BOSON_VOICE)) return new Response("Not configured", { status: 503 });

    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    server.accept();
    ctx.waitUntil(session(server, request, env));
    return new Response(null, { status: 101, webSocket: client });
  },
};

async function session(socket, request, env) {
  const visitor = await visitorKey(request, env);
  const history = [];
  let boson = null, busy = false, asks = 0, looks = 0, last = 0, open = true;
  let filling = false;   // the owner filling the answer store (tools/avatar/preload.py): the visitor limits do not apply
  const send = (obj) => { if (open) try { socket.send(typeof obj === "string" || obj instanceof Uint8Array ? obj : JSON.stringify(obj)); } catch (_) { open = false; } };
  const closeAll = (code, reason) => {
    open = false;
    try { socket.close(code, reason); } catch (_) {}
    try { boson && boson.close(1000, "done"); } catch (_) {}
  };
  const timer = setTimeout(() => { send({ type: "error", code: "session_over", message: "This session has ended. Reopen it to keep going." }); closeAll(1000, "session over"); }, SESSION_MS);

  socket.addEventListener("close", () => { clearTimeout(timer); closeAll(1000, "bye"); });
  socket.addEventListener("error", () => { clearTimeout(timer); closeAll(1011, "error"); });
  socket.addEventListener("message", (ev) => {
    let msg;
    try { msg = JSON.parse(typeof ev.data === "string" ? ev.data : ""); } catch (_) { return; }
    if (msg && msg.type === "fill") { filling = !!env.PRELOAD_TOKEN && msg.token === env.PRELOAD_TOKEN; send({ type: "fill", ok: filling }); return; }
    if (msg && msg.type === "forget") {   // only while filling: the owner removing an answer that came out wrong
      const q = filling ? cleanQuestion(msg.text) : null;
      if (!q || !standsAlone(q)) { send({ type: "forgot", ok: false }); return; }
      answerKey(q, env).then((key) => forgetAnswer(env, key)).then((ok) => send({ type: "forgot", ok }), () => send({ type: "forgot", ok: false }));
      return;
    }
    if (msg && msg.type === "warm") { connect().catch(() => {}); return; }   // open the voice session ahead of the first question
    if (!msg || msg.type !== "ask") return;   // a question is the only other thing a visitor can send
    handle(msg).catch(() => { busy = false; send({ type: "error", code: "failed", message: "Something went wrong on my side. Try again." }); });
  });
  send({ type: "ready" });

  async function handle(msg) {
    const question = cleanQuestion(msg.text);
    if (!question) return send({ type: "error", code: "bad_question", message: "Ask one question, up to 300 characters." });
    if (busy) return send({ type: "error", code: "busy", message: "I'm still answering the last one." });
    if (!filling && env.LIVE_FOR_VISITORS === "1" && Date.now() - last < MIN_GAP_MS) return send({ type: "error", code: "too_fast", message: "One moment, then ask again." });   // looking an answer up costs nothing, so needs no pause
    const t0 = Date.now();
    // an answer already on the shelf: no model, no render, no cost, so it does not count against any limit
    const alone = standsAlone(question), key = alone ? await answerKey(question, env) : null;
    // a visitor is served a kept answer only if those very words have been approved; the owner filling the store
    // is given whatever is there
    const inStore = key && !(filling && msg.fresh) ? await storedAnswer(env, key) : null;
    const kept = inStore && !inStore.failed && (filling || await approved(env, key, inStore.text)) ? inStore : null;
    if (kept) {
      busy = true;
      try {
        if (!filling) history.push({ q: question, a: kept.text });
        send({ type: "text", delta: kept.text });
        send({ type: "said", text: kept.text, seconds: kept.seconds, kept: true, ms: Date.now() - t0 });
        send({ type: "video", mime: "video/mp4", seconds: kept.seconds, kept: true });
        for (let at = 0; at < kept.video.length && open; at += 65536) send(kept.video.subarray(at, at + 65536));
        send({ type: "video_end" });
        send({ type: "done", kept: true, ms: Date.now() - t0 });
      } finally { busy = false; last = Date.now(); }
      return;
    }
    // Unless LIVE_FOR_VISITORS is "1", the model never answers a visitor: about one answer in nine it makes has a
    // detail wrong, and here it would be said in my voice with nobody having read it. A visitor gets a checked
    // answer or none; with none, the page plays the closest recorded clip instead.
    if (!filling && env.LIVE_FOR_VISITORS !== "1") {
      if (++looks > 80) return send({ type: "limit", message: "That's all for this session." });
      return send({ type: "none" });
    }
    if (!filling) {
      if (++asks > int(env.ASKS_PER_SESSION, 12)) return send({ type: "limit", message: "That's all the live answers for this session." });
      if ((await secondsLeft(env)) <= 0) return send({ type: "limit", message: "The live answers are used up for today." });
      if ((await countAsk(env, visitor)) > int(env.DAILY_ASKS_PER_VISITOR, 25)) return send({ type: "limit", message: "That's all the live answers for today." });
    }
    busy = true; last = Date.now();
    // kept only when nothing came before it in this session (the answer must not lean on an earlier one), and
    // never over an answer already in the store: a visitor cannot replace one, approved or waiting to be read
    const keep = key && !history.length && !inStore ? [] : null;
    try {
      let opening = null;   // the render of the first part, started while the rest is still being spoken
      const spoken = await speak(question, env.SPLIT_ANSWERS === "1" ? (pcm) => { opening = render(pcm); } : null);
      if (!spoken) { if (opening) opening.then((r) => r && r.body && r.body.cancel()).catch(() => {}); return; }
      if (!filling) history.push({ q: question, a: spoken.text });   // while filling the store every question is a first question
      send({ type: "said", text: spoken.text, seconds: +spoken.seconds.toFixed(2), ms: Date.now() - t0 });
      if (!filling) await addSeconds(env, spoken.seconds);
      const whole = await film(spoken, opening, keep);
      send({ type: "done", ms: Date.now() - t0 });
      if (whole && keep) {
        const outcome = await storeAnswer(env, key, question, spoken, keep, filling ? MAX_FILL_BYTES : MAX_STORE_BYTES);
        if (filling) send({ type: "stored", outcome });   // the preload stops when its share of the store is full
      }
    } finally {
      busy = false; last = Date.now();
    }
  }

  /** Open the realtime connection once per session and tell it who it is. */
  async function connect() {
    if (boson) return boson;
    const model = env.REALTIME_MODEL || "higgs-realtime-1.5-preview";
    const resp = await fetch(`${BOSON}/v1/realtime?model=${encodeURIComponent(model)}`, {
      headers: { Upgrade: "websocket", Authorization: `Bearer ${env.BOSON_API_KEY}`, "Sec-WebSocket-Protocol": "realtime" },
    });
    const ws = resp.webSocket;
    if (!ws) throw new Error(`realtime refused: ${resp.status}`);
    ws.accept();
    ws.send(JSON.stringify({
      type: "session.update",
      session: {
        type: "realtime", model, instructions: INSTRUCTIONS, output_modalities: ["audio"], tools: [], tool_choice: "none",
        audio: { output: { format: { type: "audio/pcm", rate: RATE }, voice: env.BOSON_VOICE } }, temperature: 0.3,
      },
    }));
    ws.addEventListener("close", () => { if (boson === ws) boson = null; });
    boson = ws;
    return ws;
  }

  /** One spoken answer: the words go to the visitor as they come; the audio is kept for the lip-sync. */
  async function speak(question, onOpening) {
    let ws;
    try { ws = await connect(); } catch (_) {
      send({ type: "error", code: "unavailable", message: "The live voice isn't reachable right now." });
      return null;
    }
    return new Promise((resolve) => {
      const audio = [];
      let text = "", bytes = 0, settled = false, spokenMs = 0, target = 0, cut = 0;
      // once the audio is 300 ms past the first pause after OPENING_MS, hand the opening over to be filmed
      const tryCut = () => {
        if (cut || !target || !onOpening || bytes < target + RATE * 0.6) return;
        const pcm = concat(audio);
        cut = quietCut(pcm, target);
        if (cut > RATE) onOpening(pcm.subarray(0, cut)); else { cut = 0; onOpening = null; }   // no usable pause: film it whole
      };
      const limit = MAX_SPEECH_S * RATE * 2;
      const finish = (result) => {
        if (settled) return;
        settled = true; clearTimeout(guard);
        ws.removeEventListener("message", onMessage); ws.removeEventListener("close", onClose);
        resolve(result);
      };
      const fail = (code, message) => { send({ type: "error", code, message }); finish(null); };
      const guard = setTimeout(() => fail("timeout", "That took too long. Try again."), 60000);
      const onClose = () => { boson = null; fail("unavailable", "The live voice dropped. Try again."); };
      const onMessage = (ev) => {
        let e;
        try { e = JSON.parse(ev.data); } catch (_) { return; }
        if (e.type === "response.output_audio_transcript.delta" && e.delta) { text += e.delta; send({ type: "text", delta: e.delta }); }
        else if (e.type === "response.output_audio.delta" && e.delta) {
          if (bytes < limit) { const chunk = unbase64(e.delta); audio.push(chunk); bytes += chunk.length; }
          tryCut();
        }
        else if (e.type === "response.output_audio_transcript.length" && e.length_ms > 0) {
          spokenMs += e.length_ms;   // how long the words so far take to say: a pause in the speech falls here
          if (!target && spokenMs >= OPENING_MS) target = Math.floor(spokenMs * RATE / 1000) * 2;
          tryCut();
        }
        else if (e.type === "error") fail("unavailable", "The live voice had a problem. Try again.");
        else if (e.type === "response.done") {
          let pcm = concat(audio);
          if (pcm.length > limit) pcm = pcm.subarray(0, limit);
          if (pcm.length % 2) pcm = pcm.subarray(0, pcm.length - 1);
          const said = text.trim();
          if (!said || pcm.length < RATE) return fail("empty", "I didn't get an answer out. Try again.");
          if (cut && pcm.length - cut < MIN_REST_MS * RATE * 2 / 1000) cut = pcm.length;   // the opening was nearly all of it
          finish({ text: said, pcm, cut: Math.min(cut, pcm.length), seconds: pcm.length / 2 / RATE });
        }
      };
      ws.addEventListener("message", onMessage); ws.addEventListener("close", onClose);
      ws.send(JSON.stringify({
        type: "response.create",
        response: { max_output_tokens: 400, input: [{ type: "message", role: "user", content: [{ type: "input_text", text: userTurn(question, history) }] }] },
      }));
    });
  }

  /** Ask Boson to lip-sync the portrait to this audio. Resolves to the response whose body is the video, or null. */
  async function render(pcm) {
    try {
      const resp = await fetch(`${BOSON}/v1/videos/stream`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.BOSON_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "higgs-avatar", size: env.VIDEO_SIZE || "640x640", ref_image: portrait(), input: "data:audio/wav;base64," + base64(wav(pcm)) }),
      });
      return resp.ok && resp.body ? resp : null;
    } catch (_) { return null; }
  }

  /** Pass one render's video on as it arrives, keeping a copy in `keep` if given. False when the visitor has gone. */
  async function pipe(resp, keep) {
    const reader = resp.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return true;
      if (!open) { try { await reader.cancel(); } catch (_) {} return false; }
      if (value && value.length) { send(value); if (keep) keep.push(value); }
    }
  }

  /** The visitor still gets the voice, over the still photo, when the face cannot be rendered. */
  function voiceOnly(pcm) {
    const audio = wav(pcm);
    send({ type: "audio", mime: "audio/wav", bytes: audio.length });
    send(audio);
    send({ type: "audio_end" });
  }

  /**
   * Send the lip-synced video. `opening` is the render of the first part, already under way, or null when the
   * answer is filmed whole. The rest is asked for now and waits here until the opening has gone out, so the
   * browser gets one video after the other and plays them as one. True when one whole video went out (and into
   * `keep`); an answer filmed in two parts is not kept, as the parts are two files.
   */
  async function film(spoken, opening, keep) {
    const split = opening && spoken.cut > 0 && spoken.cut < spoken.pcm.length;
    const rest = split ? render(spoken.pcm.subarray(spoken.cut)) : null;
    const first = await (opening && spoken.cut > 0 ? opening : render(spoken.pcm));
    if (!first) {
      if (rest) rest.then((r) => r && r.body.cancel()).catch(() => {});
      voiceOnly(spoken.pcm);
      return false;
    }
    send({ type: "video", mime: "video/mp4", seconds: +spoken.seconds.toFixed(2), parts: split ? 2 : 1 });
    if (!(await pipe(first, split ? null : keep))) { if (rest) rest.then((r) => r && r.body.cancel()).catch(() => {}); return false; }
    if (split) {
      const second = await rest;
      if (second) {
        send({ type: "video_cut" });
        if (!(await pipe(second))) return false;
      } else {
        send({ type: "video_end", partial: true });   // the face stops here; the words are all on the page
        return false;
      }
    }
    send({ type: "video_end" });
    return !split;
  }
}
