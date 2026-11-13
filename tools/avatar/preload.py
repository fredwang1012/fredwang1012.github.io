# /// script
# requires-python = ">=3.11"
# dependencies = ["websockets>=13"]
# ///
"""Fill the live service's answer store: ask it every way of asking the prepared questions, one after another.

Each answer is made the normal way (the model, my voice, the lip-sync) and kept by the service, so a visitor who asks
the same thing later gets it at once and at no cost, with or without Boson credit. A question already in the store
comes straight back and costs nothing, so this can be run again at any time.

    PRELOAD_TOKEN=<the service's PRELOAD_TOKEN secret> py -3.12 -m uv run tools/avatar/preload.py [--limit N] [--dry-run]

The token is read from the environment only; it is never written anywhere. Remove the secret from the service when
the store is full: `npx wrangler secret delete PRELOAD_TOKEN`.
"""
import argparse
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path

from websockets.sync.client import connect

HERE = Path(__file__).resolve().parent
REFERS_BACK = re.compile(r"\b(more|that|it|its|this|these|those|them|they|one|ones|again|else|also|same|then|there|earlier|before|previous|above)\b")


def _folded(question: str) -> str:
    text = "".join(c for c in unicodedata.normalize("NFKD", question) if not "\u0300" <= c <= "\u036f")
    return text.replace("\u2018", "'").replace("\u2019", "'")


def store_name(question: str) -> str:
    """The same filing rule as storeName in live/src/lib.js."""
    return re.sub(r"[^a-z0-9]+", " ", _folded(question).lower()).strip()


def stands_alone(question: str) -> bool:
    """The same rule as standsAlone in live/src/lib.js: the service keeps the answer only to such a question."""
    name = store_name(question)
    in_full = re.fullmatch(r"[A-Za-z0-9 ?.,'-]*", _folded(question)) is not None
    return in_full and len(name.split()) >= 3 and not REFERS_BACK.search(name)


def questions() -> list[str]:
    data = json.loads((HERE / "questions.json").read_text(encoding="utf-8"))
    cases = json.loads((HERE / "match_cases.json").read_text(encoding="utf-8"))
    out, seen = [], set()
    asked = [t for q in data["questions"] for t in [q["question"], *q.get("paraphrases", [])]]
    asked += [c["q"] for c in cases["cases"] if c["want"] not in ("greeting", "offtopic", "norecord")]
    for text in asked:
        name = store_name(text)
        if name not in seen and stands_alone(text) and len(text) <= 300:
            seen.add(name)
            out.append(text)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--limit", type=int, help="ask at most N questions that are not in the store yet")
    ap.add_argument("--dry-run", action="store_true", help="list the questions and stop")
    args = ap.parse_args()
    todo = questions()
    if args.dry_run:
        print("\n".join(todo))
        print(f"\n{len(todo)} questions")
        return 0
    cfg = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
    url, token = cfg["live"]["url"], os.environ.get("PRELOAD_TOKEN", "")
    if not url or not token:
        sys.exit("needs live.url in config.json and PRELOAD_TOKEN in the environment")
    origin = "https://fredwang1012.github.io"
    made = kept = failed = unfilmed = 0
    seconds = 0.0
    ws = None

    def open_session():
        s = connect(url, origin=origin, open_timeout=30, max_size=None)
        json.loads(s.recv(timeout=30))  # ready
        s.send(json.dumps({"type": "fill", "token": token}))
        if not json.loads(s.recv(timeout=30)).get("ok"):
            sys.exit("the service did not accept the token")
        return s

    for n, text in enumerate(todo, 1):
        if args.limit is not None and made >= args.limit:
            break
        for attempt in (1, 2):
            try:
                ws = ws or open_session()
                t0 = time.time()
                ws.send(json.dumps({"type": "ask", "text": text}))
                said, was_kept, size, end, filmed = "", False, 0, None, False
                while end is None:
                    m = ws.recv(timeout=180)
                    if isinstance(m, (bytes, bytearray)):
                        size += len(m)
                        continue
                    e = json.loads(m)
                    if e["type"] == "said":
                        said, was_kept = e["text"], bool(e.get("kept"))
                        seconds += 0 if was_kept else float(e.get("seconds") or 0)
                    elif e["type"] == "video":
                        filmed = True
                    elif e["type"] in ("done", "error", "limit"):
                        end = e
                if end["type"] != "done" or not size:
                    raise RuntimeError(end.get("message") or end["type"])
                if not filmed:  # the renderer was busy: the service sent the voice alone, which it does not keep
                    unfilmed += 1
                    print(f"[{n}/{len(todo)}] voice only, not kept (run again later)  {text}", flush=True)
                    time.sleep(10)
                    break
                kept += was_kept
                made += not was_kept
                print(f"[{n}/{len(todo)}] {'kept' if was_kept else 'made'} {time.time() - t0:5.1f}s {size // 1024:5d} KB  {text}\n      {said}", flush=True)
                break
            except Exception as e:  # a dropped connection, a busy renderer: open a new session and try once more
                try:
                    ws and ws.close()
                except Exception:
                    pass
                ws = None
                if attempt == 2:
                    failed += 1
                    print(f"[{n}/{len(todo)}] FAILED ({type(e).__name__}: {str(e)[:120]})  {text}", flush=True)
                else:
                    time.sleep(8)
    print(f"\nmade {made}, already in the store {kept}, voice only {unfilmed}, failed {failed}; about {seconds / 60:.1f} min of new video (${seconds / 60 * 0.09:.2f} at $0.09/min)")
    return 1 if failed or unfilmed else 0


if __name__ == "__main__":
    sys.exit(main())
