# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "anthropic>=1.0",
#     "httpx>=0.27",
#     "imageio-ffmpeg>=0.5",
# ]
# ///
"""Bake the "AI version of me" avatar: written answers -> speech -> lip-synced video -> static files.

Everything the site needs ends up under app/public/avatar/ as plain files, so the widget has no backend and keeps
working after the Boson credits are gone.

    py -3.12 -m uv run tools/avatar/bake.py answers                 # step A: write answers.json (cheap, no Boson)
    py -3.12 -m uv run tools/avatar/bake.py status                  # what is written, baked, stale
    py -3.12 -m uv run tools/avatar/bake.py bake --dry-run          # cost estimate only, spends nothing
    py -3.12 -m uv run tools/avatar/bake.py bake --limit 3 --max-usd 0.50 --boson-env PATH\\TO\\.env
    py -3.12 -m uv run tools/avatar/bake.py clone-voice --audio me.wav --transcript me.txt --consent --boson-env ...
    py -3.12 -m uv run tools/avatar/bake.py manifest                # rebuild manifest.json from what is on disk
    py -3.12 -m uv run tools/avatar/bake.py manifest --placeholders # also list answers that have no clip yet (text only)

Steps
  A  answers      One Claude call per question, grounded only in knowledge.md. Saved to answers.json for review.
                  Existing answers are never overwritten unless --force is given, so hand edits are safe.
  B  speech       Boson Higgs TTS 3, voice from config.json (or the cloned voice saved by clone-voice).
  C  video        Boson Higgs Avatar from the portrait in config.json, then a small web MP4 and a poster frame.

A manifest entry without a clip ("file": null) is a placeholder: the widget shows its text with the portrait. With
`manifest --placeholders` every written answer gets one, so the widget can be tried before any clip exists, and
each placeholder is replaced as its clip is baked.

The bake is resumable: a clip is skipped when its manifest entry has the same key (answer text, voice, portrait,
models, sizes) and its files exist. Raw audio and video are kept in tools/avatar/.cache/ (gitignored), so changing
only the output size re-encodes for free.

The Boson key is read at run time from a .env file named by --boson-env or the AVATAR_BOSON_ENV environment
variable (or from BOSON_API_KEY in the environment). It is never printed, logged or written anywhere.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
KNOWLEDGE = HERE / "knowledge.md"
QUESTIONS = HERE / "questions.json"
ANSWERS = HERE / "answers.json"
CONFIG = HERE / "config.json"
LOCAL = HERE / ".local.json"  # gitignored: the cloned voice id
CACHE = HERE / ".cache"  # gitignored: raw audio, raw video, spend log

FALLBACK_BETA = "server-side-fallback-2026-07-01"
BOSON_DEFAULT_URL = "https://api.boson.ai"
VOICE_FORMATS = {".wav", ".mp3", ".flac", ".opus", ".pcm"}  # what Boson voice cloning accepts
_SECRETS: list[str] = []


# ---------------------------------------------------------------- small helpers


def say(msg: str = "") -> None:
    print(redact(msg), flush=True)


def redact(text: str) -> str:
    for s in _SECRETS:
        if s:
            text = text.replace(s, "<redacted>")
    return text


def die(msg: str, code: int = 1) -> None:
    print(redact(f"error: {msg}"), file=sys.stderr, flush=True)
    raise SystemExit(code)


def sha(*parts: str | bytes, n: int = 16) -> str:
    h = hashlib.sha256()
    for p in parts:
        h.update(p if isinstance(p, bytes) else p.encode("utf-8"))
        h.update(b"\x00")
    return h.hexdigest()[:n]


def read_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    tmp.replace(path)


def load_config() -> dict[str, Any]:
    cfg = read_json(CONFIG)
    if cfg is None:
        die(f"missing {CONFIG}")
    local = read_json(LOCAL, {})
    if local.get("voice"):
        cfg["tts"]["voice"] = local["voice"]
        cfg["tts"]["voice_kind"] = local.get("voice_kind", "cloned")
    return cfg


def load_questions() -> list[dict[str, Any]]:
    """Fallback clips first, then the questions, in file order. Each gets a 'kind'."""
    q = read_json(QUESTIONS)
    if q is None:
        die(f"missing {QUESTIONS}")
    out = [dict(f, kind="fallback") for f in q["fallbacks"]] + [dict(x, kind="answer") for x in q["questions"]]
    ids = [x["id"] for x in out]
    dup = {i for i in ids if ids.count(i) > 1}
    if dup:
        die(f"duplicate ids in questions.json: {sorted(dup)}")
    for x in out:
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", x["id"]):
            die(f"id {x['id']!r} must be lowercase letters, digits and hyphens (it becomes a file name)")
    return out


def pick(items: list[dict[str, Any]], only: str | None) -> list[dict[str, Any]]:
    if not only:
        return items
    want = [s.strip() for s in only.split(",") if s.strip()]
    by_id = {x["id"]: x for x in items}
    missing = [w for w in want if w not in by_id]
    if missing:
        die(f"unknown ids: {', '.join(missing)}")
    return [by_id[w] for w in want]


# ---------------------------------------------------------------- step A: answers

SYSTEM_RULES = """You write the lines for a talking avatar of Frederick Wang on his portfolio site. Each line is \
turned into speech and a lip-synced video, and shown as a caption, so it must sound right when spoken and read \
right on screen.

Write the answer to one question, as Frederick, in the first person.

Grounding
- Use only the knowledge file below. Every fact, name and number in your answer must be in it.
- If the knowledge file says something is not measured or not public, say that plainly instead of filling the gap.
- If the knowledge file does not cover the question, say so in one sentence and point to email or the résumé.
- Never give a phone number or a home address.
- Team projects are team projects: say "we" for the team and "I" only for Frederick's own part.

