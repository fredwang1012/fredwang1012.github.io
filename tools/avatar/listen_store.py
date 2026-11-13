# /// script
# requires-python = ">=3.11"
# dependencies = ["websockets>=13", "imageio-ffmpeg>=0.5"]
# ///
"""Listen to every approved answer in the live service's store and check it says its words.

An answer is approved by reading the words the model said it spoke. The voice can stumble all the same (a phrase
repeated, garbled filler), which only the sound shows. This asks the service for each approved answer the way a
visitor would, transcribes the video's sound with Boson speech-to-text, and compares it with the words. The
questions whose answers fail are written to a file for `review_store.py forget`.

    py -3.12 -m uv run tools/avatar/listen_store.py --boson-env <.env with BOSON_API_KEY> [--out FILE] [--limit N]
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from websockets.sync.client import connect

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import review_store  # noqa: E402
from check_clips import says_what_is_written, transcribe, words  # noqa: E402


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--boson-env", required=True, help="a .env file holding BOSON_API_KEY, for the speech-to-text")
    ap.add_argument("--out", default=str(HERE / ".cache" / "stumbled.txt"), help="where to write the questions that failed")
    ap.add_argument("--limit", type=int, help="listen to at most N answers")
    args = ap.parse_args()
    key = None
    for line in Path(args.boson_env).read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*BOSON_API_KEY\s*=\s*(.*)\s*$", line)
        if m:
            key = m.group(1).strip().strip('"').strip("'")
    if not key:
        sys.exit("no BOSON_API_KEY in that file")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    url = json.loads((HERE / "config.json").read_text(encoding="utf-8"))["live"]["url"]
    name = review_store.shelf()
    ok = set(review_store.approved(name))
    rows = [r for r in review_store.kept(name) if r["id"] in ok]
    if args.limit:
        rows = rows[:args.limit]
    work = HERE / ".cache" / "check"
    work.mkdir(parents=True, exist_ok=True)
    bad, unserved = [], []
    ws = None
    for n, r in enumerate(rows, 1):
        video, said, end = bytearray(), "", None
        for attempt in (1, 2):
            try:
                if ws is None:
                    ws = connect(url, origin="https://fredwang1012.github.io", open_timeout=30, max_size=None)
                    ws.recv(timeout=30)
                ws.send(json.dumps({"type": "ask", "text": r["q"]}))
                video, said, end = bytearray(), "", None
                while end is None:
                    m = ws.recv(timeout=120)
                    if isinstance(m, (bytes, bytearray)):
                        video += m
                        continue
                    e = json.loads(m)
                    if e["type"] == "said":
                        said = e["text"]
                    elif e["type"] in ("done", "none", "error", "limit"):
                        end = e["type"]
                break
            except Exception:
                try:
                    ws and ws.close()
                except Exception:
                    pass
                ws, end = None, "dropped"
                time.sleep(3)
        if end != "done" or not video:
            unserved.append(r["q"])
            print(f"[{n}/{len(rows)}] not served ({end})  {r['q']}", flush=True)
            continue
        mp4, wav = work / "listen.mp4", work / "listen.wav"
        mp4.write_bytes(bytes(video))
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(mp4), "-vn", "-ac", "1", "-ar", "16000", str(wav)], check=True)
        heard = transcribe(wav, key)
        mp4.unlink(missing_ok=True)
        wav.unlink(missing_ok=True)
        fine, ratio = says_what_is_written(said, heard)
        if not fine and heard.startswith("(speech-to-text failed"):
            unserved.append(r["q"])
            print(f"[{n}/{len(rows)}] could not transcribe  {r['q']}", flush=True)
            continue
        print(f"[{n}/{len(rows)}] {'ok   ' if fine else 'CHECK'} match {ratio:.2f}  {len(words(said))} words, {len(words(heard))} heard  {r['q']}", flush=True)
        if not fine:
            bad.append(r["q"])
            print(f"      words: {said[:300]}\n      heard: {heard[:300]}", flush=True)
    Path(args.out).write_text("".join(q + "\n" for q in bad), encoding="utf-8")
    print(f"\nlistened to {len(rows) - len(unserved)} approved answers: {len(bad)} do not say their words"
          + (f"; {len(unserved)} could not be checked" if unserved else ""))
    if bad:
        print(f"their questions are in {args.out}; remove them with: review_store.py forget {args.out}")
    return 1 if bad or unserved else 0


if __name__ == "__main__":
    sys.exit(main())
