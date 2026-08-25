/* KMP 字符串匹配渲染器（renderMode: "kmp"）：
   三行视图——主串 t[]、模式串 p[]（与主串对齐比较）、next[] 表。
   字符用 int 编码显示：1=A 2=B 3=C 4=D。
   数据：step.arr = t（main），vars = { p, next, n, m, i, j, phase, pos }。 */

function renderKMP(stage, step) {
  const vars = step.vars || {};
  const t = step.arr || [];
  const p = vars.p || [];
  const next = vars.next || [];
  const n = vars.n !== undefined ? vars.n : t.length;
  const m = vars.m !== undefined ? vars.m : p.length;
  const i = vars.i !== undefined ? vars.i : -1;   /* 主串指针 */
  const j = vars.j !== undefined ? vars.j : -1;   /* 模式串指针 */
  const phase = vars.phase !== undefined ? vars.phase : 0;
  const pos = vars.pos;

  if (!t.length) {
    renderSVG(stage, "0 0 300 120",
      [text("km-empty", 150, 60, "（空串）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }

  const CHAR = ["", "A", "B", "C", "D"];
  function ch(v) { return CHAR[v] !== undefined ? CHAR[v] : String(v); }

  const cellW = 34, cellH = 30, gap = 2;
  const left = 44;
  const rowTY = 66, rowPY = 66 + 46, rowNY = 66 + 92;
  const specs = [];

  /* 阶段标签 */
  let phaseText = "", phaseColor = "#8b96a8";
  if (phase === 1) { phaseText = "阶段 1：构建 next 数组（前缀=后缀的最长长度）"; phaseColor = "#ffd166"; }
  else if (phase === 2) { phaseText = "阶段 2：匹配（失配时 j 回退到 next[j]）"; phaseColor = "#b98cff"; }
  else if (phase === 3) { phaseText = "阶段 3：完成 ✓（模式串在主串中出现）"; phaseColor = "#3ecf8e"; }
  specs.push(text("km-phase", left, 26, phaseText,
    { "font-size": 12, "font-weight": "bold", fill: phaseColor }));

  specs.push(text("km-lt", left - 8, rowTY + 20, "t", { "font-size": 13, "font-weight": "bold", fill: "#5eead4" }));
  specs.push(text("km-lp", left - 8, rowPY + 20, "p", { "font-size": 13, "font-weight": "bold", fill: "#5eead4" }));
  specs.push(text("km-ln", left - 8, rowNY + 20, "n", { "font-size": 13, "font-weight": "bold", fill: "#5eead4" }));

  /* 主串 t[]：匹配成功区间与当前比较位高亮 */
  const matched = phase === 2 && j >= 0 && i - j >= 0; /* t[i-j .. i-1] 已匹配 */
  for (let k = 0; k < n; k++) {
    const x = left + k * (cellW + gap);
    const isCur = phase === 2 && i === k && i < n;
    const isMatched = matched && k >= i - j && k < i;
    let fill = "#232c40", stroke = "#4da3ff", sw = 1.5, tc = "#e8eef7";
    if (isCur) { fill = "#ffd166"; stroke = "#ffd166"; sw = 2.5; tc = "#1c2433"; }
    else if (isMatched) { fill = "#3ecf8e"; stroke = "#3ecf8e"; tc = "#1c2433"; }
    specs.push(rect("kmt-" + k, x, rowTY, cellW, cellH, {
      rx: 4, fill: fill, stroke: stroke, "stroke-width": sw,
    }));
    specs.push(text("kmtt-" + k, x + cellW / 2, rowTY + cellH / 2 + 5,
      ch(t[k]),
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: tc }));
    specs.push(text("kmti-" + k, x + cellW / 2, rowTY - 8, String(k),
      { "text-anchor": "middle", "font-size": 9, fill: "#5c6a85" }));
  }

  /* 模式串 p[]：与主串对齐（主串匹配起点 i-j） */
  const pStart = phase === 2 && j >= 0 ? (i - j) : -1;
  for (let k = 0; k < m; k++) {
    const x = left + (pStart >= 0 ? pStart + k : k) * (cellW + gap);
    const isCur = phase === 2 && j === k;
    const isMatched = phase === 2 && j >= 0 && k < j;
    let fill = "#232c40", stroke = "#b98cff", sw = 1.5, tc = "#e8eef7";
    if (isCur) { fill = "#ffd166"; stroke = "#ffd166"; sw = 2.5; tc = "#1c2433"; }
    else if (isMatched) { fill = "#3ecf8e"; stroke = "#3ecf8e"; tc = "#1c2433"; }
    specs.push(rect("kmp-" + k, x, rowPY, cellW, cellH, {
      rx: 4, fill: fill, stroke: stroke, "stroke-width": sw,
    }));
    specs.push(text("kmpt-" + k, x + cellW / 2, rowPY + cellH / 2 + 5,
      ch(p[k]),
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: tc }));
  }

  /* next[] 表 */
  for (let k = 0; k < m; k++) {
    const x = left + k * (cellW + gap);
    const isCur = phase === 1 && j === k;
    specs.push(rect("kmn-" + k, x, rowNY, cellW, cellH, {
      rx: 4,
      fill: isCur ? "#ffd166" : "#232c40",
      stroke: isCur ? "#ffd166" : "#2e3a52",
      "stroke-width": isCur ? 2.5 : 1.5,
    }));
    specs.push(text("kmnt-" + k, x + cellW / 2, rowNY + cellH / 2 + 5,
      next[k] !== undefined ? String(next[k]) : "·",
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold",
        fill: isCur ? "#1c2433" : "#e8eef7" }));
    specs.push(text("kmni-" + k, x + cellW / 2, rowNY - 8, String(k),
      { "text-anchor": "middle", "font-size": 9, fill: "#5c6a85" }));
  }

  /* 状态说明 */
  const statusY = rowNY + cellH + 34;
  if (phase === 1) {
    specs.push(text("km-status", left, statusY,
      "构建 next：p[" + j + "] 与 p[" + (j >= 0 ? "next 回退" : "-") + "] 比较",
      { "font-size": 12, fill: "#ffd166" }));
  } else if (phase === 2 && j >= 0 && i < n) {
    const ti = t[i], pj = p[j];
    if (ti === pj) {
      specs.push(text("km-status", left, statusY,
        "t[" + i + "]=" + ch(ti) + " == p[" + j + "]=" + ch(pj) + "，i、j 同时前进",
        { "font-size": 12, fill: "#3ecf8e" }));
    } else {
      specs.push(text("km-status", left, statusY,
        "t[" + i + "]=" + ch(ti) + " ≠ p[" + j + "]=" + ch(pj) + "，失配！j 回退到 next[" + j + "]=" + next[j],
        { "font-size": 12, "font-weight": "bold", fill: "#ff6b6b" }));
    }
  } else if (phase === 3) {
    specs.push(text("km-status", left, statusY,
      pos >= 0
        ? "匹配成功！模式串出现在主串下标 " + pos + " 处"
        : "匹配结束，未找到模式串",
      { "font-size": 12, "font-weight": "bold", fill: "#3ecf8e" }));
  } else {
    specs.push(text("km-status", left, statusY,
      "待播放动画", { "font-size": 12, fill: "#8b96a8" }));
  }

  /* 图例 */
  const legendY = statusY + 24;
  specs.push(el("km-legend-bg", "rect", {
    x: left - 5, y: legendY - 12, width: 440, height: 20, rx: 4,
    fill: "#1a2332", opacity: 0.8 }));
  specs.push(text("km-leg-1", left, legendY, "■ ", { "font-size": 11, fill: "#ffd166" }));
  specs.push(text("km-leg-1t", left + 16, legendY, "当前比较", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("km-leg-2", left + 70, legendY, "■ ", { "font-size": 11, fill: "#3ecf8e" }));
  specs.push(text("km-leg-2t", left + 86, legendY, "已匹配", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("km-leg-3", left + 130, legendY, "■ ", { "font-size": 11, fill: "#ff6b6b" }));
  specs.push(text("km-leg-3t", left + 146, legendY, "失配回退", { "font-size": 10, fill: "#8b96a8" }));

  const Wtotal = left + Math.max(n, m) * (cellW + gap) + 40;
  const Htotal = legendY + 30;
  renderSVG(stage, "0 0 " + Wtotal + " " + Htotal, specs);
}
