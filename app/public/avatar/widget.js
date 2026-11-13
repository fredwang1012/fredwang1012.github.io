/*! Avatar widget: "an AI version of me"
 * A glass sheet where a visitor asks a question and an AI version of me answers it aloud, lip-synced.
 *
 * Live: when manifest.live.url names the live service (see /live) and it is up, the question goes there. A language
 * model answers from my notes in a clone of my voice; the words arrive first, then the lip-synced video as it renders.
 * Prepared: without the live service, or when it is down or over its daily limit, the question is matched here in
 * the browser to the nearest answer written ahead of time (tools/avatar/bake.py), played as a recorded clip if there
 * is one and shown as text if not. In that mode nothing a visitor types is sent anywhere.
 *
 * This file is loaded only when a visitor first opens the sheet (see the small launcher in index.html).
 */
(function () {
  "use strict";

  // ------------------------------------------------------------------ matcher (pure; also run by tools/avatar/test_match.mjs)
  var STOP = {};
  ("a an the is are was were be been being am do does did done doing you your yours i me my mine we our us he his him " +
    "frederick fred wang to of in on at for with about and or but it its this that these those what which who whom whose how " +
    "why when where can could would should will shall may might must tell give show explain describe please have has had " +
    "having any some so as by from there here im ive youre youve whats hows wheres whos id ill dont didnt doesnt " +
    "get got much many more also just really very thing things kind sort like know want need let lets say said talk " +
    "then than them they their into out up over too not no yes ever still one use used using bit little quick quickly briefly short").split(" ").forEach(function (w) { STOP[w] = 1; });
  // spellings, word forms and near-synonyms folded onto one word
  var SYN = {
    text2sql: ["text", "sql"], texttosql: ["text", "sql"], nl2sql: ["text", "sql"], lipsync: ["lip", "sync"], lipsynced: ["lip", "sync"],
    synced: ["sync"], handsfree: ["hand", "free"], bargein: ["barge"], powerbi: ["power", "bi"], uoft: ["toronto"], utoronto: ["toronto"],
    cv: ["resume"], ta: ["teach", "assistant"], tas: ["teach", "assistant"], teaches: ["teach"], taught: ["teach"], tutor: ["teach"],
    job: ["work"], jobs: ["work"], career: ["work"], employment: ["work"], employer: ["work"], employers: ["work"], company: ["work"],
    companies: ["work"], intern: ["internship"], interned: ["internship"], interning: ["internship"], school: ["university"],
    college: ["university"], uni: ["university"], universities: ["university"], degree: ["education"], degrees: ["education"],
    mail: ["email"], reach: ["contact"], hiring: ["hire"], recruit: ["hire"], recruiting: ["hire"], recruiter: ["hire"],
    ml: ["machine", "learn"], llms: ["llm"], genai: ["llm"], gpt: ["llm"], programming: ["program"], coding: ["program"],
    tech: ["technical"], technology: ["technical"], technologies: ["technical"], pastime: ["hobby"], interests: ["hobby"],
    favorite: ["favourite"], favorites: ["favourite"], honors: ["honour"], honours: ["honour"], grad: ["master"], graduate: ["master"],
    msc: ["master"], masters: ["master"], bsc: ["bachelor"], undergrad: ["bachelor"], undergraduate: ["bachelor"], bachelors: ["bachelor"],
    selfdriving: ["drive"], autonomous: ["drive"], driving: ["drive"], car: ["drive"], cars: ["drive"], vehicle: ["drive"],
    evaluation: ["evaluate"], evaluations: ["evaluate"], eval: ["evaluate"], evals: ["evaluate"], evaluating: ["evaluate"],
    evaluated: ["evaluate"], tested: ["evaluate"], test: ["evaluate"], tests: ["evaluate"], testing: ["evaluate"], measure: ["evaluate"],
    measured: ["evaluate"], benchmark: ["evaluate"], benchmarks: ["evaluate"], accurate: ["accuracy"], results: ["accuracy"],
    result: ["accuracy"], numbers: ["accuracy"], performance: ["accuracy"], interruption: ["interrupt"], interruptions: ["interrupt"],
    interrupting: ["interrupt"], interrupted: ["interrupt"], correction: ["correct"], corrections: ["correct"], corrects: ["correct"],
    corrected: ["correct"], feedback: ["correct"], fix: ["correct"], fixes: ["correct"], animated: ["animate"], animation: ["animate"],
    animating: ["animate"], reranker: ["rerank"], reranking: ["rerank"], rerankers: ["rerank"], spoiled: ["spoiler"], spoil: ["spoiler"],
    spoils: ["spoiler"], spoilers: ["spoiler"], hallucinated: ["hallucinate"], hallucinating: ["hallucinate"],
    hallucination: ["hallucinate"], hallucinations: ["hallucinate"], citation: ["cite"], citations: ["cite"], cited: ["cite"],
    cites: ["cite"], citing: ["cite"], quotes: ["quote"], quoted: ["quote"], optimizer: ["optimize"], optimiser: ["optimize"],
    optimization: ["optimize"], optimisation: ["optimize"], scheduling: ["schedule"], scheduler: ["schedule"], leaking: ["leak"],
    leakage: ["leak"], leaks: ["leak"], forecasting: ["forecast"], forecasts: ["forecast"], prediction: ["forecast"],
    studying: ["study"], studied: ["study"], studies: ["study"], courses: ["course"], classes: ["course"], coursework: ["course"],
    teammates: ["team"], teammate: ["team"], collaborators: ["team"], built: ["build"], made: ["build"], make: ["build"],
    created: ["build"], create: ["build"], developed: ["build"], won: ["win"], winning: ["win"], winner: ["win"],
    available: ["availability"], roles: ["role"], position: ["role"], positions: ["role"], opportunity: ["role"],
    opportunities: ["role"], strongest: ["strength"], strengths: ["strength"], good: ["strength"], best: ["strength"],
    agentic: ["agent"], agents: ["agent"], papers: ["paper"], pdfs: ["pdf"], documents: ["document"], docs: ["document"],
    hello: ["hi"], hey: ["hi"], heya: ["hi"], yo: ["hi"], greetings: ["hi"], howdy: ["hi"], sup: ["hi"]
  };
  var HELLO = { hi: 1, morning: 1, afternoon: 1, evening: 1 };
  function fold(s) {
    s = String(s || "").toLowerCase();
    try { s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, ""); } catch (_) {}
    return s.replace(/[\u2019']s\b/g, "").replace(/[\u2019']/g, "");
  }
  function stem(w) {
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + "y";
    if (w.length > 4 && /ied$/.test(w)) return w.slice(0, -3) + "y";
    if (w.length > 5 && /ing$/.test(w)) return w.slice(0, -3);
    if (w.length > 4 && /ed$/.test(w)) return w.slice(0, -2);
    if (w.length > 4 && /(ch|sh|ss|x)es$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
    return w;
  }
  function plain(s) { return fold(s).replace(/[^a-z0-9]+/g, " ").trim(); }
  // every word kept, each cut to its stem: "what kind of jobs do you want" and "what kind of job do you want" agree
  function stemmed(s) { return plain(s).split(" ").map(stem).join(" "); }
  // content words of a sentence, folded, de-duplicated
  function tokens(s) {
    var out = [], seen = {};
    plain(s).split(" ").forEach(function (w) {
      if (!w) return;
      var list = SYN[w] || (STOP[w] ? [] : (SYN[stem(w)] || [stem(w)]));
      list.forEach(function (t) { if (!STOP[t] && !seen[t]) { seen[t] = 1; out.push(t); } });
    });
    return out;
  }
  // How a typed question is scored against one recorded question:
  //   cos  closeness to its best single phrasing
  //   cov  share of the typed words found in any of its phrasings or keywords
  //   kw   share of the typed words that are its keywords
  // unk scales the weight of typed words that no recorded question uses, so one shared word cannot carry a stray question.
  var W = { cos: 0.3, cov: 0.4, kw: 0.3, unk: 1, threshold: 0.48 };
  function buildIndex(clips) {
    var entries = [], df = {}, vocab = {}, fallback = {}, exact = {}, close = {};
    clips.forEach(function (c) {
      tokens(c.answer).forEach(function (t) { vocab[t] = 1; });
      if (c.kind === "fallback") { fallback[c.role] = c; return; }
      var texts = [c.question].concat(c.paraphrases || []);
      var worded = texts.map(function (t) { return { text: t, tok: tokens(t) }; }).filter(function (p) { return p.tok.length; });
      var phrases = worded.map(function (p) { return p.tok; });
      var kw = {}, bag = {};
      tokens((c.keywords || []).join(" ")).forEach(function (t) { kw[t] = 1; bag[t] = 1; });
      phrases.forEach(function (p) { p.forEach(function (t) { bag[t] = 1; }); });
      Object.keys(bag).forEach(function (t) { df[t] = (df[t] || 0) + 1; vocab[t] = 1; });
      var e = { clip: c, phrases: phrases, texts: worded.map(function (p) { return p.text; }), kw: kw, bag: bag };
      texts.forEach(function (t) {
        var k = plain(t); if (k && !exact[k]) exact[k] = e;
        var c = stemmed(t); if (c && !(c in close)) close[c] = { e: e, text: t }; else if (c && close[c].e !== e) close[c] = null;   // two questions share it: no use
      });
      entries.push(e);
    });
    var n = entries.length, idf = {};
    Object.keys(df).forEach(function (t) { idf[t] = Math.log(1 + n / df[t]); });
    return { entries: entries, idf: idf, top: Math.log(1 + n), vocab: vocab, fallback: fallback, exact: exact, close: close };
  }
  function match(index, query) {
    var q = tokens(query), res = { type: "norecord", clip: null, score: 0, near: [] };
    var same = index.exact[plain(query)];
    if (same) { res.type = "answer"; res.clip = same.clip; res.score = 1; return res; }   // typed exactly as recorded
    var near = index.close && index.close[stemmed(query)];   // or as recorded but for a plural or a tense
    if (near) { res.type = "answer"; res.clip = near.e.clip; res.score = 1; res.phrase = near.text; return res; }
    if (!q.length) { res.type = "greeting"; return res; }
    if (q.some(function (t) { return HELLO[t]; }) && q.every(function (t) { return HELLO[t] || t === "strength"; })) { res.type = "greeting"; return res; }
    if (!q.some(function (t) { return index.vocab[t]; })) { res.type = "offtopic"; return res; }
    function w(t) { var v = index.idf[t] || index.top * W.unk; return v * v; }
    var qn = 0; q.forEach(function (t) { qn += w(t); });
    var scored = index.entries.map(function (e, i) {
      var cos = 0, cov = 0, kw = 0, best = 0;
      e.phrases.forEach(function (p, at) {
        var has = {}, pn = 0, dot = 0;
        p.forEach(function (t) { has[t] = 1; pn += w(t); });
        q.forEach(function (t) { if (has[t]) dot += w(t); });
        var c = dot / Math.sqrt(qn * pn);
        if (c > cos) { cos = c; best = at; }
      });
      q.forEach(function (t) { if (e.bag[t]) cov += w(t); if (e.kw[t]) kw += w(t); });
      return { e: e, i: i, p: best, s: W.cos * cos + W.cov * cov / qn + W.kw * kw / qn };
    }).sort(function (a, b) { return b.s - a.s || a.i - b.i; });
    res.score = scored.length ? scored[0].s : 0;
    res.near = scored.slice(0, 4).filter(function (x) { return x.s > 0.12; }).map(function (x) { return x.e.clip; });
    if (scored.length && scored[0].s >= W.threshold) {
      res.type = "answer"; res.clip = scored[0].e.clip; res.near = res.near.slice(1);
      res.phrase = scored[0].e.texts[scored[0].p] || null;   // the recorded wording closest to what was typed
    }
    return res;
  }
  var Match = { tokens: tokens, buildIndex: buildIndex, match: match, W: W };
  if (typeof module !== "undefined" && module.exports) module.exports = Match;
  if (typeof document === "undefined") return;

  // ------------------------------------------------------------------ the sheet
  var doc = document;
  var me = doc.currentScript, BASE = me && me.src ? me.src.replace(/[^\/]*(?:[?#].*)?$/, "") : "/avatar/";
  var EMAIL = "fredwang1012@gmail.com";
  var NORECORD = "I don\u2019t have that one recorded. My r\u00e9sum\u00e9 and my email are linked right below.";
  var css = [
    "#av{--av-scrim:rgba(18,22,32,.32);--av-shadow:0 30px 80px -20px rgba(10,16,32,.45),0 2px 6px rgba(10,16,32,.12);--av-solid:#f6f6f4;--av-well:rgba(27,27,27,.05)}",
    ":root[data-theme=dark] #av{--av-scrim:rgba(0,0,0,.5);--av-shadow:0 30px 80px -20px rgba(0,0,0,.7),0 2px 6px rgba(0,0,0,.4);--av-solid:#12161f;--av-well:rgba(236,232,223,.06)}",
    // same layer as the résumé viewer: above the nav, just under the liquid pointer
    "#av{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(16px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));background:var(--av-scrim);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .22s ease;font:14px/1.45 var(--sans);color:var(--ink)}",
    "#av[hidden]{display:none}",
    "#av.open{opacity:1}",
    "#av .av-sheet{position:relative;display:flex;flex-direction:column;width:min(840px,100%);max-height:100%;border-radius:16px;overflow:hidden;background:var(--glass-strong);background:color-mix(in srgb,var(--paper) 86%,transparent);-webkit-backdrop-filter:blur(24px) saturate(170%);backdrop-filter:blur(24px) saturate(170%);border:1px solid var(--glass-edge);box-shadow:inset 0 1px 0 var(--glass-hi),var(--av-shadow);transform:translateY(14px) scale(.975);transition:transform .38s cubic-bezier(.2,1.3,.4,1)}",
    "#av.open .av-sheet{transform:none}",
    "#av .av-bar{display:flex;align-items:center;gap:8px;padding:10px 10px 10px 20px;border-bottom:1px solid var(--glass-edge);flex:none}",
    "#av .av-title{flex:1;min-width:0;margin:0;font-family:var(--serif);font-weight:600;font-size:18px;line-height:1.3;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "#av .av-title span{font-weight:400;color:var(--muted)}",
    "#av .av-title:focus{outline:none}",
    "#av .av-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:38px;padding:0 16px;border-radius:999px;border:1px solid var(--glass-edge);background:var(--glass-strong);color:var(--ink);font:500 14px/1 var(--sans);cursor:pointer;white-space:nowrap;box-shadow:inset 0 1px 0 var(--glass-hi)}",
    "#av .av-btn:hover{background:var(--glass)}",
    "#av .av-btn svg{width:16px;height:16px;flex:none}",
    "#av .av-btn.av-icon{width:38px;padding:0}",
    "#av .av-btn.av-primary{background:var(--link);border-color:transparent;color:var(--paper);box-shadow:none}",
    "#av .av-btn.av-primary:hover{background:var(--link-hover)}",
    "#av :focus-visible{outline:2px solid var(--focus);outline-offset:2px}",
    "#av .av-body{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:22px 22px 24px;display:flex;flex-direction:column;gap:20px}",
    "#av .av-stage{display:grid;grid-template-columns:minmax(0,280px) minmax(0,1fr);gap:24px;align-items:start}",
    "#av .av-fig{margin:0;display:flex;flex-direction:column;gap:10px}",
    "#av .av-frame{position:relative;aspect-ratio:1/1;border-radius:6px;overflow:hidden;background:var(--av-well);box-shadow:0 0 0 1px var(--glass-edge)}",
    "#av .av-still,#av video{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;background:transparent}",
    "#av .av-still[hidden],#av video[hidden]{display:none}",
    // the face at rest: faded in once it is actually playing, so a blocked autoplay just leaves the still
    "#av .av-idle{opacity:0;transition:opacity .4s ease;pointer-events:none}#av .av-idle.on{opacity:1}",
    ":root[data-theme=dark] #av .av-still,:root[data-theme=dark] #av video{filter:brightness(.92)}",
    "#av .av-tag{position:absolute;left:8px;top:8px;padding:4px 8px;border-radius:999px;font:500 10.5px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:#fff;background:rgba(14,19,29,.62);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);pointer-events:none}",
    "#av .av-play{position:absolute;inset:0;display:grid;place-items:center;width:100%;height:100%;padding:0;border:0;background:linear-gradient(rgba(14,19,29,0) 55%,rgba(14,19,29,.28));cursor:pointer}",
    "#av .av-play span{display:grid;place-items:center;width:60px;height:60px;border-radius:50%;color:#1b1b1b;background:rgba(255,255,255,.86);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:0 8px 24px -8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.9);transition:transform .2s ease}",
    "#av .av-play:hover span{transform:scale(1.06)}",
    "#av .av-play svg{width:24px;height:24px;margin-left:3px}",
    "#av .av-play[hidden]{display:none}",
    "#av .av-cap{font:13px/1.6 var(--sans);color:var(--muted);margin:0}",
    "#av .av-cap b{color:var(--ink);font-weight:600}",
    "#av .av-talk{display:flex;flex-direction:column;gap:12px;min-width:0}",
    "#av .av-q{margin:0;font:12px/1.5 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);overflow-wrap:anywhere}",
    "#av .av-a{margin:0;font:19px/1.55 var(--serif);color:var(--ink-2);overflow-wrap:anywhere}",
    "#av .av-a span{transition:color .25s ease}",
    "#av .av-a.playing span{color:var(--muted)}",
    "#av .av-a.playing span.on{color:var(--ink)}",
    "#av .av-note{margin:0;font:13px/1.6 var(--sans);color:var(--muted)}",
    "#av .av-note.busy::before{content:'';display:inline-block;width:11px;height:11px;margin-right:8px;vertical-align:-1px;border-radius:50%;border:2px solid var(--glass-edge);border-top-color:var(--link);animation:av-spin .8s linear infinite}",
    "#av .av-form button:disabled{opacity:.55;cursor:default}",
    "#av .av-src{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:baseline;margin:0;font:14px/1.5 var(--sans)}",
    "#av .av-src .k{font:11px/1.5 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}",
    "#av .av-src a,#av .av-src button{font:inherit;color:var(--link);background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1px}",
    "#av .av-src a:hover,#av .av-src button:hover{color:var(--link-hover)}",
    "#av .av-form{display:flex;gap:8px}",
    "#av .av-form input{flex:1;min-width:0;height:44px;padding:0 18px;border-radius:999px;border:1px solid var(--glass-edge);background:var(--glass-strong);color:var(--ink);font:16px/1 var(--sans);box-shadow:inset 0 1px 0 var(--glass-hi)}",
    "#av .av-form input::placeholder{color:var(--muted);opacity:1}",
    "#av .av-form .av-btn{height:44px;padding:0 20px}",
    "#av .av-hint{margin:-10px 0 0;padding-left:18px;font:12.5px/1.5 var(--sans);color:var(--muted)}",
    "#av .av-group{display:flex;flex-direction:column;gap:10px}",
    "#av .av-k{margin:0;font:11px/1.5 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}",
    "#av .av-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;list-style:none}",
    "#av .av-chip{font:13.5px/1.3 var(--sans);color:var(--ink);text-align:left;background:var(--glass-strong);border:1px solid var(--glass-edge);border-radius:999px;padding:9px 14px;cursor:pointer;box-shadow:inset 0 1px 0 var(--glass-hi)}",
    "#av .av-chip:hover{background:var(--wash)}",
    "#av .av-chip[aria-current=true]{color:var(--link);border-color:var(--link)}",
    "#av details{border-top:1px solid var(--glass-edge);padding-top:14px}",
    "#av summary{font:500 14px/1.4 var(--sans);color:var(--ink);cursor:pointer;width:max-content;max-width:100%;border-radius:4px}",
    "#av details[open] summary{margin-bottom:14px}",
    "#av .av-cats{display:flex;flex-direction:column;gap:16px}",
    "#av .av-msg{margin:0;padding:8vh 12px;text-align:center;color:var(--muted);font:15px/1.6 var(--sans)}",
    "#av .av-msg a{color:var(--link)}",
    "#av .av-spin{width:22px;height:22px;margin:0 auto 10px;border-radius:50%;border:2px solid var(--glass-edge);border-top-color:var(--link);animation:av-spin .8s linear infinite}",
    "@keyframes av-spin{to{transform:rotate(360deg)}}",
    "#av .av-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}",
    "@media (max-width:680px){#av .av-stage{grid-template-columns:minmax(0,1fr);gap:16px}#av .av-fig{max-width:300px}#av .av-a{font-size:18px}}",
    "@media (max-width:560px),(max-height:500px) and (pointer:coarse){#av{padding:0}#av .av-sheet{width:100%;height:100%;max-height:none;border-radius:0;border:0;background:var(--av-solid);-webkit-backdrop-filter:none;backdrop-filter:none}#av .av-bar{padding-top:max(10px,env(safe-area-inset-top));padding-left:max(16px,env(safe-area-inset-left));padding-right:max(10px,env(safe-area-inset-right))}#av .av-body{padding:16px max(16px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));gap:18px}#av .av-fig{max-width:240px}}",
    // touch: every control is at least 44px tall
    "@media (pointer:coarse){#av .av-btn{height:44px;min-width:44px}#av .av-btn.av-icon{width:44px}#av .av-chip{min-height:44px;padding:10px 16px}#av summary{padding:10px 0}#av .av-src a,#av .av-src button{padding-block:10px;margin-block:-10px}}",
    "@media (prefers-reduced-motion:reduce){#av,#av .av-sheet,#av .av-a span,#av .av-play span{transition:none}#av .av-spin,#av .av-note.busy::before{animation:none}}",
    // answers link back into the page: keep the heading clear of the fixed nav when the sheet closes
    "h2[id^='p-']{scroll-margin-top:104px}",
    "html.av-lock,html.av-lock body{overflow:hidden}"
  ].join("\n");
  var ICON = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5Z"/></svg>'
  };

  var root = null, body, video, idle, still, playB, qEl, aEl, noteEl, srcEl, nearEl, input, liveEl, closeB, titleEl, hasClips = false;
  var manifest = null, index = null, loading = null, current = null, spans = [], lastFocus = null, chipButtons = [];
  // the live service: on = it answered its health check; ws = the open session; turn = the answer in progress
  // generates = the service lets the model answer a new question there and then; otherwise it only looks answers up
  var live = { url: null, on: false, generates: false, ws: null, opening: null, turn: null, player: null, audio: null };

  function el(tag, cls, text) { var n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function refresh() { if (window.Liquid && window.Liquid.refresh) window.Liquid.refresh(); }
  function announce(msg) { if (!liveEl) return; liveEl.textContent = ""; setTimeout(function () { liveEl.textContent = msg; }, 60); }
  function fallbackClip(role) { return index && (index.fallback[role] || index.fallback.norecord) || null; }

  function build() {
    if (root) return;
    var st = doc.createElement("style"); st.textContent = css; doc.head.appendChild(st);
    root = doc.createElement("div");
    root.id = "av"; root.hidden = true;
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "av-title"); root.setAttribute("aria-describedby", "av-cap");
    root.innerHTML =
      '<div class="av-sheet">' +
        '<div class="av-bar">' +
          '<h2 class="av-title" id="av-title" tabindex="-1">Ask me <span>\u00b7 an AI version of me</span></h2>' +
          '<button type="button" class="av-btn av-icon av-close" data-liquid="snap" aria-label="Close">' + ICON.close + '</button>' +
        '</div>' +
        '<div class="av-body"></div>' +
      '</div>';
    doc.body.appendChild(root);
    body = root.querySelector(".av-body"); closeB = root.querySelector(".av-close"); titleEl = root.querySelector(".av-title");
    closeB.addEventListener("click", close);
    root.addEventListener("mousedown", function (e) { if (e.target === root) close(); });
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      var f = Array.prototype.filter.call(root.querySelectorAll("a[href],button:not([disabled]),input,summary,video[controls]"), function (n) { return n.offsetParent; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function message(html) { body.innerHTML = '<p class="av-msg">' + html + "</p>"; }

  function load() {
    if (manifest) return Promise.resolve(manifest);
    if (loading) return loading;
    loading = fetch(BASE + "manifest.json", { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (m) {
      if (!m || !m.clips || !m.clips.length) throw new Error("empty");
      manifest = m; index = buildIndex(m.clips);
      return m;
    });
    loading.catch(function () { loading = null; });
    return loading;
  }

  function chip(clip) {
    var b = el("button", "av-chip", clip.question);
    b.type = "button"; b.setAttribute("data-liquid", "snap");
    b.addEventListener("click", function () { if (live.on) ask(clip.question); else show(clip, { play: true, asked: clip.question }); });
    chipButtons.push({ b: b, id: clip.id });
    return b;
  }
  function chipList(clips) {
    var ul = el("ul", "av-chips");
    clips.forEach(function (c) { var li = el("li"); li.appendChild(chip(c)); ul.appendChild(li); });
    return ul;
  }

  function render() {
    var answers = manifest.clips.filter(function (c) { return c.kind !== "fallback"; });
    var suggested = answers.filter(function (c) { return c.suggested; });
    if (suggested.length < 3) suggested = answers.slice(0, 8);
    var voice = manifest.voice === "cloned" ? "a clone of my voice" : "a synthetic voice";
    hasClips = manifest.clips.some(function (c) { return c.file; });
    var about = hasClips
      ? "An AI version of me, not a live video: recorded answers written from my r\u00e9sum\u00e9 and project notes, spoken in " + voice + " and lip-synced from one photo."
      : "An AI version of me, not a live chat: answers written ahead of time from my r\u00e9sum\u00e9 and project notes. The video versions are not recorded yet, so for now they are text.";
    chipButtons = [];
    body.innerHTML =
      '<div class="av-stage">' +
        '<figure class="av-fig">' +
          '<div class="av-frame">' +
            '<img class="av-still" alt="" decoding="async">' +
            '<video class="av-idle" muted loop playsinline webkit-playsinline preload="none" disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1"></video>' +
            '<video hidden playsinline webkit-playsinline preload="none" controlslist="nodownload noplaybackrate" disablepictureinpicture aria-label="Video answer from an AI version of Frederick Wang"></video>' +
            '<span class="av-tag" aria-hidden="true">AI version</span>' +
            '<button type="button" class="av-play"><span>' + ICON.play + '</span></button>' +
          '</div>' +
          '<figcaption class="av-cap" id="av-cap"><b>Fig. A</b> <span class="av-about"></span> If it and my r\u00e9sum\u00e9 disagree, the r\u00e9sum\u00e9 is right.</figcaption>' +
        '</figure>' +
        '<div class="av-talk">' +
          '<p class="av-q" id="av-q"></p>' +
          '<p class="av-a" id="av-a"></p>' +
          '<p class="av-note" hidden></p>' +
          '<p class="av-src" hidden></p>' +
          '<div class="av-group av-near" hidden></div>' +
        '</div>' +
      '</div>' +
      '<form class="av-form" novalidate>' +
        '<label class="av-sr" for="av-in">Ask a question about my work or background</label>' +
        '<input id="av-in" type="text" autocomplete="off" autocapitalize="sentences" enterkeyhint="send" maxlength="200" placeholder="Ask about a project, a job, my studies\u2026">' +
        '<button type="submit" class="av-btn av-primary" data-liquid="snap">Ask</button>' +
      '</form>' +
      '<p class="av-hint"></p>' +
      '<div class="av-group av-sugg"><p class="av-k" id="av-sugg-k">Try asking</p></div>' +
      '<p class="av-sr" id="av-live" aria-live="polite"></p>';
    video = body.querySelector("video:not(.av-idle)"); idle = body.querySelector(".av-idle"); still = body.querySelector(".av-still"); playB = body.querySelector(".av-play");
    qEl = body.querySelector(".av-q"); aEl = body.querySelector(".av-a"); noteEl = body.querySelector(".av-note");
    srcEl = body.querySelector(".av-src"); nearEl = body.querySelector(".av-near");
    input = body.querySelector("#av-in"); liveEl = body.querySelector("#av-live");

    aboutPrepared = about; describe();
    var sugg = body.querySelector(".av-sugg"), list = chipList(suggested);
    list.setAttribute("aria-labelledby", "av-sugg-k"); sugg.appendChild(list);
    if (answers.length > suggested.length) {
      var det = el("details"), sum = el("summary", null, "All " + answers.length + " questions"), cats = el("div", "av-cats"), groups = [], by = {};
      sum.setAttribute("data-liquid", "snap");
      answers.forEach(function (c) { var k = c.category || "More"; if (!by[k]) { by[k] = []; groups.push(k); } by[k].push(c); });
      groups.forEach(function (k) { var g = el("div", "av-group"); g.appendChild(el("p", "av-k", k)); g.appendChild(chipList(by[k])); cats.appendChild(g); });
      det.appendChild(sum); det.appendChild(cats);
      det.addEventListener("toggle", refresh);
      body.insertBefore(det, liveEl);
    }

    playB.addEventListener("click", function () { play(); });
    // the still (poster, else the portrait) stays under the video, so a missing or slow clip never leaves an empty frame
    still.addEventListener("error", function () {
      var portrait = manifest.portrait || "/frederick.jpg";
      if (still.getAttribute("src") !== portrait) still.setAttribute("src", portrait); else still.hidden = true;
    });
    video.addEventListener("loadeddata", function () { video.hidden = false; video.controls = true; });
    video.addEventListener("play", function () { video.hidden = false; playB.hidden = true; aEl.classList.add("playing"); mark(); rest(false); });
    video.addEventListener("timeupdate", mark);
    video.addEventListener("ended", function () {
      aEl.classList.remove("playing");
      // back to the face at rest, unless another part or a replay has started in the meantime
      setTimeout(function () {
        if (!video.ended) return;
        video.hidden = true; video.controls = false;
        if (!(live.turn && !live.turn.done) && (current && current.file || live.turn)) playB.hidden = false;
        rest(true);
      }, 150);
    });
    idle.addEventListener("playing", function () { idle.classList.add("on"); });
    rest(true);
    video.addEventListener("loadedmetadata", function () {
      if (video.videoWidth && video.videoHeight) video.parentNode.style.aspectRatio = video.videoWidth + " / " + video.videoHeight;
    });
    video.addEventListener("error", function () {
      if (!video.getAttribute("src")) return;
      // the clip is missing or cannot be played: fall back to the still and the text
      video.hidden = true; video.controls = false; playB.hidden = true; aEl.classList.remove("playing");
      video.parentNode.style.aspectRatio = "";
      note("The video didn\u2019t load here, so this answer is text only.");
      if (current) announce(current.answer);
    });
    body.querySelector("form").addEventListener("submit", function (e) {
      e.preventDefault();
      var text = input.value.replace(/\s+/g, " ").trim();
      if (text) ask(text);
    });
    srcEl.addEventListener("click", follow);
    // someone is about to ask: open the live session now, so the first answer does not wait for it
    input.addEventListener("focus", function () { if (live.on && live.generates) liveOpen().then(function (ws) { try { ws.send('{"type":"warm"}'); } catch (_) {} }, function () {}); });
  }

  function note(text, busy) { noteEl.textContent = text || ""; noteEl.hidden = !text; noteEl.classList.toggle("busy", !!(text && busy)); }

  // what the caption and the line under the box say: it differs when a model is answering live
  var aboutPrepared = "";
  function describe() {
    var a = body && body.querySelector(".av-about"), h = body && body.querySelector(".av-hint");
    if (!a || !h) return;
    if (live.on && live.generates) {
      a.textContent = "An AI version of me, not me on a call: a language model answers from my r\u00e9sum\u00e9 and project notes, in a clone of my voice, lip-synced from one photo. It can get things wrong.";
      h.textContent = "Your question is sent to an AI service (Boson AI) that writes and voices the answer. I don\u2019t keep it.";
    } else if (live.on) {
      a.textContent = "An AI version of me, not me on a call: answers a language model wrote from my r\u00e9sum\u00e9 and project notes, each checked before it was added, in a clone of my voice and lip-synced from one photo.";
      h.textContent = "Your question is sent to my server to find the closest checked answer. It isn\u2019t kept, and no AI model sees it.";
    } else {
      a.textContent = aboutPrepared;
      h.textContent = "Your question is matched to the closest prepared answer, here in your browser. Nothing you type is sent anywhere.";
    }
  }

  // the sentence being spoken, from the cue times in the manifest
  function mark() {
    if (!current || !spans.length) return;
    var t = video.currentTime, cues = current.cues || [], on = 0;
    for (var i = 0; i < cues.length; i++) if (cues[i].t <= t + 0.05) on = i;
    spans.forEach(function (s, i) { s.classList.toggle("on", i === on); });
  }

  // The idle loop plays only while no answer is on screen, and not at all for reduced motion or Save-Data.
  function rest(on) {
    if (!idle || !manifest || !manifest.idle) return;
    var calm = matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator.connection && navigator.connection.saveData);
    if (!on || calm || (root && root.hidden)) { idle.pause(); return; }
    if (!idle.getAttribute("src")) { idle.preload = "auto"; idle.setAttribute("src", BASE + manifest.idle.file + (manifest.idle.key ? "?v=" + manifest.idle.key : "")); }
    idle.muted = true;
    var p = idle.play();
    if (p && p.catch) p.catch(function () { idle.classList.remove("on"); });   // blocked (Low Power Mode): the still stays
  }

  function play() {
    if (live.turn && video.getAttribute("src")) { var lp = video.play(); if (lp && lp.catch) lp.catch(function () { playB.hidden = false; }); return; }
    if (!current || !current.file) return;
    if (!video.getAttribute("src")) video.setAttribute("src", BASE + current.file + (current.key ? "?v=" + current.key : ""));
    var p = video.play();
    if (p && p.catch) p.catch(function () { playB.hidden = false; });   // blocked or interrupted: the play button stays
  }

  // opts.play: start with sound (only ever called from a click or a submitted question)
  // opts.asked: what the visitor asked, shown above the answer
  // opts.near: close questions to offer when there is no recorded answer
  function show(clip, opts) {
    opts = opts || {};
    current = clip;
    video.pause(); video.removeAttribute("src"); video.hidden = true; video.controls = false;
    try { video.load(); } catch (_) {}
    video.parentNode.style.aspectRatio = "";
    still.hidden = false; rest(true);
    still.setAttribute("src", clip && clip.poster ? BASE + clip.poster + (clip.key ? "?v=" + clip.key : "") : (manifest.portrait || "/frederick.jpg"));
    var text = clip ? clip.answer : NORECORD;
    aEl.textContent = ""; aEl.classList.remove("playing"); spans = [];
    var cues = clip && clip.cues && clip.cues.length ? clip.cues : [{ t: 0, text: text }];
    cues.forEach(function (c, i) { if (i) aEl.appendChild(doc.createTextNode(" ")); var s = el("span", null, c.text); spans.push(s); aEl.appendChild(s); });
    qEl.textContent = opts.asked ? "Q \u00b7 " + opts.asked : "";
    qEl.hidden = !opts.asked;
    note("");
    var play1 = clip && clip.kind === "fallback" && clip.role === "greeting" ? "Play greeting" : "Play answer";
    playB.setAttribute("aria-label", play1);
    var hasVideo = !!(clip && clip.file);
    playB.hidden = !hasVideo;
    if (!hasVideo && hasClips) note("There is no video for this one yet, so here it is as text.");
    sources(clip ? clip.sources : [{ label: "R\u00e9sum\u00e9", href: "/resume.pdf" }, { label: "Email me", href: "mailto:" + EMAIL }]);
    nearEl.textContent = ""; nearEl.hidden = true;
    if (opts.near && opts.near.length) {
      nearEl.appendChild(el("p", "av-k", "Closest questions I do have"));
      nearEl.appendChild(chipList(opts.near.slice(0, 3)));
      nearEl.hidden = false;
    }
    chipButtons = chipButtons.filter(function (c) { return root.contains(c.b); });
    chipButtons.forEach(function (c) { if (clip && c.id === clip.id) c.b.setAttribute("aria-current", "true"); else c.b.removeAttribute("aria-current"); });
    if (opts.play) {
      // with a clip the voice carries the answer; without one a screen reader gets the text itself
      if (hasVideo) { play(); announce(opts.intro || "Playing the answer to: " + clip.question + ". The transcript follows."); }
      else announce(text + (opts.near && opts.near.length ? " The closest questions I do have are listed after the answer." : ""));
    }
    var stage = body.querySelector(".av-stage");
    if (opts.play && stage && stage.scrollIntoView) { try { stage.scrollIntoView({ block: "nearest" }); } catch (_) {} }
    refresh();
  }

  function sources(list) {
    srcEl.textContent = "";
    if (!list || !list.length) { srcEl.hidden = true; return; }
    srcEl.appendChild(el("span", "k", "See"));
    list.forEach(function (s) {
      var a;
      if (/resume\.pdf$/i.test(s.href)) { a = el("button", null, s.label); a.type = "button"; a.setAttribute("data-resume", s.href); a.setAttribute("aria-haspopup", "dialog"); }   // not a link, so the r\u00e9sum\u00e9 viewer does not open under this sheet
      else { a = el("a", null, s.label + (/^https?:/.test(s.href) ? " \u2197" : "")); a.href = s.href; if (/^https?:/.test(s.href)) { a.target = "_blank"; a.rel = "noopener"; } }
      a.setAttribute("data-liquid", "snap");
      srcEl.appendChild(a);
    });
    srcEl.hidden = false;
  }

  // links under an answer: page anchors close the sheet and go there; the résumé opens in its own viewer
  function follow(e) {
    var t = e.target.closest && e.target.closest("a,button");
    if (!t || !srcEl.contains(t)) return;
    var resume = t.getAttribute("data-resume"), href = t.getAttribute("href") || "";
    if (resume) {
      e.preventDefault(); lastFocus = null; close();
      if (window.ResumeViewer && window.ResumeViewer.open) window.ResumeViewer.open(resume); else window.open(resume, "_blank", "noopener");
      return;
    }
    if (href.charAt(0) !== "#") return;
    e.preventDefault(); lastFocus = null; close();
    var target = doc.getElementById(href.slice(1));
    if (location.hash === href) { if (target) target.scrollIntoView(); }
    else location.hash = href;
    if (target) { if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1"); setTimeout(function () { try { target.focus({ preventScroll: true }); } catch (_) {} }, 0); }
  }

  // ------------------------------------------------------------------ live answers
  // The address of the live service. A local preview uses a local copy of it (or the address in localStorage.avLive);
  // on the real site only the address in the manifest is ever used.
  function liveUrl() {
    var url = manifest && manifest.live && manifest.live.url || "";
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      url = url || "ws://127.0.0.1:8787/talk";   // `wrangler dev` in /live; nothing happens if it is not running
      try { url = localStorage.getItem("avLive") || url; } catch (_) {}
    }
    return /^wss?:\/\//.test(url) ? url : "";
  }
  function liveCheck() {
    live.url = liveUrl();
    if (!live.url || !window.WebSocket) return;
    fetch(live.url.replace(/^ws/, "http").replace(/\/talk$/, "/health"), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { live.on = !!(j && j.live); live.generates = !!(j && j.generates); describe(); })
      .catch(function () { live.on = false; });
  }
  function liveOpen() {
    if (live.ws && live.ws.readyState === 1) return Promise.resolve(live.ws);
    if (live.opening) return live.opening;
    live.opening = new Promise(function (resolve, reject) {
      var ws = new WebSocket(live.url), ready = false;
      ws.binaryType = "arraybuffer";
      var timer = setTimeout(function () { if (!ready) { try { ws.close(); } catch (_) {} reject(new Error("timeout")); } }, 8000);
      ws.onmessage = function (ev) {
        if (!ready) {
          if (typeof ev.data === "string" && ev.data.indexOf('"ready"') > 0) { ready = true; clearTimeout(timer); live.ws = ws; resolve(ws); }
          return;
        }
        liveMessage(ev.data);
      };
      ws.onclose = function () {
        clearTimeout(timer);
        var mine = live.ws === ws;   // false once liveClose has let this socket go: its turn is no longer the page's
        if (mine) live.ws = null;
        if (!ready) reject(new Error("closed"));
        else if (mine && live.turn && !live.turn.done) liveFail("The live voice dropped.");
      };
      ws.onerror = function () {};
    });
    live.opening.then(function () { live.opening = null; }, function () { live.opening = null; });
    return live.opening;
  }
  function liveClose() {
    if (live.player) { live.player.stop(); live.player = null; }
    if (live.audio) { try { live.audio.pause(); } catch (_) {} live.audio = null; }
    if (live.ws) { try { live.ws.close(); } catch (_) {} live.ws = null; }
    if (live.turn) { clearTimeout(live.turn.guard); clearTimeout(live.turn.opener); }
    live.turn = null; setBusy(false);
  }
  function setBusy(on) {
    var b = body && body.querySelector(".av-form button");
    if (b) b.disabled = !!on;
  }

  // A video that plays while it is still arriving. Chunks wait here until the browser can take them; a browser
  // without MediaSource (older iPhones) gets the whole clip once it has all arrived.
  // seconds: how long the whole answer runs, which the service knows before the first frame is made
  // kept: an answer given before, sent from the service's store; it arrives far faster than it plays
  function streamPlayer(seconds, kept) {
    var MS = window.ManagedMediaSource || window.MediaSource, ms = null, sb = null, url = null;
    var queue = [], all = [], parts = [], head = new Uint8Array(0), mime = null, ended = false, stopped = false, started = false, direct = !MS;
    function codec(bytes) {   // the H.264 profile and level, read from the stream's own header ("avcC")
      for (var i = 0; i + 8 < bytes.length; i++) {
        if (bytes[i] === 0x61 && bytes[i + 1] === 0x76 && bytes[i + 2] === 0x63 && bytes[i + 3] === 0x43) {
          var hex = function (n) { return (n < 16 ? "0" : "") + n.toString(16); };
          return "avc1." + hex(bytes[i + 5]) + hex(bytes[i + 6]) + hex(bytes[i + 7]);
        }
      }
      return null;
    }
    function begin() {
      if (started || stopped) return;
      started = true; video.hidden = false; if (!kept) note("");
      var p = video.play();
      if (p && p.catch) p.catch(function () { playB.setAttribute("aria-label", "Play answer"); playB.hidden = false; });
    }
    // The renderer's speed varies from about half to twice real time. Starting on the first frame would stutter
    // whenever it is the slow half, so playback starts once what has arrived, at the rate it is arriving, is enough
    // to reach the end without stopping.
    var firstAt = 0;
    function ready() {
      if (started || stopped || !sb) return;
      var have = 0;
      try { have = sb.buffered.length ? sb.buffered.end(sb.buffered.length - 1) : 0; } catch (_) {}
      if (!have) return;
      if (!firstAt) firstAt = Date.now();
      var waited = (Date.now() - firstAt) / 1000, rate = waited > 0 ? Math.min(1, have / waited) : 0;
      var total = seconds > 0 ? seconds : have;
      if (kept && have >= 0.5) { begin(); return; }   // nothing is being rendered: there is no slow half to wait out
      if (ended || have >= total - 0.3 || (waited >= 1.5 && have >= Math.max(1.5, total * (1 - rate) * 1.15 + 1))) begin();
    }
    function pump() {
      if (stopped || !sb || sb.updating) return;
      if (queue.length) { try { sb.appendBuffer(queue.shift()); } catch (_) { toDirect(); } return; }
      if (ended && ms.readyState === "open") { try { ms.endOfStream(); } catch (_) {} }
    }
    function toDirect() {   // give up on streaming: play it whole when it has all arrived
      direct = true; sb = null; queue = [];
      if (ended) whole();
    }
    function whole() {   // without streaming: each part is a file of its own, played one after the other
      if (stopped) return;
      parts.push(all); all = [];
      var next = function () {
        var part = parts.shift();
        if (stopped || !part) return;
        if (url) { try { URL.revokeObjectURL(url); } catch (_) {} }
        url = URL.createObjectURL(new Blob(part, { type: "video/mp4" }));
        video.setAttribute("src", url);
        if (!started) begin(); else { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
      };
      video.addEventListener("ended", function onEnd() { if (stopped || !parts.length) { video.removeEventListener("ended", onEnd); return; } next(); });
      next();
    }
    function attach() {
      ms = new MS();
      url = URL.createObjectURL(ms);
      video.disableRemotePlayback = true;   // ManagedMediaSource asks for this
      video.setAttribute("src", url);
      ms.addEventListener("sourceopen", function () {
        if (stopped || sb) return;
        try { sb = ms.addSourceBuffer(mime); sb.mode = "sequence"; } catch (_) { toDirect(); return; }   // "sequence": a second part follows the first
        sb.addEventListener("updateend", function () { ready(); pump(); });
        sb.addEventListener("error", toDirect);
        pump();
      });
    }
    return {
      push: function (buf) {
        if (stopped) return;
        var bytes = new Uint8Array(buf);
        all.push(bytes);
        if (direct) return;
        if (!mime) {
          var joined = new Uint8Array(head.length + bytes.length); joined.set(head); joined.set(bytes, head.length); head = joined;
          var c = codec(head);
          if (!c && head.length < 262144) return;   // the header has not all arrived yet
          mime = 'video/mp4; codecs="' + (c || "avc1.64001f") + ',mp4a.40.2"';
          if (!MS.isTypeSupported || !MS.isTypeSupported(mime)) { direct = true; return; }
          queue.push(head); attach();
          return;
        }
        queue.push(bytes); pump();
      },
      cut: function () { if (direct) { parts.push(all); all = []; } },   // the next chunk starts the second part
      end: function () { ended = true; if (direct) whole(); else { pump(); ready(); } },
      stop: function () { stopped = true; if (url) { try { URL.revokeObjectURL(url); } catch (_) {} } }
    };
  }

  // opts.asked: what the visitor typed, when `text` is the closest recorded wording being looked up in its place
  // opts.clip: the recorded clip to play if the service has no checked answer for `text` either
  function askLive(text, opts) {
    opts = opts || {};
    if (live.turn && !live.turn.done) {
      // The last answer is still arriving. When the model is making it, let it finish: it has been paid for.
      // When it is only being looked up, the new question replaces it: drop the connection, which also drops
      // what is left of the old answer, and ask again on a new one.
      if (live.generates) return;
      liveClose();
    }
    if (live.player) { live.player.stop(); live.player = null; }
    if (live.audio) { try { live.audio.pause(); } catch (_) {} live.audio = null; }
    current = null; spans = [];
    video.pause(); video.removeAttribute("src"); video.hidden = true; video.controls = false;
    try { video.load(); } catch (_) {}
    video.parentNode.style.aspectRatio = "";
    still.hidden = false; still.setAttribute("src", manifest.portrait || "/frederick.jpg"); rest(true);
    playB.hidden = true;
    qEl.textContent = "Q \u00b7 " + (opts.asked || text); qEl.hidden = false;
    aEl.textContent = ""; aEl.classList.remove("playing");
    sources(null); nearEl.textContent = ""; nearEl.hidden = true;
    chipButtons.forEach(function (c) { c.b.removeAttribute("aria-current"); });
    note(live.generates ? "Thinking\u2026" : "Looking that up\u2026", true);
    if (!opts.asked) announce("Answering: " + text);
    input.value = ""; setBusy(true);
    var turn = live.turn = { q: text, asked: opts.asked || text, clip: opts.clip || null, second: !!opts.asked, text: "", done: false, kind: null, chunks: [] };
    // an answer I have given before comes back within half a second: say "one second" only when it will be longer,
    // which is only when the model is answering there and then
    if (live.generates) turn.opener = setTimeout(function () { if (live.turn === turn && !turn.kind && !turn.done) opener(); }, 700);
    liveOpen().then(function (ws) {
      if (live.turn !== turn) return;
      ws.send(JSON.stringify({ type: "ask", text: text }));
      turn.guard = setTimeout(function () { if (!turn.done) liveFail("That took too long."); }, 90000);
    }).catch(function () { if (live.turn === turn) liveFail("The live voice isn\u2019t reachable right now."); });
    var stage = body.querySelector(".av-stage");
    if (stage && stage.scrollIntoView) { try { stage.scrollIntoView({ block: "nearest" }); } catch (_) {} }
    refresh();
  }
  // a short recorded "one second" in my voice, so the face responds at once while the answer is being made
  function opener() {
    var list = manifest.openers || [];
    if (!list.length) return;
    var o = list[Math.floor(Math.random() * list.length)];
    video.setAttribute("src", BASE + o.file + (o.key ? "?v=" + o.key : ""));
    var p = video.play();
    if (p && p.catch) p.catch(function () {});
  }
  function liveFinish() {
    var turn = live.turn;
    if (!turn) return;
    turn.done = true; clearTimeout(turn.guard); clearTimeout(turn.opener); setBusy(false);
  }
  // the live answer could not be finished: keep whatever words arrived, else fall back to the prepared answers
  function liveFail(why) {
    var turn = live.turn;
    if (!turn || turn.done) return;
    liveFinish();
    if (live.player) { live.player.stop(); live.player = null; }
    if (turn.text) { note(why + " The answer is above as text."); announce(turn.text); return; }
    live.turn = null;
    askLocal(turn.asked, why + " Here is the closest prepared answer instead.");
  }
  // The service has no checked answer under those exact words. Find the closest recorded wording here in the page
  // and ask the service for that one; if it has none either, play the recorded clip for that question.
  function liveNone(turn) {
    liveFinish(); live.turn = null;
    if (turn.second) {
      if (turn.clip) show(turn.clip, { play: true, asked: turn.asked }); else askLocal(turn.asked);
      return;
    }
    var r = match(index, turn.q);
    if (r.type === "answer" && r.phrase && plain(r.phrase) !== plain(turn.q)) askLive(r.phrase, { asked: turn.q, clip: r.clip });
    else askLocal(turn.q);
  }
  function liveMessage(data) {
    var turn = live.turn;
    if (!turn || turn.done) return;
    if (typeof data !== "string") {
      if (turn.kind === "video" && live.player) live.player.push(data);
      else if (turn.kind === "audio") turn.chunks.push(data);
      return;
    }
    var m; try { m = JSON.parse(data); } catch (_) { return; }
    if (m.type === "text") { turn.text += m.delta; aEl.textContent = turn.text; }
    else if (m.type === "none") liveNone(turn);
    else if (m.type === "said") {
      turn.text = m.text; aEl.textContent = m.text;
      if (m.kept) { clearTimeout(turn.opener); note(turn.second ? "The closest question I have an answer for: \u201c" + turn.q + "\u201d" : ""); }
      else note("Putting my voice and face to it\u2026 a few seconds.", true);
    }
    else if (m.type === "video") { turn.kind = "video"; clearTimeout(turn.opener); live.player = streamPlayer(m.seconds, !!m.kept); }
    else if (m.type === "video_cut") { if (live.player) live.player.cut(); }
    else if (m.type === "video_end") { if (live.player) live.player.end(); announce(turn.text); }
    else if (m.type === "audio") { turn.kind = "audio"; turn.chunks = []; }
    else if (m.type === "audio_end") {
      var a = live.audio = new Audio(URL.createObjectURL(new Blob(turn.chunks, { type: "audio/wav" })));
      var p = a.play(); if (p && p.catch) p.catch(function () {});
      note("My face couldn\u2019t be rendered this time, so this answer is voice only."); announce(turn.text);
    }
    else if (m.type === "done") liveFinish();
    else if (m.type === "limit") { live.on = false; describe(); liveFinish(); live.turn = null; askLocal(turn.asked, live.generates ? m.message + " Here is the closest prepared answer instead." : ""); }
    else if (m.type === "error") {
      if (m.code === "busy" || m.code === "too_fast" || m.code === "bad_question") { liveFinish(); note(m.message); }
      else liveFail(m.message || "The live voice had a problem.");
    }
  }

  function ask(text) {
    if (live.on) askLive(text); else askLocal(text);
  }

  // why: a line explaining that this is a prepared answer standing in for a live one
  function askLocal(text, why) {
    live.turn = null;
    var r = match(index, text);
    if (r.type === "answer") show(r.clip, { play: true, asked: text });
    else if (r.type === "greeting") show(fallbackClip("greeting"), { play: true, intro: "Playing the greeting." });
    else show(fallbackClip(r.type), { play: true, asked: text, near: r.near, intro: r.near.length ? "The closest questions I do have are listed after the answer." : "" });
    input.value = "";
    if (why) note(why);
  }

  function open(from) {
    build();
    if (!root.hidden) return;
    lastFocus = from && from.focus ? from : doc.activeElement;
    root.hidden = false; void root.offsetWidth; root.classList.add("open");
    doc.documentElement.classList.add("av-lock");
    Array.prototype.forEach.call(doc.body.children, function (n) { if (n !== root && n.id !== "lq-ptr" && !n.inert) { n.inert = true; n.__avInert = true; } });
    closeB.focus({ preventScroll: true });
    refresh();
    if (manifest && video) { if (video.hidden) rest(true); (playB.hidden ? titleEl : playB).focus({ preventScroll: true }); return; }
    message('<span class="av-spin"></span>Loading\u2026');
    load().then(function () {
      render();
      liveCheck();
      show(fallbackClip("greeting") || manifest.clips[0], {});   // poster only: no sound until the visitor presses play or asks
      if (!root.hidden) (playB.hidden ? titleEl : playB).focus({ preventScroll: true });
    }).catch(function () {
      message('The avatar couldn\u2019t load here. You can <a href="mailto:' + EMAIL + '">email me</a> instead.');
    });
  }

  function close() {
    if (!root || root.hidden) return;
    if (video) video.pause();
    if (idle) idle.pause();
    liveClose();
    root.classList.remove("open");
    doc.documentElement.classList.remove("av-lock");
    Array.prototype.forEach.call(doc.body.children, function (n) { if (n.__avInert) { n.inert = false; n.__avInert = false; } });
    var done = function () { root.hidden = true; refresh(); };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) done(); else setTimeout(done, 220);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (_) {}
  }

  window.AvatarWidget = { open: open, close: close, match: Match };
})();
