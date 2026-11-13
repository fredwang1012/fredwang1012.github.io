"""Read the answers the live service has kept, and decide which may be replayed to visitors.

The service keeps every answer to a question that stands on its own, but serves a kept answer to other visitors
only once it is on the approved list. The model gets a detail wrong in roughly one answer in nine, so each one is
read first. This lists the ones waiting, approves them, or removes them.

    py -3.12 tools/avatar/review_store.py list                 the kept answers not yet approved, to read
    py -3.12 tools/avatar/review_store.py approve [--except FILE]
                                                               approve every waiting answer, except the questions
                                                               listed in FILE (one per line); those are removed
    py -3.12 tools/avatar/review_store.py forget FILE          remove the answers to the questions in FILE
    py -3.12 tools/avatar/review_store.py status               counts only

It runs wrangler from live/, so `npx wrangler login` must have been done on this machine.
"""
import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

LIVE = Path(__file__).resolve().parent.parent.parent / "live"


def wrangler(*args: str, check: bool = True) -> str:
    r = subprocess.run(["npx", "--yes", "wrangler@4", *args], cwd=LIVE, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", shell=sys.platform == "win32")
    if check and r.returncode != 0:
        sys.exit(f"wrangler {' '.join(args[:3])} failed:\n{(r.stderr or r.stdout)[-600:]}")
    return r.stdout


def shelf() -> str:
    m = re.search(r'"STORE_SHELF"\s*:\s*"([A-Za-z0-9_-]+)"', (LIVE / "wrangler.jsonc").read_text(encoding="utf-8"))
    return m.group(1) if m else sys.exit("no STORE_SHELF in live/wrangler.jsonc")


def kept(name: str) -> list[dict]:
    """Every kept answer on the shelf: {"key", "hash", "q", "text"}."""
    out = wrangler("kv", "key", "list", "--binding", "ANSWERS", "--remote", "--prefix", f"a:{name}:")
    rows = json.loads(out[out.index("["):])
    return [{"key": r["name"], "hash": r["name"].split(":")[2], "q": (r.get("metadata") or {}).get("q", ""),
             "text": (r.get("metadata") or {}).get("text", "")} for r in rows]


def approved(name: str) -> list[str]:
    out = wrangler("kv", "key", "get", f"ok:{name}", "--binding", "ANSWERS", "--remote", check=False)
    try:
        value = json.loads(out[out.index("["):])
        return [h for h in value if isinstance(h, str)]
    except ValueError:
        return []


def write_approved(name: str, hashes: list[str]) -> None:
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "ok.json"
        path.write_text(json.dumps(sorted(set(hashes))), encoding="utf-8")
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
    waiting = [r for r in rows if r["hash"] not in ok]
    if args.command == "status":
        print(f"shelf {name}: {len(rows)} kept, {len(rows) - len(waiting)} approved, {len(waiting)} waiting to be read")
    elif args.command == "list":
        for n, r in enumerate(waiting, 1):
            print(f"{n}. {r['q']}\n   {r['text']}")
        print(f"\n{len(waiting)} waiting; {len(rows) - len(waiting)} approved")
    elif args.command == "approve":
        bad = questions_in(args.except_file) if args.except_file else set()
        unknown = bad - {r["q"].lower() for r in waiting}
        if unknown:
            sys.exit("not among the waiting answers (check the spelling): " + "; ".join(sorted(unknown)))
        remove([r for r in waiting if r["q"].lower() in bad])
        good = [r["hash"] for r in waiting if r["q"].lower() not in bad]
        have = {r["hash"] for r in rows}
        write_approved(name, [h for h in ok if h in have] + good)   # an approval outlives its answer no longer
        print(f"approved {len(good)}; removed {len(waiting) - len(good)}")
    elif args.command == "forget":
        bad = questions_in(args.file)
        gone = [r for r in rows if r["q"].lower() in bad]
        remove(gone)
        write_approved(name, [h for h in ok if h not in {r["hash"] for r in gone}])
    return 0


if __name__ == "__main__":
    sys.exit(main())
