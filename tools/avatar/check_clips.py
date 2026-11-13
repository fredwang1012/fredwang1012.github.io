# /// script
# requires-python = ">=3.11"
# dependencies = ["imageio-ffmpeg>=0.5"]
# ///
"""Listen to every recorded clip and check it says what is written.

Boson's text-to-speech sometimes stumbles: it repeats a phrase several times or adds garbled filler. The clip still
renders, so nothing fails; it is only wrong to the ear. This transcribes each clip with Boson speech-to-text and
compares the words with the written answer. A clip marked CHECK should be recorded again: move its audio and video
out of tools/avatar/.cache, then run `bake.py bake --only <id> --force`.

    py -3.12 -m uv run tools/avatar/check_clips.py --boson-env <.env with BOSON_API_KEY> [id ...]
"""
import argparse
import difflib
import json
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent


def words(text: str) -> list[str]:
    return re.sub(r"[^a-z0-9 ]+", " ", text.lower()).split()


def says_what_is_written(written: str, heard: str) -> tuple[bool, float]:
    """Whether a transcript is the written answer, give or take how speech-to-text spells things.

    A stumble shows as extra words (a phrase said several times, filler) or as a poor match overall.
    """
    a, b = words(written), words(heard)
    ratio = difflib.SequenceMatcher(None, a, b).ratio()
    return ratio >= 0.85 and abs(len(b) - len(a)) <= max(3, len(a) * 0.15), ratio


def transcribe(wav: Path, key: str) -> str:
    boundary = uuid.uuid4().hex

    def part(name: str, value: bytes | str, filename: str | None = None, ctype: str | None = None) -> bytes:
        head = f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"' + (f'; filename="{filename}"' if filename else "") + "\r\n"
        if ctype:
            head += f"Content-Type: {ctype}\r\n"
        return head.encode() + b"\r\n" + (value if isinstance(value, bytes) else value.encode()) + b"\r\n"

    body = part("model", "higgs-stt-3.1") + part("file", wav.read_bytes(), wav.name, "audio/wav") + f"--{boundary}--\r\n".encode()
    req = urllib.request.Request("https://api.boson.ai/v1/audio/transcriptions", data=body, method="POST", headers={
        "Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={boundary}", "User-Agent": "avatar-check/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read())["text"]
    except urllib.error.HTTPError as e:
        return f"(speech-to-text failed: HTTP {e.code})"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("ids", nargs="*", help="clip ids to check (default: every clip and opener)")
    ap.add_argument("--boson-env", required=True, help="path to a .env file holding BOSON_API_KEY")
    args = ap.parse_args()
    env = {}
    for line in Path(args.boson_env).read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$", line)
        if m:
            env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    key = env.get("BOSON_API_KEY") or sys.exit("no BOSON_API_KEY in that file")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        import imageio_ffmpeg
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    manifest = json.loads((SITE / "app/public/avatar/manifest.json").read_text(encoding="utf-8"))
    config = json.loads((HERE / "config.json").read_text(encoding="utf-8"))
    # the openers have no entry of their own: their words are in config.json, in the order of their files
    openers = [{"id": Path(o["file"]).stem, "file": o["file"], "answer": text, "duration": 0.0}
               for o, text in zip(manifest.get("openers", []), (config.get("live") or {}).get("openers", []))]
    clips = [c for c in manifest["clips"] if c.get("file")] + openers
    tmp = HERE / ".cache" / "check"
    tmp.mkdir(parents=True, exist_ok=True)
    bad = 0
    for c in clips:
        if args.ids and c["id"] not in args.ids:
            continue
        wav = tmp / f"{c['id']}.wav"
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(SITE / "app/public/avatar" / c["file"]),
                        "-vn", "-ac", "1", "-ar", "16000", str(wav)], check=True)
        heard = transcribe(wav, key)
        wav.unlink(missing_ok=True)
        ok, ratio = says_what_is_written(c["answer"], heard)
        bad += not ok
        print(f"{'ok   ' if ok else 'CHECK'} {c['id']:<24} {c.get('duration') or 0:5.1f}s  match {ratio:.2f}  "
              f"{len(words(c['answer']))} words written, {len(words(heard))} heard", flush=True)
        if not ok:
            print("   heard:", heard[:700])
    print(f"\n{bad} clip(s) to record again" if bad else "\nevery clip says what is written")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
