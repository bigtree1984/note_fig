"""
挿絵の JSON を PNG に書き出す。あわせて「スマホで読めるか」を検査する。

依存: Python 3.9 以上と Google Chrome（または Chromium / Edge）だけ。
pip で入れるものはない。ブラウザのダウンロードも不要。

使い方:
    python3 scripts/render.py figs/01_compare.json            # → figs/01_compare.png
    python3 scripts/render.py figs/                            # フォルダ内の *.json をすべて
    python3 scripts/render.py figs/ --preview                  # 加えて確認ページ figs/_preview.html を作る
    python3 scripts/render.py figs/ --brand ~/my-note-brand    # 自分のブランドで描く

ブランドの決まり方（上が優先）:
    --brand  >  環境変数 NOTE_FIG_BRAND  >  同梱の見本 bigtree/

仕様:
  - CSS 1240px 幅 × 2倍 → 幅 2480px の PNG（note は 1200px 前後で配信するので劣化しない）
  - 高さは図の中身に合わせる
  - 検査で error が出たら、PNG は書き出すが終了コード 1 を返す
"""

import argparse
import glob
import html
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENGINE = ROOT / "engine"
DEFAULT_BRAND = ROOT / "bigtree"
CSS_WIDTH = 1240
SCALE = 2
SP, PC = 343, 620          # note の本文画像の表示幅（スマホ 375pt 端末 / PC）
MAX_ASPECT = 1.6           # これより縦長だと PC で本文の流れを止める

CHROME_CANDIDATES = {
    "Darwin": [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ],
    "Windows": [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ],
    "Linux": [],
}


def find_chrome(explicit):
    if explicit:
        return explicit
    if os.environ.get("NOTE_FIG_CHROME"):
        return os.environ["NOTE_FIG_CHROME"]
    for p in CHROME_CANDIDATES.get(platform.system(), []):
        if os.path.exists(p):
            return p
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome", "msedge"):
        p = shutil.which(name)
        if p:
            return p
    sys.exit("Chrome が見つかりません。--chrome か環境変数 NOTE_FIG_CHROME で実行ファイルの場所を指定してください。")


def resolve_brand(arg):
    b = Path(os.path.expanduser(arg or os.environ.get("NOTE_FIG_BRAND") or DEFAULT_BRAND)).resolve()
    if not (b / "tokens.css").exists():
        sys.exit(f"ブランドのフォルダに tokens.css がありません: {b}")
    return b


def build_html(spec, spec_path, brand):
    spec = dict(spec)
    if spec.get("src") and not re.match(r"^(https?|file|data):", spec["src"]):
        img = (spec_path.parent / spec["src"]).resolve()
        if not img.exists():
            print(f"  ⚠ 画像が見つかりません: {img}")
        spec["src"] = img.as_uri()
    data = json.dumps(spec, ensure_ascii=False).replace("</", "<\\/")
    return f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<title>{html.escape(spec.get("title") or spec_path.stem)}</title>