Form
- {min_s} to {max_s} sentences, about 40 to 65 words, never more than {max_chars} characters. Plain and friendly, the way he would say it to \
someone he has just met. No sales talk, no superlatives about himself.
- Start with the answer. Do not greet, do not repeat the question, do not say "great question".
- Written for the ear: no lists, no markdown, no brackets, no emoji, no abbreviations a voice would stumble on. \
Write "percent" and "million dollars", "master's" and "bachelor's", "first place", "text-to-SQL". Keep technical \
names as they are (Claude, Unity Catalog, BM25, PyTorch, CARLA).
- Do not read out email addresses or web addresses. Say they are linked below the video.
- Vary how answers open; not every answer should start with "I".

Reply with the answer text only: no quotes, no preamble, no notes."""


def knowledge_text() -> str:
    if not KNOWLEDGE.exists():
        die(f"missing {KNOWLEDGE}")
    return KNOWLEDGE.read_text(encoding="utf-8")


def split_sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])[\"')”’]?\s+(?=[\"'(“‘]?[A-Z0-9])", text.strip())
    return [p.strip() for p in parts if p.strip()]


def numbers_in(text: str) -> list[str]:
    return [re.sub(r"[,]", "", m).rstrip(".") for m in re.findall(r"\d[\d,.]*", text)]


def check_answer(text: str, knowledge: str, acfg: dict[str, Any]) -> list[str]:
    """Cheap checks a reviewer would otherwise do by eye. Returns warnings, empty when clean."""
    warn = []
    n = len(split_sentences(text))
    if not acfg["min_sentences"] <= n <= acfg["max_sentences"]:
        warn.append(f"{n} sentences (want {acfg['min_sentences']} to {acfg['max_sentences']})")
    if len(text) > acfg["max_chars"]:
        warn.append(f"{len(text)} characters (max {acfg['max_chars']})")
    if re.search(r"[*_#`\[\]<>|]|https?://|www\.|\S+@\S+\.\S+", text):
        warn.append("contains markup, a link or an email address")
    known = set(numbers_in(knowledge))
    blob = re.sub(r"[,]", "", knowledge)
    for num in numbers_in(text):
        if num not in known and num not in blob:
            warn.append(f"number {num} is not in the knowledge file")
    if re.search(r"\b(\+?1[ -.]?)?\(?\d{3}\)?[ -.]\d{3}[ -.]\d{4}\b", text):
        warn.append("looks like a phone number")
    return warn


def write_answer(client: Any, system: list[dict[str, Any]], item: dict[str, Any], acfg: dict[str, Any],
                 feedback: str | None = None) -> tuple[str, str]:
    """One model call. Returns (answer text, model that served it). Raises RuntimeError with a plain message."""
    import anthropic

    lines = [f"Question: {item['question']}"]
    if item.get("paraphrases"):
        lines.append("People also ask it as: " + " / ".join(item["paraphrases"]))
    if feedback:
        lines.append(f"Your previous answer had these problems, fix them: {feedback}")
    lines.append("Write the spoken answer.")
    try:
        resp = client.beta.messages.create(
            model=acfg["model"],
            max_tokens=4000,
            betas=[FALLBACK_BETA],
            fallbacks="default",  # a policy decline is re-run on a fallback model instead of failing the item
            system=system,
            output_config={"effort": acfg.get("effort", "medium")},
            messages=[{"role": "user", "content": "\n".join(lines)}],
        )
    except anthropic.AuthenticationError as e:
        raise RuntimeError(f"not signed in to the Anthropic API (run `ant auth login`): {e.message}") from e
    except anthropic.RateLimitError as e:
        raise RuntimeError(f"rate limited by the Anthropic API: {e.message}") from e
    except anthropic.APIStatusError as e:
        raise RuntimeError(f"Anthropic API error {e.status_code}: {e.message}") from e
    except anthropic.APIConnectionError as e:
        raise RuntimeError(f"could not reach the Anthropic API: {e}") from e

    # stop_reason first: a refusal or a cut-off response has no usable text
    if resp.stop_reason == "refusal":
        details = getattr(resp, "stop_details", None)
        raise RuntimeError(f"the model declined ({getattr(details, 'category', None) or 'no category'})")
    if resp.stop_reason == "max_tokens":
        raise RuntimeError("the response was cut off at max_tokens")
    if resp.stop_reason != "end_turn":
        raise RuntimeError(f"unexpected stop_reason {resp.stop_reason!r}")
    text = " ".join(b.text.strip() for b in resp.content if b.type == "text").strip()
    text = re.sub(r"\s+", " ", text).strip().strip('"').strip()
    if not text:
        raise RuntimeError("the response had no text")
    return text, resp.model


def cmd_answers(args: argparse.Namespace) -> None:
    import anthropic

    cfg = load_config()
    acfg = cfg["answers"]
    knowledge = knowledge_text()
    k_sha = sha(knowledge)
    items = pick(load_questions(), args.only)
    store = read_json(ANSWERS, {"version": 1, "answers": {}})
    answers: dict[str, Any] = store["answers"]

    todo = []
    for it in items:
        have = answers.get(it["id"])
        if it["kind"] == "fallback":
            # fixed text from questions.json; kept in answers.json so everything spoken is reviewed in one place
            if not have or args.force:
                answers[it["id"]] = {"question": it["question"], "answer": it["answer"], "source": "fixed",
                                     "reviewed": False, "warnings": check_answer(it["answer"], knowledge + it["answer"], acfg)}
            continue
        if have and not args.force:
            continue
        todo.append(it)
    if args.limit:
        todo = todo[: args.limit]

    say(f"{len(todo)} answer(s) to write with {acfg['model']} (effort {acfg.get('effort', 'medium')}); "
        f"{len([it for it in items if it['id'] in answers and it not in todo])} already in {ANSWERS.name}.")
    if not todo:
        write_json(ANSWERS, store)
        return

    system = [{
        "type": "text",
        "text": SYSTEM_RULES.format(min_s=acfg["min_sentences"], max_s=acfg["max_sentences"], max_chars=acfg["max_chars"])
        + "\n\n<knowledge_file>\n" + knowledge + "\n</knowledge_file>",
        "cache_control": {"type": "ephemeral"},
    }]
    client = anthropic.Anthropic()  # credentials come from the environment or the `ant auth login` profile
    failed = 0
    for i, it in enumerate(todo, 1):
        try:
            text, model = write_answer(client, system, it, acfg)
            warn = check_answer(text, knowledge, acfg)
            if warn:  # one more try with the problems spelled out, then keep whatever comes back with its warnings
                text2, model2 = write_answer(client, system, it, acfg, feedback="; ".join(warn))
                warn2 = check_answer(text2, knowledge, acfg)
                if len(warn2) <= len(warn):
                    text, model, warn = text2, model2, warn2
        except RuntimeError as e:
            failed += 1
            say(f"  [{i}/{len(todo)}] {it['id']}: FAILED: {e}")
            if failed >= 3:
                say("stopping after 3 failures")
                break
            continue
        entry = {"question": it["question"], "answer": text, "source": "model", "model": model,
                 "knowledge": k_sha, "reviewed": False, "warnings": warn}
        if it.get("needs_review"):
            entry["needs_review"] = it["needs_review"]
        answers[it["id"]] = entry
        store["updated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        write_json(ANSWERS, store)  # saved after every answer, so a stopped run loses nothing
        flag = f"  WARN: {'; '.join(warn)}" if warn else ""
        say(f"  [{i}/{len(todo)}] {it['id']}: {len(text)} chars{flag}")
    # keep the file in question order
    order = [x["id"] for x in load_questions()]
    store["answers"] = {k: answers[k] for k in order if k in answers} | {k: v for k, v in answers.items() if k not in order}
    write_json(ANSWERS, store)
    say(f"wrote {ANSWERS}. Review and edit it by hand; set \"reviewed\": true on the ones you accept.")
    if failed:
        raise SystemExit(1)


# ---------------------------------------------------------------- Boson client (speech, voices, avatar video)


class BosonError(Exception):
    def __init__(self, status: int, type_: str, message: str, code: str | None = None):
        super().__init__(f"{status} {type_}{f' ({code})' if code else ''}: {message}")
        self.status, self.type, self.code, self.message = status, type_, code, message

    @property
    def busy(self) -> bool:
        """Rejected before any work was done, so trying again cannot double-charge."""
        return self.type == "rate_limit_error" or self.code == "all_replicas_busy" or self.status == 429


class Boson:
    """A minimal client for the three Boson endpoints the bake needs."""

    def __init__(self, key: str, base_url: str):
        import httpx

        self._httpx = httpx
        self._http = httpx.Client(base_url=base_url.rstrip("/"), headers={"Authorization": f"Bearer {key}"},
                                  timeout=httpx.Timeout(180, connect=15))

    def close(self) -> None:
        self._http.close()

    def _request(self, method: str, path: str, **kw: Any) -> Any:
        for attempt in range(3):  # at most two retries, and only for "busy" answers
            try:
                resp = self._http.request(method, path, **kw)
            except self._httpx.HTTPError as e:
                raise BosonError(0, "connection_error", f"{type(e).__name__}: {e}") from None
            if resp.is_success:
                return resp
            try:
                body = resp.json()
                err = body.get("error") if isinstance(body, dict) else None
            except ValueError:
                err = None
            if not isinstance(err, dict):
                err = {"message": resp.text[:300]}
            e = BosonError(resp.status_code, err.get("type") or "api_error", str(err.get("message") or "")[:300], err.get("code"))
            if e.code == "insufficient_quota" or not e.busy or attempt == 2:
                raise e
            delay = float(resp.headers.get("Retry-After") or 0) or (3.0, 8.0)[attempt]
            say(f"    Boson is busy ({e}); waiting {delay:.0f}s")
            time.sleep(min(delay, 30))
        raise AssertionError("unreachable")

    def speech(self, text: str, voice: str, model: str, normalize: bool) -> bytes:
        body: dict[str, Any] = {"model": model, "input": text, "voice": voice, "response_format": "mp3", "stream": False}
        if normalize:
            body["normalize"] = True
        resp = self._request("POST", "/v1/audio/speech", json=body)
        ctype = resp.headers.get("content-type", "")
        if "json" in ctype:  # with timestamps the audio comes back base64 in JSON; handle it in case that becomes the default
            data = resp.json()
            if isinstance(data, dict) and data.get("audio"):
                return base64.b64decode(data["audio"])
            raise BosonError(resp.status_code, "unexpected_response", f"JSON without audio: keys {sorted(data)[:8]}")
        return resp.content

    def create_voice(self, audio: bytes, transcript: str, description: str | None) -> str:
        body: dict[str, Any] = {"ref_audio": base64.b64encode(audio).decode("ascii"), "ref_text": transcript}
        if description:
            body["description"] = description
        data = self._request("POST", "/v1/audio/voices", json=body).json()
        voice = data.get("voice") or data.get("voice_id")  # the schema says one, the guide the other
        if isinstance(voice, dict):
            voice = voice.get("id") or voice.get("voice_id")
        if not voice:
            raise BosonError(200, "unexpected_response", f"no voice id in the response: keys {sorted(data)[:8]}")
        return str(voice)

    def create_video(self, image: bytes, image_mime: str, audio: bytes, size: str, model: str) -> str:
        body = {"model": model, "size": size,
                "ref_image": f"data:{image_mime};base64,{base64.b64encode(image).decode('ascii')}",
                "input": f"data:audio/mpeg;base64,{base64.b64encode(audio).decode('ascii')}"}
        data = self._request("POST", "/v1/videos", json=body).json()
        if not data.get("id"):
            raise BosonError(200, "unexpected_response", f"no video id in the response: keys {sorted(data)[:8]}")
        return str(data["id"])

    def wait_video(self, video_id: str, timeout: float = 600, interval: float = 4) -> dict[str, Any]:
        start = time.monotonic()
        while True:
            info = self._request("GET", f"/v1/videos/{video_id}").json()
            status = info.get("status")
            if status == "completed":
                return info
            if status == "failed":
                raise BosonError(500, "render_failed", str(info.get("error") or info)[:300])
            if time.monotonic() - start > timeout:
                raise BosonError(504, "render_timeout", f"video {video_id} still {status!r} after {timeout:.0f}s")
            time.sleep(interval)

    def video_content(self, video_id: str) -> bytes:
        return self._request("GET", f"/v1/videos/{video_id}/content").content


def read_env_file(path: Path) -> dict[str, str]:
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        out[k.strip().removeprefix("export ").strip()] = v
    return out


def boson_client(args: argparse.Namespace) -> Boson:
    env_path = args.boson_env or os.environ.get("AVATAR_BOSON_ENV")
    env: dict[str, str] = {}
    if env_path:
        p = Path(env_path).expanduser()
        if not p.is_file():
            die(f"Boson env file not found: {p}")
        env = read_env_file(p)
    key = env.get("BOSON_API_KEY") or os.environ.get("BOSON_API_KEY")
    if not key:
        die("no Boson key: pass --boson-env PATH (a .env with BOSON_API_KEY), or set AVATAR_BOSON_ENV or BOSON_API_KEY")
    _SECRETS.append(key)
    base = env.get("BOSON_BASE_URL") or os.environ.get("BOSON_BASE_URL") or BOSON_DEFAULT_URL
    if not base.startswith("https://"):
        die("BOSON_BASE_URL must be https")
    return Boson(key, base)


# ---------------------------------------------------------------- media helpers (ffmpeg)


def ffmpeg_exe() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    import imageio_ffmpeg

    return imageio_ffmpeg.get_ffmpeg_exe()


def media_seconds(path: Path) -> float:
    """Duration from ffmpeg's own probe line."""
    r = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True, errors="replace")
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", r.stderr)
    if not m:
        raise RuntimeError(f"could not read the duration of {path.name}")
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


