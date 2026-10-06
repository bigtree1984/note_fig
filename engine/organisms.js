/* ============================================================
   note-fig の描画エンジン
   ------------------------------------------------------------
   window.FIGURE_SPEC（JSON）を読み、Organism を1つ描いてから
   スマホで読めるかを検査する。検査結果は #note-fig-lint に書く
   （scripts/render.py がそれを読む）。

   Organism の一覧と JSON の書き方は docs/CATALOG.md。
   ============================================================ */
(function () {
  "use strict";

  // ---- 小道具 ------------------------------------------------
  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = String(text);
    return el;
  }
  function svg(tag, attrs, text) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (text != null) el.textContent = String(text);
    return el;
  }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function px(name) { return parseFloat(cssVar(name)); }

  // 塗りの明るさから文字色を決める（明るい塗りに白文字、を防ぐ）
  function rgbOf(color) {
    const probe = h("span"); probe.style.color = color; document.body.appendChild(probe);
    const c = getComputedStyle(probe).color; probe.remove();
    const m = c.replace(/^color\(srgb/, "").match(/[\d.]+/g).map(Number).slice(0, 3);
    return c.startsWith("color(") ? m.map(v => v * 255) : m;  // color-mix は 0〜1 で返る
  }
  function luminance(color) {
    const [r, g, b] = rgbOf(color).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrast(a, b) {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  }
  function labelOn(fill) {
    const ink = cssVar("--color-ink"), base = cssVar("--color-base");
    return contrast(fill, ink) >= contrast(fill, base) ? ink : base;
  }
  function mix(color, pct) { return `color-mix(in srgb, ${color} ${pct}%, ${cssVar("--color-base")})`; }

  // 系列の色。主役（accent）は key にしか使わない
  function seriesColors() {
    return ["--color-ink", "--color-contrast-a", "--color-contrast-b", "--color-muted"].map(cssVar);
  }

  function isKey(spec, i) {
    const k = spec.key;
    return Array.isArray(k) ? k.includes(i) : k === i;
  }
  function fmt(v) { return typeof v === "number" ? v.toLocaleString("ja-JP") : v; }

  // ---- Organism ---------------------------------------------
  const O = {};
  const AFTER = [];  // レイアウトが決まってから実行する処理

  O.table = (s) => {
    const t = h("table", "o-table");
    const tr = h("tr"); (s.columns || []).forEach(c => tr.appendChild(h("th", null, c)));
    t.appendChild(h("thead")).appendChild(tr);
    const tb = t.appendChild(h("tbody"));
    (s.rows || []).forEach((row, r) => {
      const trr = tb.appendChild(h("tr"));
      row.forEach((cell, c) => {
        const td = trr.appendChild(h("td", null, cell));
        if (s.key && s.key[0] === r && s.key[1] === c) td.classList.add("is-key");
      });
    });
    return t;
  };

  O.compare = (s) => {
    const w = h("div", "o-compare");
    const side = (d, key) => {
      const el = h("div", "side" + (key ? " is-key" : ""));
      el.appendChild(h("div", "head", d.label));
      const ul = el.appendChild(h("ul"));
      (d.items || []).forEach(t => ul.appendChild(h("li", null, t)));
      return el;
    };
    w.appendChild(side(s.left, s.key === "left"));
    w.appendChild(h("div", "arrow", s.arrow || "→"));
    w.appendChild(side(s.right, s.key === "right"));
    return w;
  };

  function chevron() {
    const el = svg("svg", { viewBox: "0 0 40 56" });
    el.appendChild(svg("path", { d: "M8 6 L32 28 L8 50", fill: "none", stroke: cssVar("--color-muted"), "stroke-width": 8, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    return el;
  }

  O.flow = (s) => {
    const steps = s.steps || [];
    // 横に並べるのは3つまで。4つ以上は1箱が4字幅を切り、スマホで単語の途中で折れるので縦にする
    if (steps.length > 3) return O.steps(s);
    const w = h("div", "o-flow");
    steps.forEach((st, i) => {
      if (i) w.appendChild(h("div", "sep")).appendChild(chevron());
      const box = w.appendChild(h("div", "box" + (isKey(s, i) ? " is-key" : "")));
      const lab = box.appendChild(h("div", "label", st.label));
      if (st.sub) box.appendChild(h("div", "sub", st.sub));
      if (isKey(s, i)) { const c = labelOn(cssVar("--color-accent")); box.style.color = c; lab.style.color = c; }
    });
    return w;
  };

  O.steps = (s) => {
    const w = h("div", "o-steps");
    (s.steps || []).forEach((st, i) => {
      const row = w.appendChild(h("div", "row" + (isKey(s, i) ? " is-key" : "")));
      const no = row.appendChild(h("div", "no", s.numbered === false ? "" : i + 1));
      if (isKey(s, i)) no.style.color = labelOn(cssVar("--color-accent"));
      const body = row.appendChild(h("div"));
      body.appendChild(h("div", "label", st.label));
      if (st.detail || st.sub) body.appendChild(h("div", "detail", st.detail || st.sub));
    });
    return w;
  };

  O.timeline = (s) => {
    const w = h("div", "o-timeline");
    (s.items || []).forEach((it, i) => {
      const el = w.appendChild(h("div", "item" + (isKey(s, i) ? " is-key" : "")));
      el.appendChild(h("div", "when", it.when));
      el.appendChild(h("div", "label", it.label));
    });
    return w;
  };

  O.layers = (s) => {
    const w = h("div", "o-layers");
    const n = (s.layers || []).length;
    s.layers.forEach((ly, i) => {
      const fill = isKey(s, i) ? cssVar("--color-accent") : mix(cssVar("--color-ink"), Math.round(100 - (i * 70) / Math.max(n - 1, 1)));
      const el = w.appendChild(h("div", "layer"));
      el.style.background = fill; el.style.color = labelOn(fill);
      el.appendChild(h("div", "label", ly.label));
      if (ly.sub) el.appendChild(h("div", "sub", ly.sub));
    });
    return w;
  };

  O.bar = (s) => {
    const w = h("div", "o-bar");
    const items = s.items || [];
    const max = s.max || Math.max(...items.map(d => d.value));
    items.forEach((d, i) => {
      const key = isKey(s, i);
      w.appendChild(h("div", "label" + (key ? " is-key-text" : ""), d.label));
      const tr = w.appendChild(h("div", "track"));
      const f = tr.appendChild(h("div", "fill" + (key ? " is-key" : "")));
      f.style.width = `calc((100% - 260px) * ${d.value / max})`;
      tr.appendChild(h("div", "value" + (key ? " is-key" : ""), fmt(d.value) + (s.unit || "")));
    });
    return w;
  };

  O.share = (s) => {
    const w = h("div", "o-share");
    const items = s.items || [];
    const total = items.reduce((a, d) => a + d.value, 0);
    const pal = seriesColors();
    const bar = w.appendChild(h("div", "bar"));
    const legend = h("div", "legend");
    let j = 0;
    items.forEach((d, i) => {
      const fill = isKey(s, i) ? cssVar("--color-accent") : pal[j++ % pal.length];
      const pct = Math.round((d.value / total) * 100);
      const seg = bar.appendChild(h("div", "seg"));
      seg.style.flex = String(d.value); seg.style.background = fill; seg.style.color = labelOn(fill);
      seg.dataset.pct = pct + "%";
      const it = legend.appendChild(h("div", "it"));
      it.appendChild(h("span", "sw")).style.background = fill;
      it.appendChild(h("span", isKey(s, i) ? "is-key-text" : null, `${d.label} ${pct}%`));
    });
    w.appendChild(legend);
    // 区画に収まるときだけ中に％を書く（収まらなければ凡例だけ）
    AFTER.push(() => bar.querySelectorAll(".seg").forEach(seg => {
      if (seg.getBoundingClientRect().width >= px("--figure-1") * 3 + 16) seg.textContent = seg.dataset.pct;
    }));
    return w;
  };

  O.stat = (s) => {
    const w = h("div", "o-stat");
    (s.stats || []).forEach((st, i) => {
      const c = w.appendChild(h("div", "card" + (isKey(s, i) ? " is-key" : "")));
      const num = c.appendChild(h("div", "num", fmt(st.value)));
      if (st.unit) num.appendChild(h("span", "unit", st.unit));
      if (st.label) c.appendChild(h("div", "label", st.label));
    });
    return w;
  };

  O.points = (s) => {
    const w = h("div", "o-points");
    const items = s.items || [];
    w.style.gridTemplateColumns = items.length === 2 && s.columns === 2 ? "1fr 1fr" : "1fr";
    items.forEach((it, i) => {
      const c = w.appendChild(h("div", "card" + (isKey(s, i) ? " is-key" : "")));
      c.appendChild(h("div", "head", it.head));
      if (it.body) c.appendChild(h("div", "body", it.body));
    });
    return w;
  };

  O.window = (s) => {
    const w = h("div", "o-window");
    if (s.shadow) w.style.boxShadow = `var(--offset-shadow) var(--offset-shadow) 0 0 var(--color-${s.shadow})`;
    const bar = w.appendChild(h("div", "bar"));
    for (let i = 0; i < 3; i++) bar.appendChild(h("span", "dot"));
    bar.appendChild(h("span", "wtitle", s.window_title || ""));
    const img = w.appendChild(h("img")); img.src = s.src; img.alt = "";
    return w;
  };

  O.line = (s) => {
    const wrap = h("div", "o-line");
    const W = px("--figure-width") - 2 * px("--space-6"), H = 620;
    const fs = px("--figure-1"), stroke = px("--figure-stroke-min") + 2;
    const L = 150, R = 190, T = 40, B = fs + 48;
    const series = s.series || [];
    const all = series.flatMap(d => d.values);
    const lo = s.min != null ? s.min : Math.min(0, ...all);
    const step = niceStep((Math.max(...all) - lo) / 3);
    const hi = Math.ceil(Math.max(...all) / step) * step;
    const x = i => L + (i * (W - L - R)) / Math.max(s.x.length - 1, 1);
    const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const g = svg("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    const muted = cssVar("--color-muted"), ink = cssVar("--color-ink");
    for (let v = lo; v <= hi + 1e-9; v += step) {
      g.appendChild(svg("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: muted, "stroke-opacity": v === lo ? 1 : 0.3, "stroke-width": 4 }));
      g.appendChild(svg("text", { x: L - 20, y: y(v) + fs * 0.35, "text-anchor": "end", "font-size": fs, fill: muted }, fmt(+v.toFixed(6))));
    }
    const every = Math.ceil(s.x.length / 6);  // 横軸ラベルは6つまで
    s.x.forEach((lab, i) => {
      if (i % every && i !== s.x.length - 1) return;
      g.appendChild(svg("text", { x: x(i), y: H - 12, "text-anchor": "middle", "font-size": fs, fill: muted }, lab));
    });
    const pal = seriesColors(); let j = 0;
    const legend = h("div", "legend");
    series.forEach((d, si) => {
      const key = isKey(s, si);
      const col = key ? cssVar("--color-accent") : (series.length === 1 ? ink : pal[j++ % pal.length]);
      const pts = d.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
      g.appendChild(svg("polyline", { points: pts, fill: "none", stroke: col, "stroke-width": key ? stroke + 4 : stroke, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      const li = d.values.length - 1;
      g.appendChild(svg("circle", { cx: x(li), cy: y(d.values[li]), r: 14, fill: col }));
      g.appendChild(svg("text", { x: x(li) + 28, y: y(d.values[li]) + fs * 0.35, "font-size": key ? px("--figure-2") : fs, "font-weight": 700, fill: key ? col : ink }, fmt(d.values[li]) + (s.unit || "")));
      if (series.length > 1) {
        const it = legend.appendChild(h("div", "it"));
        it.appendChild(h("span", "sw")).style.background = col;
        it.appendChild(h("span", key ? "is-key-text" : null, d.name));
      }
    });
    wrap.appendChild(g);
    if (series.length > 1) wrap.appendChild(legend);
    return wrap;
  };
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }

  // ---- 検査（スマホで読めるか） ------------------------------
  function lint(root, spec) {
    const out = [];
    const minFs = px("--figure-1");
    const maxChars = 28;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const t = walker.currentNode;
      if (!t.textContent.trim()) continue;
      const el = t.parentElement;
      if (seen.has(el)) continue; seen.add(el);
      const st = getComputedStyle(el);
      const fs = parseFloat(st.fontSize);
      const text = el.textContent.trim();
      const where = `「${text.slice(0, 16)}${text.length > 16 ? "…" : ""}」`;
      if (fs < minFs - 0.5)
        out.push({ level: "error", rule: "min-font", msg: `${where} の文字が ${fs}px。スマホで ${(fs * 0.277).toFixed(1)}px になり読めない（下限 ${minFs}px）` });
      const w = el.getBoundingClientRect().width;
      if (text.length > maxChars && w / fs > maxChars + 0.5)
        out.push({ level: "warn", rule: "line-chars", msg: `${where} が1行 ${Math.floor(w / fs)} 字ぶんの幅で組まれている。28字を超えるとスマホで小さく見える` });
      const cap = Math.floor(w / fs);
      const rg = document.createRange(); rg.selectNodeContents(el);
      // 行数を数える。上端が 0.6 字ぶん以上離れたら別の行（大小の文字が混ざった行は1行と数える）
      let lines = 0, lastTop = -1e9;
      [...rg.getClientRects()].sort((a, b) => a.top - b.top).forEach(r => { if (r.top - lastTop > fs * 0.6) { lines++; lastTop = r.top; } });
      if (lines > 1 && cap < 8)
        out.push({ level: "warn", rule: "narrow", msg: `${where} が1行 ${cap} 字の狭い枠で折り返している。単語の途中で折れやすい` });
      if (st.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1)
        out.push({ level: "warn", rule: "ellipsis", msg: `${where} が省略記号で切れている` });
      else if (el.scrollWidth > el.clientWidth + 1 && st.overflow !== "visible")
        out.push({ level: "error", rule: "overflow", msg: `${where} が枠からはみ出している` });
    }
    if (root.scrollWidth > px("--figure-width") + 1)
      out.push({ level: "error", rule: "width", msg: `図の幅が ${root.scrollWidth}px。制作幅 ${px("--figure-width")}px を超えている` });
    if (spec.type === "table" && (spec.columns || []).length > 3)
      out.push({ level: "warn", rule: "table-cols", msg: `表が ${spec.columns.length} 列。スマホでは3列が限界（3列ならセルは7字まで）。列を減らすか表を分ける` });
    const keyGroups = Array.isArray(spec.key) && !(spec.type === "table") ? spec.key.length : 1;
    if (keyGroups > 1) out.push({ level: "warn", rule: "one-accent", msg: `主役の色が ${keyGroups} 箇所にある。主役は1枚に1箇所` });
    const r = root.getBoundingClientRect();
    return { issues: out, width: Math.round(r.width), height: Math.round(r.height) };
  }

  // ---- 起動 ---------------------------------------------------
  async function main() {
    const s = window.FIGURE_SPEC || {};
    const root = document.getElementById("fig");
    if (s.title) root.appendChild(h("h1", "fig-title", s.title));
    const make = O[s.type];
    if (!make) {
      root.appendChild(h("p", null, `未知の type: ${s.type}（使えるもの: ${Object.keys(O).join(", ")}）`));
    } else {
      root.appendChild(make(s));
    }
    if (s.note) root.appendChild(h("p", "fig-note", s.note));
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await new Promise(r => setTimeout(r, 50));
    AFTER.forEach(f => f());
    await new Promise(r => setTimeout(r, 50));
    const result = make ? lint(root, s) : { issues: [{ level: "error", rule: "type", msg: `未知の type: ${s.type}` }] };
    const pre = document.getElementById("note-fig-lint");
    pre.textContent = JSON.stringify(result);
    document.documentElement.dataset.ready = "1";
  }
  window.NOTE_FIG_TYPES = Object.keys(O);
  document.addEventListener("DOMContentLoaded", main);
})();
