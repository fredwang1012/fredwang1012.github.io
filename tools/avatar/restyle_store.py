# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "anthropic>=1.0",
#     "httpx>=0.27",
#     "imageio-ffmpeg>=0.5",
#     "websockets>=13",
# ]
# ///
"""Record every approved answer in the store again, in the recorded clips' delivery, and make it smaller.

The answers kept by the live service were spoken by the realtime model, which takes no delivery tags, so they
sound flatter than the recorded clips. This speaks each approved answer's exact words again with Higgs TTS in the
delivery set in config.json (tts.delivery), checks by ear that the take says its words, lip-syncs it, compresses
it (about a sixth of the size of a realtime answer, so the store holds far more), and puts it back in place of the old one.
The words never change, so each answer stays approved; the service refuses a recording whose words differ.

    PRELOAD_TOKEN=<the service's PRELOAD_TOKEN secret> \\
      py -3.12 -m uv run tools/avatar/restyle_store.py --boson-env <.env with BOSON_API_KEY> [--limit N] [--workers N]

Answers already restyled are skipped, so it can be run again. Remove the token afterwards:
`npx wrangler secret delete PRELOAD_TOKEN`.
"""
import argparse
import json
import os
import sys
import threading
import time
import warnings
from pathlib import Path

from websockets.sync.client import connect

HERE = Path(__file__).resolve().parent
warnings.filterwarnings("ignore", category=DeprecationWarning, module="websockets")   # a long-lived connection, closed by hand
sys.path.insert(0, str(HERE))
import bake  # noqa: E402
import review_store  # noqa: E402
from check_clips import says_what_is_written, transcribe  # noqa: E402

STYLE = "expressive"
PART = 512 * 1024   # a Workers WebSocket message may be 1 MiB


