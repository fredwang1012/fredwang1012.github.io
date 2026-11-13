"""Read the answers the live service has kept, and decide which may be replayed to visitors.

The service keeps every answer to a question that stands on its own, but serves a kept answer to other visitors
only once it is on the approved list. The model gets a detail wrong in roughly one answer in nine, so each one is
read first. This lists the ones waiting, approves them, or removes them.

    py -3.12 tools/avatar/review_store.py list                 the kept answers not yet approved, to read
    py -3.12 tools/avatar/review_store.py approve [--except FILE]
                                                               approve the answers `list` last showed, except the
                                                               questions in FILE (one per line); those are removed
    py -3.12 tools/avatar/review_store.py forget FILE          remove the answers to the questions in FILE
    py -3.12 tools/avatar/review_store.py status               counts only

An approval is for the words that were read: `list` records exactly what it showed, and `approve` covers those
answers only, and only if their words are still the same. An answer kept after `list` ran, or made again since,
stays waiting until it has been listed and read.

It runs wrangler from live/, so `npx wrangler login` must have been done on this machine.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIVE = HERE.parent.parent / "live"
SHOWN = HERE / ".cache" / "review-shown.json"   # what `list` last showed: the only answers `approve` will approve


def wrangler(*args: str, check: bool = True) -> str:
    r = subprocess.run(["npx", "--yes", "wrangler@4", *args], cwd=LIVE, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", shell=sys.platform == "win32")
    if check and r.returncode != 0:
        sys.exit(f"wrangler {' '.join(args[:3])} failed:\n{(r.stderr or r.stdout)[-600:]}")
    return r.stdout


def shelf() -> str:
    m = re.search(r'"STORE_SHELF"\s*:\s*"([A-Za-z0-9_-]+)"', (LIVE / "wrangler.jsonc").read_text(encoding="utf-8"))
    return m.group(1) if m else sys.exit("no STORE_SHELF in live/wrangler.jsonc")


def text_tag(text: str) -> str:
    """The same tag as textTag in live/src/index.js: which words an approval is for."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def kept(name: str) -> list[dict]:
    """Every kept answer on the shelf: {"key", "id", "q", "text"}; id is "<question hash>.<text hash>"."""
    out = wrangler("kv", "key", "list", "--binding", "ANSWERS", "--remote", "--prefix", f"a:{name}:")
    rows = json.loads(out[out.index("["):])
    result = []
    for r in rows:
        meta = r.get("metadata") or {}
        text = meta.get("text", "")
        result.append({"key": r["name"], "id": f"{r['name'].split(':')[2]}.{text_tag(text)}", "q": meta.get("q", ""), "text": text})
    return result


def approved(name: str) -> list[str]:
    out = wrangler("kv", "key", "get", f"ok:{name}", "--binding", "ANSWERS", "--remote", check=False)
    try:
        value = json.loads(out[out.index("["):])
        return [h for h in value if isinstance(h, str)]
    except ValueError:
        return []


def write_approved(name: str, ids: list[str]) -> None:
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "ok.json"
        path.write_text(json.dumps(sorted(set(ids))), encoding="utf-8")
        wrangler("kv", "key", "put", f"ok:{name}", "--path", str(path), "--binding", "ANSWERS", "--remote")


def questions_in(path: str) -> set[str]:
    return {line.strip().lower() for line in Path(path).read_text(encoding="utf-8").splitlines() if line.strip()}


def remove(rows: list[dict]) -> None:
    for r in rows:
        wrangler("kv", "key", "delete", r["key"], "--binding", "ANSWERS", "--remote", check=False)
        print(f"removed: {r['q']}")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("list")
    sub.add_parser("status")
    a = sub.add_parser("approve")
    a.add_argument("--except", dest="except_file", help="questions (one per line) whose answers are removed instead")
    f = sub.add_parser("forget")
    f.add_argument("file", help="questions (one per line) whose answers are removed")
    args = ap.parse_args()

    name = shelf()
    rows, ok = kept(name), set(approved(name))
    waiting = [r for r in rows if r["id"] not in ok]
    if args.command == "status":
        print(f"shelf {name}: {len(rows)} kept, {len(rows) - len(waiting)} approved, {len(waiting)} waiting to be read")
    elif args.command == "list":
        for n, r in enumerate(waiting, 1):
            print(f"{n}. {r['q']}\n   {r['text']}")
        SHOWN.parent.mkdir(parents=True, exist_ok=True)
        SHOWN.write_text(json.dumps({"shelf": name, "ids": [r["id"] for r in waiting]}), encoding="utf-8")
        print(f"\n{len(waiting)} waiting; {len(rows) - len(waiting)} approved")
    elif args.command == "approve":
        try:
            shown = json.loads(SHOWN.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            sys.exit("run `list` first and read what it shows: `approve` covers only those answers")
        if shown.get("shelf") != name:
            sys.exit("the last `list` was for another shelf; run `list` again")
        read = set(shown["ids"])
        mine = [r for r in waiting if r["id"] in read]       # shown, and still the same words
        later = len(waiting) - len(mine)                     # kept or remade since: not read, so not approved
        bad = questions_in(args.except_file) if args.except_file else set()
        unknown = bad - {r["q"].lower() for r in mine}
        if unknown:
            sys.exit("not among the answers `list` showed (check the spelling): " + "; ".join(sorted(unknown)))
        remove([r for r in mine if r["q"].lower() in bad])
        good = [r["id"] for r in mine if r["q"].lower() not in bad]
        have = {r["id"] for r in rows}
        write_approved(name, [i for i in ok if i in have] + good)   # an approval does not outlive its answer
        SHOWN.unlink(missing_ok=True)
        print(f"approved {len(good)}; removed {len(mine) - len(good)}" + (f"; {later} kept since the list was made are still waiting" if later else ""))
    elif args.command == "forget":
        bad = questions_in(args.file)
        gone = [r for r in rows if r["q"].lower() in bad]
        remove(gone)
        write_approved(name, [i for i in ok if i not in {r["id"] for r in gone}])
    return 0


if __name__ == "__main__":
    sys.exit(main())
