# Organism カタログ

挿絵は **JSON を1つ書くと1枚できる**。JSON の `type` で Organism（図の型）を選ぶ。
見本は `bigtree/samples/` にすべての型が1つずつある。迷ったら見本を写して書き換える。

## 共通の項目

| 項目 | 必須 | 意味 |
|---|---|---|
| `type` | ○ | 下の表のどれか |
| `title` | | 図の上に出す見出し。**本文の見出しと同じ言葉なら省く**（繰り返しになる） |
| `note` | | 図の下に出す注記（出典・「※架空の数字」など） |
| `key` | | **主役**（アクセント色）にする要素の番号（0始まり）。1枚に1つ |

## 型の選び方

**本文が何を言っているか**で選ぶ。見た目の好みで選ばない。

| 本文が言っていること | type | 上限の目安 |
|---|---|---|
| いくつかの観点で並べて比べる | `table` | **3列まで**。3列ならセルは7字まで |
| AとBの2つを対比する（前後・旧新・人とAI） | `compare` | 各側4項目まで |
| 順番に進む（3つまで） | `flow` | 横に3つ。4つ以上は自動で縦（`steps`）になる |
| 手順を番号付きで説明する | `steps` | 5つまで |
| 時間の流れ | `timeline` | 5つまで |
| 土台と上物・層の重なり | `layers` | 4層まで。上から順に書く |
| 量の大小を比べる | `bar` | 8本まで。横棒なのでラベルが長くても読める |
| 時間による変化 | `line` | 系列3つまで。横軸は6点まで表示 |
| 全体の内訳（構成比） | `share` | 5区分まで。円グラフは使わない |
| 数字そのものを印象づける | `stat` | 3つまで |
| 要点・約束・結論をまとめる | `points` | 4つまで |
| 実際の画面を見せる | `window` | スクショ1枚 |

## 型ごとの JSON

### table — 比較テーブル
```json
{"type":"table","title":"自動投稿か、手で貼るか",
 "columns":["観点","自動投稿","手で貼る"],
 "rows":[["公式サポート","なし","—"],["壊れやすさ","予告なく壊れる","壊れない"]],
 "key":[1,2]}
```
`key` は `[行, 列]`。1列目は行見出しとして太字になる。

### compare — 2項の対比
```json
{"type":"compare","left":{"label":"文字だけ","items":["流し読みされる"]},
 "right":{"label":"挿絵あり","items":["目が休まる"]},"key":"right","arrow":"→"}
```
`key` は `"left"` / `"right"`。`arrow` は「→」「vs」など（省略時 →）。

### flow — プロセス（横）
```json
{"type":"flow","steps":[{"label":"記事を読む"},{"label":"型を選ぶ","sub":"表か流れか"},{"label":"PNGにする"}],"key":1}
```
ラベルは**6字以内**が目安。長いと箱の中で単語が折れる（検査が `narrow` で知らせる）。

### steps — 番号付き手順（縦）
```json
{"type":"steps","steps":[{"label":"リポジトリを入れる","detail":"補足は detail に"}],"key":0}
```

### timeline — 時系列（縦）
```json
{"type":"timeline","items":[{"when":"2026年9月","label":"note を始める"}],"key":0}
```

### layers — 積層
```json
{"type":"layers","layers":[{"label":"Organism","sub":"表・比較"},{"label":"トークン"}],"key":0}
```
上の層ほど濃い色。文字色は塗りの明るさから自動で決まる。

### bar — 横棒グラフ
```json
{"type":"bar","unit":"分","items":[{"label":"構成","value":20},{"label":"挿絵","value":60}],"key":1}
```
`max` を書くと棒の最大値を固定できる（複数の図で目盛りを揃えるとき）。

### line — 折れ線グラフ
```json
{"type":"line","unit":"%","x":["1本目","2本目","3本目"],
 "series":[{"name":"挿絵なし","values":[22,24,21]},{"name":"挿絵あり","values":[22,28,33]}],"key":1}
```
最後の点に値を書く。系列が2つ以上なら凡例が出る。`min` で縦軸の下限を指定できる（既定は0）。

### share — 構成比（100%積み上げ）
```json
{"type":"share","items":[{"label":"表","value":40},{"label":"流れ","value":25}],"key":0}
```
値は合計が100でなくてよい（比率に直す）。

### stat — 大きな数字
```json
{"type":"stat","stats":[{"value":28,"unit":"字","label":"横幅に入れる文字数"}],"key":0}
```

### points — 要点カード
```json
{"type":"points","items":[{"head":"本文の補助に徹する","body":"本文の言い直しはしない"}],"key":0}
```
2項目だけのとき `"columns":2` で横に並ぶ。

### window — スクリーンショット枠
```json
{"type":"window","window_title":"記事の下書き","src":"assets/screen.png","shadow":"contrast-b"}
```
`src` は JSON からの相対パス。`shadow` は `contrast-b` / `contrast-a` / `surface` / `ink`。
**スクショの中の文字はこの道具では大きくできない。** 読ませたい部分は先に切り抜く。

## 型を足すとき

1. `engine/organisms.js` の `O.<type>` に描画を足す（見た目は `engine/figure.css`）
2. 文字サイズは `--figure-1`〜`--figure-4` だけを使う（**数値で直接書かない**。検査が効かなくなる）
3. `bigtree/samples/` に見本を1つ足し、`python3 scripts/render.py bigtree/samples --preview` で warn 0 を確認
4. この表に行を足す