def to_web(raw: Path, out: Path) -> None:
    """Boson's MP4 repackaged as fragmented MP4, so the page can play it while it arrives. The picture and sound are
    copied as they are: Boson's file is already small (about 40 KB a second), and re-encoding it only made it bigger."""
    bake.run_ffmpeg(["-i", str(raw), "-c", "copy", "-movflags", "+frag_keyframe+empty_moov+default_base_moof", str(out)])


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--boson-env", required=True, help="a .env file holding BOSON_API_KEY")
    ap.add_argument("--limit", type=int, help="restyle at most N answers")
    ap.add_argument("--workers", type=int, default=2, help="answers made at once (default 2)")
    args = ap.parse_args()
    token = os.environ.get("PRELOAD_TOKEN") or sys.exit("PRELOAD_TOKEN must be set (the service's secret)")
    cfg = bake.load_config()
    tags = bake.delivery(cfg)
    if not tags:
        sys.exit("tts.delivery is empty in config.json: there is no other delivery to record in")
    stt_key = bake.read_env_file(Path(args.boson_env)).get("BOSON_API_KEY") or sys.exit("no BOSON_API_KEY in that file")
    image = (bake.REPO / cfg["avatar"]["portrait"]).read_bytes()
    mime, _, _ = bake.image_meta(image)
    url = cfg["live"]["url"]

    name = review_store.shelf()
    ok = set(review_store.approved(name))
    todo = [r for r in review_store.kept(name) if r["id"] in ok and r.get("style") != STYLE]
    if args.limit:
        todo = todo[:args.limit]
    print(f"{len(todo)} approved answers to record again in the '{STYLE}' delivery ({tags})", flush=True)

    lock = threading.Lock()
    queue = list(enumerate(todo, 1))
    stats = {"done": 0, "failed": 0, "seconds": 0.0, "old": 0, "new": 0}

    def work(slot: int) -> None:
        boson = bake.boson_client(argparse.Namespace(boson_env=args.boson_env))
        tmp = HERE / ".cache" / "restyle" / str(slot)
        tmp.mkdir(parents=True, exist_ok=True)
        ws = None
        try:
            while True:
                with lock:
                    if not queue:
                        return
                    n, r = queue.pop(0)
                q, said = r["q"], r["text"]
                try:
                    # 1. speak it, and listen before paying for the video: a stumbled take is made again
                    for take in range(3):
                        audio = boson.speech(tags + bake.clean_for_tts(said), cfg["tts"]["voice"], cfg["tts"]["model"], bool(cfg["tts"].get("normalize")))
                        mp3, wav = tmp / "a.mp3", tmp / "a.wav"
                        mp3.write_bytes(audio)
                        bake.run_ffmpeg(["-i", str(mp3), "-ac", "1", "-ar", "16000", str(wav)])
                        fine, ratio = says_what_is_written(said, transcribe(wav, stt_key))
                        if fine:
                            break
                    else:
                        raise RuntimeError(f"three takes did not say the words (last match {ratio:.2f})")
                    seconds = bake.media_seconds(mp3)
                    if seconds > 58:
                        raise RuntimeError(f"{seconds:.0f}s of speech, over the renderer's limit")
                    bake.log_spend({"clip": f"restyle:{r['id']}", "call": "tts", "chars": len(said), "usd": round(len(said) / 1000 * cfg["tts"]["usd_per_1k_chars"], 5)})
                    # 2. lip-sync and compress
                    vid = boson.create_video(image, mime, audio, cfg["avatar"]["size"], cfg["avatar"]["model"])
                    boson.wait_video(vid)
                    raw, web = tmp / "raw.mp4", tmp / "web.mp4"
                    raw.write_bytes(boson.video_content(vid))
                    to_web(raw, web)
                    seconds = bake.media_seconds(web)
                    bake.log_spend({"clip": f"restyle:{r['id']}", "call": "avatar", "seconds": round(seconds, 2), "size": cfg["avatar"]["size"],
                                    "usd": round(seconds / 60 * bake.avatar_rate(cfg), 5)})
                    data = web.read_bytes()
                    # 3. put it in place of the old recording; the service checks the words are the same
                    for attempt in (1, 2):
                        try:
                            if ws is None:
                                ws = connect(url, origin="https://fredwang1012.github.io", open_timeout=30, max_size=None)
                                ws.recv(timeout=30)
                                ws.send(json.dumps({"type": "fill", "token": token}))
                                if not json.loads(ws.recv(timeout=30)).get("ok"):
                                    raise SystemExit("the service did not accept the token")
                            ws.send(json.dumps({"type": "put", "text": q, "said": said, "seconds": round(seconds, 2), "bytes": len(data), "style": STYLE}))
                            ready = json.loads(ws.recv(timeout=60))
                            if not ready.get("ok"):
                                raise RuntimeError(f"refused: {ready.get('why')}")
                            for at in range(0, len(data), PART):
                                ws.send(data[at:at + PART])
                            ws.send(json.dumps({"type": "put_end"}))
                            done = json.loads(ws.recv(timeout=60))
                            if not done.get("ok"):
                                raise RuntimeError(f"not stored: {done.get('why')}")
                            break
                        except (OSError, TimeoutError, ConnectionError) as e:
                            try:
                                ws and ws.close()
                            except Exception:
                                pass
                            ws = None
                            if attempt == 2:
                                raise RuntimeError(f"upload failed: {type(e).__name__}") from None
                    old = len(raw.read_bytes())
                    with lock:
                        stats["done"] += 1
                        stats["seconds"] += seconds
                        stats["old"] += old
                        stats["new"] += len(data)
                        print(f"[{n}/{len(todo)}] ok  {seconds:4.1f}s  {len(data) // 1024:4d} KB  {q}", flush=True)
                except Exception as e:  # noqa: BLE001 - one answer failing must not stop the rest; its old recording stays
                    with lock:
                        stats["failed"] += 1
                        print(f"[{n}/{len(todo)}] FAILED ({str(e)[:140]})  {q}", flush=True)
                    time.sleep(5)
        finally:
            boson.close()
            try:
                ws and ws.close()
            except Exception:
                pass

    threads = [threading.Thread(target=work, args=(i,), daemon=True) for i in range(max(1, args.workers))]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    mb = lambda b: b / 1048576  # noqa: E731
    print(f"\nrestyled {stats['done']}, failed {stats['failed']} (their old recordings stay); {stats['seconds'] / 60:.1f} min of video; "
          f"{mb(stats['new']):.0f} MB in all")
    return 1 if stats["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
