# Live answers for the avatar

A small Cloudflare Worker. A visitor's question comes in over a WebSocket; Boson's realtime model answers it from
`tools/avatar/knowledge.md` in the cloned voice; Boson's avatar model lip-syncs `tools/avatar/portrait.jpg` to that
audio; the words and then the video are passed back to the page as they are made.

The Boson key, the voice id and the instructions stay on this side. A visitor can send one thing, a question, so the
cloned voice only ever says what the model answered under `src/rules.md`.

## Files

- `src/index.js` the Worker: the session, the limits, the calls to Boson
- `src/lib.js` pure helpers, tested by `node --test live/test`
- `src/rules.md` how the model must answer; the facts come from `tools/avatar/knowledge.md`

## Run it locally

No key is copied anywhere: point wrangler at an env file that already holds `BOSON_API_KEY`.

    cd live
    npx wrangler dev --port 8787 --env-file <path to a .env with BOSON_API_KEY> \
      --var BOSON_VOICE:<voice id from tools/avatar/.local.json> --var ALLOW_LOCALHOST:1

Then `npm run build && npm run preview` in `app/`. A page on localhost uses `ws://127.0.0.1:8787/talk` by itself.

## Deploy

    cd live
    npx wrangler login
    npx wrangler deploy            # creates the USAGE store on the first run
    npx wrangler secret put BOSON_API_KEY
    npx wrangler secret put BOSON_VOICE
    npx wrangler secret put VISITOR_SALT     # any long random string

Put the address it prints into `tools/avatar/config.json` as `live.url` (`wss://<name>.<account>.workers.dev/talk`),
run `bake.py manifest --placeholders`, and publish the site. With `live.url` empty the page uses the prepared
answers only.

## Limits (in `wrangler.jsonc`)

- `DAILY_SECONDS` seconds of video per day for everyone together (300 is about $0.45 of video a day)
- `DAILY_ASKS_PER_VISITOR`, `ASKS_PER_SESSION`
- `ALLOWED_ORIGINS` the pages allowed to open a session

When a limit is reached, or Boson is down or out of credit, the page falls back to the prepared answers.

## What it costs and how fast it is (measured 2026-11-13)

- The written answer appears about 1 s after the question; the lip-synced video starts 12 to 15 s after it.
- Boson renders between half and twice real time, so the page starts the video only once enough has arrived to play
  through. Rendering an answer in two parts was tried and is off: two renders at once slow each other down.
- About $0.02 to $0.03 of video per answer at 640x640, plus the realtime model's speech.