<link rel="stylesheet" href="{(brand / "tokens.css").as_uri()}">
<link rel="stylesheet" href="{(ENGINE / "note.css").as_uri()}">
<link rel="stylesheet" href="{(ENGINE / "figure.css").as_uri()}">
{f'<link rel="stylesheet" href="{(brand / "figure.css").as_uri()}">' if (brand / "figure.css").exists() else ""}
<script>window.FIGURE_SPEC = {data};</script>
<script src="{(ENGINE / "organisms.js").as_uri()}"></script>
</head><body>
<div class="figure-root" id="fig"></div>
<pre id="note-fig-lint" hidden></pre>
</body></html>
"""


def chrome(binary, args):
    base = [binary, "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--allow-file-access-from-files", "--virtual-time-budget=8000"]
    return subprocess.run(base + args, capture_output=True, text=True, timeout=120)


def render_one(spec_path, out_png, brand, binary, workdir):
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    page = workdir / (spec_path.stem + ".html")
    page.write_text(build_html(spec, spec_path, brand), encoding="utf-8")

    # 1回目: 描いて検査結果と図の寸法を受け取る
    r = chrome(binary, [f"--window-size={CSS_WIDTH},4000", "--dump-dom", page.as_uri()])
    m = re.search(r'<pre id="note-fig-lint"[^>]*>(.*?)</pre>', r.stdout, re.S)
    if not m or not m.group(1).strip():
        sys.exit(f"描画に失敗しました: {spec_path}\n{r.stderr[-800:]}")
    lint = json.loads(html.unescape(m.group(1)))

    # 2回目: 図の高さぴったりで撮る
    height = max(lint["height"], 1)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    if out_png.exists():
        out_png.unlink()
    chrome(binary, [f"--force-device-scale-factor={SCALE}", f"--window-size={CSS_WIDTH},{height}",
                    f"--screenshot={out_png}", page.as_uri()])
    if not out_png.exists():
        sys.exit(f"書き出しに失敗しました: {out_png}")

    w, h = lint["width"], height
    aspect = h / w
    issues = list(lint["issues"])
    if aspect > MAX_ASPECT:
        issues.append({"level": "warn", "rule": "aspect",
                       "msg": f"縦横比 {aspect:.2f}。{MAX_ASPECT} を超えると PC で本文の流れを止める（項目を減らすか2枚に分ける）"})
    print(f"✓ {out_png}")
    print(f"    {w * SCALE}×{h * SCALE}px ／ PC {PC}×{round(h * PC / w)}pt ／ スマホ {SP}×{round(h * SP / w)}pt")
    for it in issues:
        mark = "✗" if it["level"] == "error" else "⚠"
        print(f"    {mark} [{it['rule']}] {it['msg']}")
    return {"spec": spec_path, "png": out_png, "page": page, "w": w, "h": h, "issues": issues, "spec_data": spec}


PREVIEW_CSS = """
body{margin:0;font-family:system-ui,-apple-system,"Hiragino Sans",sans-serif;background:#f4f4f2;color:#222}
header{padding:20px 24px;background:#fff;border-bottom:1px solid #ddd;position:sticky;top:0;z-index:2}
header h1{margin:0;font-size:18px} header p{margin:4px 0 0;font-size:13px;color:#666}
section{background:#fff;margin:24px;padding:20px 24px;border-radius:12px;border:1px solid #e3e3e0}
section h2{margin:0 0 4px;font-size:16px} .meta{font-size:12px;color:#777;margin-bottom:14px}
.row{display:flex;gap:40px;align-items:flex-start;flex-wrap:wrap}
.cap{font-size:12px;color:#666;margin-bottom:6px}
.phone{background:#fff;border:1px solid #ccc;border-radius:24px;padding:16px;width:343px}
.phone p{font-size:16px;line-height:2;margin:0 0 8px;color:#333}
.vp{overflow:hidden;outline:1px dashed #ccc} iframe{border:0;transform-origin:0 0;display:block}
ul.issues{margin:12px 0 0;padding-left:20px;font-size:13px} .error{color:#b00020} .warn{color:#8a5a00}
.ok{color:#2e7d32;font-size:13px;margin-top:12px}
"""


def write_preview(results, path, brand):
    blocks = []
    for r in results:
        rel = os.path.relpath(r["page"], path.parent)
        frame = lambda scale: (f'<div class="vp" style="width:{round(r["w"]*scale)}px;height:{round(r["h"]*scale)}px">'
                               f'<iframe src="{html.escape(rel)}" style="width:{r["w"]}px;height:{r["h"]}px;transform:scale({scale:.4f})"></iframe></div>')
        issues = "".join(f'<li class="{i["level"]}">[{i["rule"]}] {html.escape(i["msg"])}</li>' for i in r["issues"])
        blocks.append(f"""<section id="{html.escape(r['spec'].stem)}">
<h2>{html.escape(r['spec'].name)}</h2>
<div class="meta">type: {html.escape(str(r['spec_data'].get('type')))} ／ PNG: {html.escape(os.path.relpath(r['png'], path.parent))}</div>
<div class="row">
  <div><div class="cap">スマホ（343pt。本文16pxと並べて比べる）</div>
    <div class="phone"><p>本文はこの大きさで表示されます。図の文字がこれより極端に小さくないか見てください。</p>{frame(SP / r["w"])}</div></div>
  <div><div class="cap">PC（620pt）</div>{frame(PC / r["w"])}</div>
</div>
{f'<ul class="issues">{issues}</ul>' if issues else '<div class="ok">✓ 検査で問題なし</div>'}
</section>""")
    path.write_text(f"""<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>挿絵の確認</title>
<style>{PREVIEW_CSS}</style></head><body>
<header><h1>挿絵の確認（{len(results)}枚）</h1><p>ブランド: {html.escape(str(brand))}　—　気になる図はファイル名で指してください。</p></header>
{''.join(blocks)}
</body></html>""", encoding="utf-8")
    print(f"\n確認ページ: {path}")


def main():
    ap = argparse.ArgumentParser(description="挿絵の JSON を PNG に書き出す")
    ap.add_argument("inputs", nargs="+", help="JSON ファイル、または JSON の入ったフォルダ")
    ap.add_argument("--out", help="PNG の出力先フォルダ（既定: JSON と同じ場所）")
    ap.add_argument("--brand", help="ブランドのフォルダ（tokens.css を含む）")
    ap.add_argument("--chrome", help="Chrome の実行ファイル")
    ap.add_argument("--preview", action="store_true", help="スマホ／PC の見え方を並べた確認ページを作る")
    a = ap.parse_args()

    specs = []
    for p in a.inputs:
        p = Path(p)
        specs += sorted(Path(x) for x in glob.glob(str(p / "*.json"))) if p.is_dir() else [p]
    specs = [s for s in specs if not s.name.startswith("_")]
    if not specs:
        sys.exit("JSON が見つかりません")

    brand = resolve_brand(a.brand)
    binary = find_chrome(a.chrome)
    first = specs[0].resolve().parent
    out_dir = Path(a.out).resolve() if a.out else None
    # 中間の HTML は記事のフォルダを汚さないよう一時フォルダに置く。--preview のときだけ残す
    workdir = Path(tempfile.mkdtemp(prefix="note_fig_")) if not a.preview else (out_dir or first) / "_build"
    workdir.mkdir(parents=True, exist_ok=True)

    results = []
    for s in specs:
        s = s.resolve()
        png = (out_dir or s.parent) / (s.stem + ".png")
        results.append(render_one(s, png, brand, binary, workdir))

    if a.preview:
        write_preview(results, (out_dir or first) / "_preview.html", brand)
    errors = sum(1 for r in results for i in r["issues"] if i["level"] == "error")
    warns = sum(1 for r in results for i in r["issues"] if i["level"] == "warn")
    print(f"\n{len(results)}枚 ／ error {errors} ／ warn {warns}")
    if not a.preview:
        shutil.rmtree(workdir, ignore_errors=True)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
