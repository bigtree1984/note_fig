---
name: note-fig
description: note（note.com）の記事に、スマホで読める挿絵（表・比較・流れ・手順・時系列・棒グラフ・折れ線・構成比・大きな数字・要点・スクショ枠）を入れる。記事の下書きやURLを渡されて「挿絵を入れたい」「図を作って」「読みやすくしたい」「グラフにして」と頼まれたとき、またはnote用の図解・画像を作るときに使う。Figma不要。JSONを書いてPNGに書き出し、スマホでの文字の大きさを自動で検査する。
---

# note-fig

このスキルのフォルダから**2つ上の階層がリポジトリの根**（以下 `ROOT`）。
`ROOT/PLAYBOOK.md` が手順の正。**作業を始める前に必ず全文を読む。**

## 読む順番

1. `ROOT/PLAYBOOK.md` — 流れと【変えない】【先に聞く】
2. `ROOT/docs/CATALOG.md` — 型の選び方と JSON の書き方
3. 必要になったら `ROOT/docs/FIGURE_RULES.md` — 数値の根拠

## 要点（PLAYBOOK の要約。食い違ったら PLAYBOOK が正）

- 作る前に【先に聞く】3点（記事の場所・配色・置き場所）を確認する
- 図を入れる場所を**表で提案し、承認されてから**作る。1記事3〜6枚
- 図の中の数字と固有名詞は本文から取る。作らない
- 書き出し：`python3 ROOT/scripts/render.py <figsフォルダ> --preview`
- error は必ず直す。PNG は画像として自分でも見る
- `_preview.html`（スマホ実寸と PC 実寸）を利用者に見せてから終える
- 文字サイズ・28字・3列・主役1か所は【変えない】。理由はスマホでは0.277倍に縮むから

## 必要なもの

Python 3.9 以上と Google Chrome（Chromium / Edge でも可）。pip で入れるものはない。
Chrome が見つからないときは `--chrome` か環境変数 `NOTE_FIG_CHROME` で場所を渡す。