def video_info(path: Path) -> str:
    r = subprocess.run([ffmpeg_exe(), "-hide_banner", "-i", str(path)], capture_output=True, text=True, errors="replace")
    lines = [ln.strip() for ln in r.stderr.splitlines() if "Stream #" in ln]
    return " | ".join(re.sub(r"\s+", " ", ln.split(": ", 1)[-1]) for ln in lines)


def run_ffmpeg(cmd: list[str]) -> None:
    r = subprocess.run([ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", *cmd], capture_output=True, text=True, errors="replace")
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {r.stderr.strip()[-400:]}")


def make_web_mp4(raw: Path, out: Path, ocfg: dict[str, Any]) -> None:
    """A small MP4 any browser plays inline: H.264 + AAC, yuv420p, moov atom first so it starts before it has loaded."""
    out.parent.mkdir(parents=True, exist_ok=True)
    if not ocfg.get("transcode", True):
        run_ffmpeg(["-i", str(raw), "-c", "copy", "-movflags", "+faststart", str(out)])
        return
    run_ffmpeg(["-i", str(raw), "-vf", f"scale=-2:{int(ocfg['height'])}:flags=lanczos", "-c:v", "libx264", "-profile:v", "main",
                "-pix_fmt", "yuv420p", "-preset", "slow", "-crf", str(int(ocfg["crf"])), "-c:a", "aac", "-ac", "1",
                "-b:a", f"{int(ocfg['audio_kbps'])}k", "-movflags", "+faststart", str(out)])


def make_poster(video: Path, out: Path, ocfg: dict[str, Any]) -> None:
    run_ffmpeg(["-i", str(video), "-frames:v", "1", "-q:v", str(int(ocfg.get("poster_quality", 5))), "-update", "1", str(out)])


def image_meta(data: bytes) -> tuple[str, int | None, int | None]:
    """(mime, width, height) from the file's own bytes."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png", int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", None, None
    if data[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xC0, 0xC1, 0xC2):
                return "image/jpeg", int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                i += 2
                continue
            i += 2 + int.from_bytes(data[i + 2:i + 4], "big")
        return "image/jpeg", None, None
    die("the portrait must be a PNG, JPEG or WebP file")
    raise AssertionError


# ---------------------------------------------------------------- steps B and C: the bake


def clean_for_tts(text: str) -> str:
    """Nothing in an answer may act as a Boson control tag."""
    return re.sub(r"\s+", " ", re.sub(r"<\|.*?\|>", " ", text)).strip()


@dataclass
class Plan:
    item: dict[str, Any]
    text: str  # caption text
    tts_text: str
    audio_key: str
    video_key: str
    key: str
    audio_cached: bool
    video_cached: bool
    done: bool
    est_seconds: float
    tts_usd: float
    avatar_usd: float

    @property
    def usd(self) -> float:
        return self.tts_usd + self.avatar_usd


def out_dir(cfg: dict[str, Any]) -> Path:
    return REPO / cfg["output"]["dir"]


def avatar_rate(cfg: dict[str, Any]) -> float:
    size = cfg["avatar"]["size"]
    rates = cfg["avatar"]["usd_per_minute"]
    if size not in rates:
        die(f"avatar size {size!r} has no price in config.json (known: {', '.join(rates)})")
    return float(rates[size])


def make_plans(cfg: dict[str, Any], items: list[dict[str, Any]], answers: dict[str, Any], portrait_sha: str,
               manifest: dict[str, Any], force: bool) -> list[Plan]:
    t, a, o = cfg["tts"], cfg["avatar"], cfg["output"]
    have = {c["id"]: c for c in manifest.get("clips", [])}
    plans = []
    for it in items:
        ans = answers.get(it["id"])
        if not ans or not ans.get("answer", "").strip():
            continue
        text = re.sub(r"\s+", " ", ans["answer"]).strip()
        tts_text = clean_for_tts(ans.get("say") or text)  # "say" is an optional pronunciation override for the voice only
        audio_key = sha(t["model"], t["voice"], str(bool(t.get("normalize"))), tts_text)
        video_key = sha(audio_key, a["model"], a["size"], portrait_sha)
        key = sha(video_key, text, json.dumps({k: o[k] for k in ("transcode", "height", "crf", "audio_kbps")}, sort_keys=True))
        mp4, jpg = out_dir(cfg) / "clips" / f"{it['id']}.mp4", out_dir(cfg) / "clips" / f"{it['id']}.jpg"
        done = not force and have.get(it["id"], {}).get("key") == key and mp4.exists() and jpg.exists()
        audio_cached = (CACHE / "audio" / f"{audio_key}.mp3").exists()
        video_cached = (CACHE / "video" / f"{video_key}.mp4").exists()
        est = len(tts_text) / float(t["est_chars_per_second"])
        if audio_cached:
            try:
                est = media_seconds(CACHE / "audio" / f"{audio_key}.mp3")
            except RuntimeError:
                pass
        plans.append(Plan(
            item=it, text=text, tts_text=tts_text, audio_key=audio_key, video_key=video_key, key=key,
            audio_cached=audio_cached, video_cached=video_cached, done=done, est_seconds=est,
            tts_usd=0.0 if (done or audio_cached or video_cached) else len(tts_text) / 1000 * float(t["usd_per_1k_chars"]),
            avatar_usd=0.0 if (done or video_cached) else est / 60 * avatar_rate(cfg),
        ))
    return plans


def cues_for(text: str, seconds: float) -> list[dict[str, Any]]:
    """Caption cues: each sentence starts when its share of the characters has been spoken (an estimate)."""
    sents = split_sentences(text)
    total = sum(len(s) for s in sents) or 1
    cues, at = [], 0
    for s in sents:
        cues.append({"t": round(seconds * at / total, 2), "text": s})
        at += len(s)
    return cues


def manifest_entry(p: Plan, seconds: float, mp4: Path | None, jpg: Path | None, cfg: dict[str, Any]) -> dict[str, Any]:
    """One clip for the widget. Without files it is a placeholder: text only, shown with the portrait."""
    it = p.item
    entry: dict[str, Any] = {"id": it["id"], "kind": it["kind"]}
    if it["kind"] == "fallback":
        entry["role"] = it["role"]
    else:
        entry["category"] = it.get("category", "")
        entry["suggested"] = bool(it.get("suggested"))
    entry.update({
        "question": it["question"],
        "paraphrases": it.get("paraphrases", []),
        "keywords": it.get("keywords", []),
        "answer": p.text,
        "cues": cues_for(p.text, seconds) if mp4 else [],
        "file": f"clips/{mp4.name}" if mp4 else None,
        "poster": f"clips/{jpg.name}" if jpg else None,
        "duration": round(seconds, 2),
        "bytes": mp4.stat().st_size if mp4 else 0,
        "sources": it.get("sources", []),
        "key": p.key if mp4 else None,
    })
    return entry


def fill_placeholders(cfg: dict[str, Any], manifest: dict[str, Any], plans: list[Plan]) -> int:
    """Keep the real clips; give every other written answer a text-only entry, or drop those when placeholders are off."""
    real = {c["id"]: c for c in manifest.get("clips", []) if c.get("file")}
    clips, added = list(real.values()), 0
    if manifest.get("placeholders"):
        rate = float(cfg["tts"]["est_chars_per_second"])
        for p in plans:
            if p.item["id"] not in real:
                clips.append(manifest_entry(p, len(p.tts_text) / rate, None, None, cfg))
                added += 1
    manifest["clips"] = clips
    return added


def save_manifest(cfg: dict[str, Any], manifest: dict[str, Any], order: list[str]) -> None:
    rank = {i: n for n, i in enumerate(order)}
    manifest["clips"] = sorted(manifest.get("clips", []), key=lambda c: rank.get(c["id"], 10**6))
    manifest["version"] = 1
    manifest["voice"] = cfg["tts"].get("voice_kind", "preset")  # "preset" or "cloned"; the voice id itself stays out
    manifest["placeholders"] = bool(manifest.get("placeholders"))
    try:  # the still shown when a clip or its poster is missing: the portrait, if the site serves it
        manifest["portrait"] = "/" + (REPO / cfg["avatar"]["portrait"]).resolve().relative_to((REPO / "app" / "public").resolve()).as_posix()
    except ValueError:
        manifest["portrait"] = None
    manifest["total_bytes"] = sum(c.get("bytes", 0) for c in manifest["clips"])
    manifest["generated"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    write_json(out_dir(cfg) / "manifest.json", manifest)


def log_spend(row: dict[str, Any]) -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    with (CACHE / "spend.jsonl").open("a", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps({"at": datetime.now(timezone.utc).isoformat(timespec="seconds"), **row}) + "\n")


def print_plan(plans: list[Plan], cfg: dict[str, Any]) -> float:
    say(f"{'id':<24} {'chars':>5} {'secs':>6} {'tts $':>8} {'video $':>8}  state")
    for p in plans:
        state = "done, skip" if p.done else ("video cached" if p.video_cached else ("audio cached" if p.audio_cached else "to make"))
        say(f"{p.item['id']:<24} {len(p.tts_text):>5} {p.est_seconds:>6.1f} {p.tts_usd:>8.4f} {p.avatar_usd:>8.4f}  {state}")
    total = sum(p.usd for p in plans)
    todo = [p for p in plans if not p.done]
    say(f"\n{len(todo)} clip(s) to make, {len(plans) - len(todo)} already done. Estimated cost: ${total:.4f} "
        f"(TTS ${sum(p.tts_usd for p in plans):.4f} at ${cfg['tts']['usd_per_1k_chars']}/1k chars, "
        f"video ${sum(p.avatar_usd for p in plans):.4f} at ${avatar_rate(cfg)}/min, {cfg['avatar']['size']}). "
        f"Seconds are estimated at {cfg['tts']['est_chars_per_second']} chars/s until the audio exists.")
    return total


def cmd_bake(args: argparse.Namespace) -> None:
    cfg = load_config()
    store = read_json(ANSWERS)
    if not store:
        die(f"no {ANSWERS.name} yet: run the `answers` command first")
    answers = store["answers"]
    all_items = load_questions()
    order = [x["id"] for x in all_items]
    items = pick(all_items, args.only)
    missing = [it["id"] for it in items if it["id"] not in answers]
    if missing:
        say(f"note: no answer written yet for: {', '.join(missing)}")

    portrait = REPO / cfg["avatar"]["portrait"]
    if not portrait.is_file():
        die(f"portrait not found: {portrait}")
    image = portrait.read_bytes()
    if len(image) > 5 * 1024 * 1024:
        die("the portrait is over 5 MB")
    mime, w, h = image_meta(image)
    if w and h and min(w, h) < 512:
        say(f"note: the portrait is {w}x{h}; the render is {cfg['avatar']['size']}, so the face is upscaled. A larger photo will look sharper.")

    manifest = read_json(out_dir(cfg) / "manifest.json", {"clips": []})
    plans = make_plans(cfg, items, answers, sha(image), manifest, args.force)
    pending = [p for p in plans if not p.done]
    if args.limit is not None:
        pending = pending[: args.limit]
    shown = [p for p in plans if p.done] + pending if args.limit is None else pending
    say(f"voice: {cfg['tts'].get('voice_kind', 'preset')} | portrait: {cfg['avatar']['portrait']} | output: {cfg['output']['dir']}/")
    estimate = print_plan(shown, cfg)

    unreviewed = [p.item["id"] for p in pending if not answers[p.item["id"]].get("reviewed")]
    flagged = [p.item["id"] for p in pending if answers[p.item["id"]].get("warnings") or answers[p.item["id"]].get("needs_review")]
    if flagged:
        say(f"answers with warnings or a needs_review note: {', '.join(flagged)}")
    if args.dry_run:
        if unreviewed:
            say(f"{len(unreviewed)} of these answers are not marked \"reviewed\": true in {ANSWERS.name}.")
        say("dry run: nothing was spent.")
        return
    if not pending:
        save_manifest(cfg, manifest, order)
        say("nothing to do.")
        return
    if unreviewed and not args.allow_unreviewed:
        die(f"{len(unreviewed)} answer(s) are not marked \"reviewed\": true in {ANSWERS.name} "
            f"({', '.join(unreviewed[:6])}{'...' if len(unreviewed) > 6 else ''}). Review them, or pass --allow-unreviewed.")
    if estimate > args.max_usd:
        die(f"the estimate (${estimate:.4f}) is over --max-usd {args.max_usd:.2f}. Raise the cap or use --limit.")
    if not args.yes:
        if input(f"Spend up to ${args.max_usd:.2f} of Boson credit on {len(pending)} clip(s)? [y/N] ").strip().lower() != "y":
            die("cancelled", 2)

    boson = boson_client(args)
    spent = 0.0
    made = 0
    rate = avatar_rate(cfg)
    clips = {c["id"]: c for c in manifest.get("clips", [])}
    (CACHE / "audio").mkdir(parents=True, exist_ok=True)
    (CACHE / "video").mkdir(parents=True, exist_ok=True)
    try:
        for n, p in enumerate(pending, 1):
            cid = p.item["id"]
            audio_path = CACHE / "audio" / f"{p.audio_key}.mp3"
            video_path = CACHE / "video" / f"{p.video_key}.mp4"
            say(f"[{n}/{len(pending)}] {cid}")
            try:
                # --- step B: speech
                if not audio_path.exists() and not video_path.exists():
                    cost = len(p.tts_text) / 1000 * float(cfg["tts"]["usd_per_1k_chars"])
                    if spent + cost > args.max_usd:
                        say(f"  stopping: the next call (${cost:.4f}) would pass --max-usd {args.max_usd:.2f} (spent ${spent:.4f})")
                        break
                    t0 = time.monotonic()
                    audio = boson.speech(p.tts_text, cfg["tts"]["voice"], cfg["tts"]["model"], bool(cfg["tts"].get("normalize")))
                    if len(audio) < 1000:
                        raise BosonError(200, "unexpected_response", f"speech returned only {len(audio)} bytes")
                    audio_path.write_bytes(audio)
                    spent += cost
                    log_spend({"clip": cid, "call": "tts", "chars": len(p.tts_text), "usd": round(cost, 5)})
                    say(f"  speech: {len(p.tts_text)} chars, {len(audio) / 1024:.0f} KB, {time.monotonic() - t0:.1f}s, ${cost:.4f}")
                # --- step C: video
                if not video_path.exists():
                    seconds = media_seconds(audio_path)
                    if seconds > float(cfg["avatar"]["max_seconds"]):
                        say(f"  skipped: the audio is {seconds:.1f}s, over {cfg['avatar']['max_seconds']}s (Boson renders at most 60s). Shorten the answer.")
                        continue
                    cost = seconds / 60 * rate
                    if spent + cost > args.max_usd:
                        say(f"  stopping: the next call (${cost:.4f}) would pass --max-usd {args.max_usd:.2f} (spent ${spent:.4f})")
                        break
                    t0 = time.monotonic()
                    vid = boson.create_video(image, mime, audio_path.read_bytes(), cfg["avatar"]["size"], cfg["avatar"]["model"])
                    spent += cost  # counted once the render is accepted, from the audio length
                    log_spend({"clip": cid, "call": "avatar", "audio_seconds": round(seconds, 2), "size": cfg["avatar"]["size"], "usd_estimate": round(cost, 5)})
                    info = boson.wait_video(vid)
                    extra = {k: info[k] for k in ("seconds", "duration", "size", "usage", "cost") if k in info}
                    video = boson.video_content(vid)
                    if len(video) < 10_000 or video[4:8] != b"ftyp":
                        raise BosonError(200, "unexpected_response", f"video content is not an MP4 ({len(video)} bytes)")
                    video_path.write_bytes(video)
                    vsecs = media_seconds(video_path)  # the container's own length; an MP3's can be an estimate
                    actual = vsecs / 60 * rate
                    spent += actual - cost
                    log_spend({"clip": cid, "call": "avatar_done", "video_seconds": round(vsecs, 2), "usd": round(actual, 5)})
                    say(f"  video: {vsecs:.1f}s, raw {len(video) / 1024:.0f} KB, rendered in {time.monotonic() - t0:.0f}s, ${actual:.4f}"
                        + (f", api says {extra}" if extra else ""))
                    say(f"  raw streams: {video_info(video_path)}")
                # --- web files
                mp4, jpg = out_dir(cfg) / "clips" / f"{cid}.mp4", out_dir(cfg) / "clips" / f"{cid}.jpg"
                make_web_mp4(video_path, mp4, cfg["output"])
                make_poster(mp4, jpg, cfg["output"])
                seconds = media_seconds(mp4)
                clips[cid] = manifest_entry(p, seconds, mp4, jpg, cfg)
                manifest["clips"] = list(clips.values())  # placeholders of clips not made yet stay as they are
                save_manifest(cfg, manifest, order)  # after every clip, so a stopped run resumes where it was
                made += 1
                say(f"  web: {mp4.name} {mp4.stat().st_size / 1024:.0f} KB ({seconds:.1f}s, {video_info(mp4)}), poster {jpg.stat().st_size / 1024:.0f} KB")
            except BosonError as e:
                # no retry loop: record exactly what the API said and stop, so a wrong assumption cannot burn credit
                say(f"  Boson error on {cid}: {e}")
                log_spend({"clip": cid, "call": "error", "error": redact(str(e))})
                break
            except RuntimeError as e:
                say(f"  failed on {cid}: {e}")
                break
    finally:
        boson.close()
    manifest["clips"] = list(clips.values())
    fill_placeholders(cfg, manifest, make_plans(cfg, all_items, answers, sha(image), manifest, False))
    save_manifest(cfg, manifest, order)
    total_bytes = sum(c.get("bytes", 0) for c in manifest["clips"])
    baked = {c["id"]: c for c in manifest["clips"] if c.get("file")}
    say(f"\nmade {made} clip(s); estimated spend this run ${spent:.4f} (from the published rates, not a bill). "
        f"{len(baked)} clip(s) in the manifest, {total_bytes / 1e6:.2f} MB of video.")
    secs = sum(c["duration"] for c in baked.values())
    if made and secs:
        chars = sum(len(c["answer"]) for c in baked.values())
        rest = sum(len(answers[x["id"]]["answer"]) for x in all_items if x["id"] in answers and x["id"] not in baked)
        all_secs = secs + rest / (chars / secs)
        say(f"measured: {total_bytes / secs / 1024:.1f} KB per second of video, {chars / secs:.1f} characters per second of speech. "
            f"All {len(baked) + sum(1 for x in all_items if x['id'] in answers and x['id'] not in baked)} clips would be about "
            f"{all_secs / 60:.1f} minutes and {total_bytes / secs * all_secs / 1e6:.0f} MB.")


def cmd_manifest(args: argparse.Namespace) -> None:
    """Rebuild manifest.json from questions.json, answers.json and the clips on disk (no API calls)."""
    cfg = load_config()
    answers = (read_json(ANSWERS) or {"answers": {}})["answers"]
    items = load_questions()
    manifest = read_json(out_dir(cfg) / "manifest.json", {"clips": []})
    old = {c["id"]: c for c in manifest.get("clips", [])}
    portrait = REPO / cfg["avatar"]["portrait"]
    plan_list = make_plans(cfg, items, answers, sha(portrait.read_bytes()), manifest, False)
    plans = {p.item["id"]: p for p in plan_list}
    clips = []
    for it in items:
        mp4, jpg = out_dir(cfg) / "clips" / f"{it['id']}.mp4", out_dir(cfg) / "clips" / f"{it['id']}.jpg"
        p = plans.get(it["id"])
        if not (p and mp4.exists() and jpg.exists()):
            continue
        entry = manifest_entry(p, media_seconds(mp4), mp4, jpg, cfg)
        if old.get(it["id"], {}).get("key") != p.key:
            # the clip on disk was made from other text or settings: keep what was actually spoken as the caption
            prev = old.get(it["id"])
            if prev:
                entry.update({k: prev[k] for k in ("answer", "cues", "key") if k in prev})
            say(f"note: {it['id']} is stale (answer or settings changed since it was baked)")
        clips.append(entry)
    manifest["clips"] = clips
    manifest["placeholders"] = bool(args.placeholders)
    added = fill_placeholders(cfg, manifest, plan_list)
    save_manifest(cfg, manifest, [x["id"] for x in items])
    say(f"wrote {out_dir(cfg) / 'manifest.json'} with {len(clips)} clip(s)"
        + (f" and {added} text-only placeholder(s)" if args.placeholders else ""))


def cmd_status(args: argparse.Namespace) -> None:
    cfg = load_config()
    answers = (read_json(ANSWERS) or {"answers": {}})["answers"]
    items = load_questions()
    manifest = read_json(out_dir(cfg) / "manifest.json", {"clips": []})
    portrait = REPO / cfg["avatar"]["portrait"]
    plans = {p.item["id"]: p for p in make_plans(cfg, items, answers, sha(portrait.read_bytes()), manifest, False)}
    baked = {c["id"] for c in manifest.get("clips", []) if c.get("file")}
    k_sha = sha(knowledge_text())
    say(f"{'id':<24} {'answer':<10} {'reviewed':<9} {'clip':<8} notes")
    for it in items:
        a = answers.get(it["id"])
        p = plans.get(it["id"])
        clip = "current" if p and p.done else ("stale" if it["id"] in baked else "-")
        notes = []
        if a and a.get("warnings"):
            notes.append("; ".join(a["warnings"]))
        if a and a.get("needs_review"):
            notes.append("needs a hand-written answer")
        if a and a.get("source") == "model" and a.get("knowledge") != k_sha:
            notes.append("knowledge.md changed since this was written")
        say(f"{it['id']:<24} {(a or {}).get('source', '-'):<10} {str(bool(a and a.get('reviewed'))).lower():<9} {clip:<8} {' | '.join(notes)}")
    say(f"\n{len(answers)} answers, {len(baked)} clips, {manifest.get('total_bytes', 0) / 1e6:.2f} MB of video")


def cmd_clone_voice(args: argparse.Namespace) -> None:
    if not args.consent:
        die("voice cloning needs --consent: pass it only if this is your own voice, or you hold the speaker's "
            "permission to clone it. Boson requires that right.")
    audio = Path(args.audio).expanduser()
    if not audio.is_file():
        die(f"audio file not found: {audio}")
    if audio.suffix.lower() not in VOICE_FORMATS:
        die(f"Boson accepts {', '.join(sorted(VOICE_FORMATS))} for cloning; convert {audio.suffix or 'this file'} first")
    data = audio.read_bytes()
    if len(data) > 10 * 1024 * 1024:
        die("the recording is over 10 MB")
    transcript = (Path(args.transcript).expanduser().read_text(encoding="utf-8") if args.transcript else args.text or "").strip()
    transcript = re.sub(r"\s+", " ", transcript)
    if not transcript:
        die("give the exact words spoken in the recording with --transcript FILE or --text \"...\"")
    try:
        secs = media_seconds(audio)
        if secs < 3:
            die(f"the recording is {secs:.1f}s; at least 3s is needed and 10 to 30s is best")
        say(f"recording: {secs:.1f}s, {len(data) / 1024:.0f} KB, {len(transcript.split())} words in the transcript")
    except RuntimeError:
        say("note: could not read the recording's length; sending it as it is")
    boson = boson_client(args)
    try:
        voice = boson.create_voice(data, transcript, args.name)
    except BosonError as e:
        die(f"Boson refused the voice: {e}")
    finally:
        boson.close()
    write_json(LOCAL, {"voice": voice, "voice_kind": "cloned", "name": args.name or "", "created": datetime.now(timezone.utc).isoformat(timespec="seconds")})
    say(f"voice registered. Its id is saved in {LOCAL.name} (gitignored) and will be used by `bake` from now on.")
    say("every clip made with the old voice is now stale and will be re-made on the next bake.")


def main() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser(description="Bake the avatar's answers, speech and lip-synced clips.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("answers", help="step A: write answers.json with Claude (no Boson credit)")
    a.add_argument("--only", help="comma-separated question ids")
    a.add_argument("--limit", type=int, help="write at most N answers")
    a.add_argument("--force", action="store_true", help="rewrite answers that already exist (hand edits are lost)")
    a.set_defaults(fn=cmd_answers)

    b = sub.add_parser("bake", help="steps B and C: speech, video, web files, manifest")
    b.add_argument("--only", help="comma-separated ids, baked in the order given")
    b.add_argument("--limit", type=int, help="make at most N clips")
    b.add_argument("--dry-run", action="store_true", help="print the plan and the cost estimate, spend nothing")
    b.add_argument("--max-usd", type=float, default=0.50, help="hard cap on this run's estimated Boson spend (default 0.50)")
    b.add_argument("--yes", action="store_true", help="do not ask before spending")
    b.add_argument("--allow-unreviewed", action="store_true", help="bake answers not marked \"reviewed\": true")
    b.add_argument("--force", action="store_true", help="re-make clips that are already current")
    b.add_argument("--boson-env", help="path to a .env file holding BOSON_API_KEY (and optionally BOSON_BASE_URL)")
    b.set_defaults(fn=cmd_bake)

    c = sub.add_parser("clone-voice", help="register a cloned voice from a recording and its exact transcript")
    c.add_argument("--audio", required=True, help="wav, mp3, flac, opus or pcm; 10 to 30 s of clear speech, under 10 MB")
    c.add_argument("--transcript", help="text file with exactly what is said in the recording")
    c.add_argument("--text", help="the transcript on the command line instead of a file")
    c.add_argument("--name", help="a description for the voice")
    c.add_argument("--consent", action="store_true", help="required: you own this voice or hold permission to clone it")
    c.add_argument("--boson-env", help="path to a .env file holding BOSON_API_KEY")
    c.set_defaults(fn=cmd_clone_voice)

    m = sub.add_parser("manifest", help="rebuild manifest.json from the files on disk")
    m.add_argument("--placeholders", action="store_true", help="also list written answers that have no clip yet, as text only")
    m.set_defaults(fn=cmd_manifest)
    s = sub.add_parser("status", help="show answers, reviews and clips")
    s.set_defaults(fn=cmd_status)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
