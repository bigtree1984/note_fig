"""
公開する前に、公開してはいけない言葉が混ざっていないか調べる。

作者の手元には、非公開の案件や他人の情報を含むフォルダが隣にある。
コピーや書き換えの途中で混ざっても気づけるよう、公開物の全テキストを検査する。

使い方:
    python3 scripts/publish_check.py              # リポジトリ全体
禁止語は環境変数 NOTE_FIG_FORBIDDEN（カンマ区切り）か、
リポジトリの外のファイル ~/.note_fig_forbidden（1行1語）に置く。
禁止語そのものを公開物に書かないため、このファイルには入れない。
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEXT = {".md", ".json", ".js", ".css", ".py", ".html", ".txt", ".yml", ".yaml"}


def forbidden_words():
    words = [w.strip() for w in os.environ.get("NOTE_FIG_FORBIDDEN", "").split(",") if w.strip()]
    f = Path.home() / ".note_fig_forbidden"
    if f.exists():
        words += [w.strip() for w in f.read_text(encoding="utf-8").splitlines() if w.strip() and not w.startswith("#")]
    return words


def tracked_files():
    r = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"],
                       cwd=ROOT, capture_output=True, text=True)
    return [ROOT / p for p in r.stdout.splitlines()]


def main():
    words = forbidden_words()
    if not words:
        sys.exit("禁止語が設定されていません（NOTE_FIG_FORBIDDEN か ~/.note_fig_forbidden）")
    hits = 0
    for f in tracked_files():
        if f.suffix.lower() not in TEXT or not f.exists():
            continue
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            for w in words:
                if w.lower() in line.lower():
                    print(f"✗ {f.relative_to(ROOT)}:{n}  「{w}」")
                    hits += 1
    print(f"{len(words)}語を検査 ／ {hits}件")
    sys.exit(1 if hits else 0)


if __name__ == "__main__":
    main()
