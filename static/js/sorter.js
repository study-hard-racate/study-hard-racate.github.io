/* 排序动画共享逻辑：随机数组、步骤渲染（持久化 DOM + CSS 过渡） */

const SORT_COLORS = {
  normal: "#4da3ff",
  cmp: "#ffd166",
  swap: "#ff6b6b",
  done: "#3ecf8e",
  pivot: "#b98cff",
  dim: "#2a3550",
  key: "#ff9f43",
};

function randomArray(n, maxVal) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(1 + Math.floor(Math.random() * maxVal));
  return a;
}

const SVG_W = 560, SVG_H = 300;

/* 柱状图几何：与所有辅助标记共用同一套坐标 */
function barGeom(n) {
  const bw = Math.min(40, (SVG_W - (n + 1) * 14) / n);
  const gap = n > 1 ? (SVG_W - 28 - n * bw) / (n - 1) : 0;
  return { bw: bw, gap: gap };
}

function barX(i, n) {
  const g = barGeom(n);
  return 14 + i * (g.bw + g.gap);
}

/* 位置下标处的指针（小三角 + 标签） */
function pointerSpecs(key, idx, n, color, label, top) {
  if (idx == null || idx < 0) return [];
  const g = barGeom(n);
  const cx = 14 + idx * (g.bw + g.gap) + g.bw / 2;
  const y = top ? 16 : SVG_H - 26;
  const d = top
    ? "M" + cx + " " + (y + 6) + " L" + (cx - 6) + " " + (y - 2) + " L" + (cx + 6) + " " + (y - 2) + " Z"
    : "M" + cx + " " + (y - 6) + " L" + (cx - 6) + " " + (y + 2) + " L" + (cx + 6) + " " + (y + 2) + " Z";
  return [
    path(key + "-p", d, { fill: color }),
    text(key + "-l", cx, top ? y - 8 : y + 18, label, { "text-anchor": "middle", "font-size": 11, fill: color }),
  ];
}

/* 区间 [lo, hi] 下方的括号 */
function bracketSpecs(lo, hi, n) {
  if (lo == null || hi == null || lo > hi) return [];
  const x1 = barX(lo, n) + barGeom(n).bw / 2;
  const x2 = barX(hi, n) + barGeom(n).bw / 2;
  const y = SVG_H - 12;
  return [
    path("brk", "M" + x1 + " " + y + " L" + x1 + " " + (y + 10) + " L" + x2 + " " + (y + 10) + " L" + x2 + " " + y,
      { stroke: "#8fa1bd", fill: "none", "stroke-width": 1.5 }),
    text("brk-lb", (x1 + x2) / 2, y + 22, "[" + lo + ".." + hi + "]", { "text-anchor": "middle", "font-size": 11, fill: "#8fa1bd" }),
  ];
}

/* 根据一步生成完整的柱状图 specs */
function buildSortSpecs(step) {
  const n = step.arr.length;
  const specs = [];
  const maxV = Math.max.apply(null, step.arr);
  const g = barGeom(n);

  const colors = new Array(n).fill(SORT_COLORS.normal);
  if (step.done) for (let i = 0; i < n; i++) if (step.done[i]) colors[i] = SORT_COLORS.done;
  if (step.dim) for (const i of step.dim) colors[i] = SORT_COLORS.dim;
  if (step.keyIdx != null) colors[step.keyIdx] = SORT_COLORS.key;
  if (step.cmp) colors[step.cmp[0]] = colors[step.cmp[1]] = step.swap ? SORT_COLORS.swap : SORT_COLORS.cmp;

  for (let i = 0; i < n; i++) {
    const x = 14 + i * (g.bw + g.gap);
    const bh = (step.arr[i] / maxV) * (SVG_H - 60);
    specs.push(rect("bar-" + i, x, SVG_H - bh, g.bw, bh, { rx: 4, fill: colors[i] }));
    specs.push(text("val-" + i, x + g.bw / 2, SVG_H - bh - 8, step.arr[i],
      { "text-anchor": "middle", "font-size": 13, fill: "#dbe4f4" }));
  }
  specs.push.apply(specs, bracketSpecs(step.lo, step.hi, n));
  specs.push.apply(specs, pointerSpecs("j", step.j, n, SORT_COLORS.cmp, "j", false));
  specs.push.apply(specs, pointerSpecs("i", step.i, n, SORT_COLORS.pivot, "i", false));
  specs.push.apply(specs, pointerSpecs("pi", step.pi, n, SORT_COLORS.pivot, "pivot", true));
  specs.push.apply(specs, pointerSpecs("k", step.k, n, SORT_COLORS.pivot, "k", false));
  return specs;
}

/* 计数排序渲染器（renderMode: "countingsort"）：
   三行视图——上行 a[]（待排序）、中行 count[]（计数/前缀和）、下行 out[]（结果）。
   数据：step.arr = a（main），vars = { count, out, n, max, phase, i } */
function renderCountingSort(stage, step) {
  const vars = step.vars || {};
  const a = step.arr || [];
  const count = vars.count || [];
  const out = vars.out || [];
  const n = vars.n !== undefined ? vars.n : a.length;
  const max = vars.max !== undefined ? vars.max : (count.length - 1);
  const phase = vars.phase !== undefined ? vars.phase : 0;
  const i = vars.i;

  if (!a.length && !count.length) {
    renderSVG(stage, "0 0 300 120",
      [text("cs-empty", 150, 60, "（空数据）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }

  const cellW = 40, cellH = 28, gap = 4;
  const left = 46;
  const rowAY = 66, rowBY = 66 + 42, rowCY = 66 + 84;
  const specs = [];

  /* 阶段标签 */
  let phaseText = "", phaseColor = "#8b96a8";
  if (phase === 1) { phaseText = "阶段 1：计数（统计每个值出现的次数）"; phaseColor = "#ffd166"; }
  else if (phase === 2) { phaseText = "阶段 2：前缀和（count[i] = 值 ≤ i 的元素个数）"; phaseColor = "#b98cff"; }
  else if (phase === 3) { phaseText = "阶段 3：放回（从后往前确定每个元素的位置）"; phaseColor = "#3ecf8e"; }
  specs.push(text("cs-phase", left, 26, phaseText,
    { "font-size": 12, "font-weight": "bold", fill: phaseColor }));

  /* 行标签 */
  specs.push(text("cs-la", left - 6, rowAY + 20, "a", { "font-size": 13, "font-weight": "bold", fill: "#5eead4" }));
  specs.push(text("cs-lc", left - 6, rowBY + 20, "c", { "font-size": 13, "font-weight": "bold", fill: "#5eead4" }));
  specs.push(text("cs-lo", left - 6, rowCY + 20, "o", { "font-size": 13, "font-weight": "bold", fill: "#5eead4" }));

  /* 上行 a[] */
  for (let k = 0; k < n; k++) {
    const x = left + k * (cellW + gap);
    const isCur = (phase === 1 || phase === 3) && i === k;
    specs.push(rect("csa-" + k, x, rowAY, cellW, cellH, {
      rx: 4,
      fill: isCur ? "#ffd166" : "#232c40",
      stroke: isCur ? "#ffd166" : "#4da3ff",
      "stroke-width": isCur ? 2.5 : 1.5,
    }));
    specs.push(text("csat-" + k, x + cellW / 2, rowAY + cellH / 2 + 5,
      a[k] !== undefined ? String(a[k]) : "·",
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold",
        fill: isCur ? "#1c2433" : "#e8eef7" }));
    specs.push(text("csai-" + k, x + cellW / 2, rowAY - 6, String(k),
      { "text-anchor": "middle", "font-size": 9, fill: "#5c6a85" }));
  }

  /* 中行 count[]（0..max） */
  for (let k = 0; k <= max; k++) {
    const x = left + k * (cellW + gap);
    const isInc = phase === 1 && i !== undefined && i >= 0 && i < n && a[i] === k;
    const isPre = phase === 2 && i === k;
    const isDec = phase === 3 && i >= 0 && i < n && a[i] === k;
    const isCur2 = isInc || isPre || isDec;
    let fill = "#232c40", stroke = "#4da3ff", sw = 1.5, tc = "#e8eef7";
    if (isInc) { fill = "#ffd166"; stroke = "#ffd166"; sw = 2.5; tc = "#1c2433"; }
    else if (isPre) { fill = "#b98cff"; stroke = "#b98cff"; sw = 2.5; tc = "#1c2433"; }
    else if (isDec) { fill = "#ff6b6b"; stroke = "#ff6b6b"; sw = 2.5; tc = "#1c2433"; }
    specs.push(rect("csc-" + k, x, rowBY, cellW, cellH, {
      rx: 4, fill: fill, stroke: stroke, "stroke-width": sw,
    }));
    specs.push(text("csct-" + k, x + cellW / 2, rowBY + cellH / 2 + 5,
      count[k] !== undefined ? String(count[k]) : "0",
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: tc }));
    specs.push(text("csci-" + k, x + cellW / 2, rowBY - 6, String(k),
      { "text-anchor": "middle", "font-size": 9, fill: "#5c6a85" }));
  }

  /* 下行 out[] */
  for (let k = 0; k < n; k++) {
    const x = left + k * (cellW + gap);
    const filled = out[k] !== undefined && out[k] > 0;
    specs.push(rect("cso-" + k, x, rowCY, cellW, cellH, {
      rx: 4,
      fill: filled ? "#3ecf8e" : "#232c40",
      stroke: filled ? "#3ecf8e" : "#2e3a52",
      "stroke-width": filled ? 2 : 1.5,
    }));
    specs.push(text("csot-" + k, x + cellW / 2, rowCY + cellH / 2 + 5,
      filled ? String(out[k]) : "",
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold",
        fill: filled ? "#1c2433" : "#5c6a85" }));
    specs.push(text("csoi-" + k, x + cellW / 2, rowCY - 6, String(k),
      { "text-anchor": "middle", "font-size": 9, fill: "#5c6a85" }));
  }

  /* 状态说明 */
  const statusY = rowCY + cellH + 34;
  if (phase === 1) {
    specs.push(text("cs-status", left, statusY,
      "遇到值 " + (a[i] !== undefined ? a[i] : "·") + "，count[" + (a[i] !== undefined ? a[i] : "·") + "] +1",
      { "font-size": 12, fill: "#ffd166" }));
  } else if (phase === 2) {
    specs.push(text("cs-status", left, statusY,
      "count[" + i + "] = count[" + i + "] + count[" + (i - 1) + "]（前缀和：值 ≤ " + i + " 的个数）",
      { "font-size": 12, fill: "#b98cff" }));
  } else if (phase === 3) {
    specs.push(text("cs-status", left, statusY,
      "把 a[" + i + "]=" + (a[i] !== undefined ? a[i] : "·") + " 放到 out[count[" + (a[i] !== undefined ? a[i] : "·") + "] - 1]，count 减 1",
      { "font-size": 12, fill: "#3ecf8e" }));
  } else if (phase === 0 && !count.length) {
    specs.push(text("cs-status", left, statusY,
      "待播放动画（数据已就绪）", { "font-size": 12, fill: "#8b96a8" }));
  }

  /* 图例 */
  const legendY = statusY + 24;
  specs.push(el("cs-legend-bg", "rect", {
    x: left - 5, y: legendY - 12, width: 420, height: 20, rx: 4,
    fill: "#1a2332", opacity: 0.8 }));
  specs.push(text("cs-leg-1", left, legendY, "■ ", { "font-size": 11, fill: "#ffd166" }));
  specs.push(text("cs-leg-1t", left + 16, legendY, "当前", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("cs-leg-2", left + 50, legendY, "■ ", { "font-size": 11, fill: "#b98cff" }));
  specs.push(text("cs-leg-2t", left + 66, legendY, "前缀和", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("cs-leg-3", left + 105, legendY, "■ ", { "font-size": 11, fill: "#ff6b6b" }));
  specs.push(text("cs-leg-3t", left + 121, legendY, "计数减 1", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("cs-leg-4", left + 165, legendY, "■ ", { "font-size": 11, fill: "#3ecf8e" }));
  specs.push(text("cs-leg-4t", left + 181, legendY, "已放回", { "font-size": 10, fill: "#8b96a8" }));

  const Wtotal = left + Math.max(n, max + 1) * (cellW + gap) + 40;
  const Htotal = legendY + 30;
  renderSVG(stage, "0 0 " + Wtotal + " " + Htotal, specs);
}

/* 基数排序渲染器（renderMode: "radix"）：
   两行视图——上行 a[]（当前数组，格子上方显示当前位数字），下行 out[]（本轮结果）。
   数据：step.arr = a（main），vars = { out, count, n, exp, i, d, phase }。
   exp: 1=个位 10=十位 100=百位，>100 表示完成。 */
function renderRadixSort(stage, step) {
  const vars = step.vars || {};
  const a = step.arr || [];
  const out = vars.out || [];
  const n = vars.n !== undefined ? vars.n : a.length;
  const exp = vars.exp !== undefined ? vars.exp : 1;
  const i = vars.i;
  const d = vars.d;

  if (!a.length) {
    renderSVG(stage, "0 0 300 120",
      [text("rd-empty", 150, 60, "（空数据）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }

  const cellW = 44, cellH = 30, gap = 4;
  const left = 40;
  const rowAY = 70, rowBY = 70 + 48;
  const specs = [];

  /* 阶段标签 */
  let phaseText = "", phaseColor = "#8b96a8";
  if (exp <= 1) { phaseText = "第 1 轮：按个位排序（LSD）"; phaseColor = "#ffd166"; }
  else if (exp === 10) { phaseText = "第 2 轮：按十位排序"; phaseColor = "#ffd166"; }
  else if (exp === 100) { phaseText = "第 3 轮：按百位排序"; phaseColor = "#ffd166"; }
  else { phaseText = "完成！所有位排序完毕，数组有序"; phaseColor = "#3ecf8e"; }
  specs.push(text("rd-phase", left, 26, phaseText,
    { "font-size": 12, "font-weight": "bold", fill: phaseColor }));

  specs.push(text("rd-la", left - 6, rowAY + 20, "a", { "font-size": 13, "font-weight": "bold", fill: "#5eead4" }));
  specs.push(text("rd-lo", left - 6, rowBY + 20, "o", { "font-size": 13, "font-weight": "bold", fill: "#5eead4" }));

  /* 上行 a[] + 当前位数字 */
  for (let k = 0; k < n; k++) {
    const x = left + k * (cellW + gap);
    const isCur = exp <= 100 && i === k;
    specs.push(rect("rda-" + k, x, rowAY, cellW, cellH, {
      rx: 4,
      fill: isCur ? "#ffd166" : "#232c40",
      stroke: isCur ? "#ffd166" : "#4da3ff",
      "stroke-width": isCur ? 2.5 : 1.5,
    }));
    specs.push(text("rdat-" + k, x + cellW / 2, rowAY + cellH / 2 + 5,
      a[k] !== undefined ? String(a[k]) : "·",
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold",
        fill: isCur ? "#1c2433" : "#e8eef7" }));
    /* 当前位数字（格子上方小字） */
    if (exp <= 100 && a[k] !== undefined) {
      const digit = Math.floor(a[k] / exp) % 10;
      specs.push(text("rdad-" + k, x + cellW / 2, rowAY - 8, String(digit),
        { "text-anchor": "middle", "font-size": 11, "font-weight": "bold",
          fill: isCur ? "#ffd166" : "#8b96a8" }));
    }
    specs.push(text("rdai-" + k, x + cellW / 2, rowAY + cellH + 13, String(k),
      { "text-anchor": "middle", "font-size": 9, fill: "#5c6a85" }));
  }

  /* 下行 out[] */
  for (let k = 0; k < n; k++) {
    const x = left + k * (cellW + gap);
    const filled = out[k] !== undefined && out[k] > 0;
    specs.push(rect("rdo-" + k, x, rowBY, cellW, cellH, {
      rx: 4,
      fill: filled ? "#3ecf8e" : "#232c40",
      stroke: filled ? "#3ecf8e" : "#2e3a52",
      "stroke-width": filled ? 2 : 1.5,
    }));
    specs.push(text("rdot-" + k, x + cellW / 2, rowBY + cellH / 2 + 5,
      filled ? String(out[k]) : "",
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold",
        fill: filled ? "#1c2433" : "#5c6a85" }));
  }

  /* 状态说明 */
  const statusY = rowBY + cellH + 34;
  if (exp <= 100 && i !== undefined && i >= 0 && i < n) {
    specs.push(text("rd-status", left, statusY,
      "a[" + i + "]=" + a[i] + " 的" + (exp === 1 ? "个位" : exp === 10 ? "十位" : "百位") + "数字是 " + d + "，放入 out 的 count[" + d + "]-1 位置",
      { "font-size": 12, fill: "#ffd166" }));
  } else if (exp > 100) {
    specs.push(text("rd-status", left, statusY,
      "三轮排序后数组已有序", { "font-size": 12, "font-weight": "bold", fill: "#3ecf8e" }));
  } else {
    specs.push(text("rd-status", left, statusY,
      "用计数排序按当前位稳定排序（LSD 从低位到高位）", { "font-size": 12, fill: "#8b96a8" }));
  }

  /* 图例 */
  const legendY = statusY + 24;
  specs.push(el("rd-legend-bg", "rect", {
    x: left - 5, y: legendY - 12, width: 420, height: 20, rx: 4,
    fill: "#1a2332", opacity: 0.8 }));
  specs.push(text("rd-leg-1", left, legendY, "■ ", { "font-size": 11, fill: "#ffd166" }));
  specs.push(text("rd-leg-1t", left + 16, legendY, "当前元素", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("rd-leg-2", left + 70, legendY, "■ ", { "font-size": 11, fill: "#3ecf8e" }));
  specs.push(text("rd-leg-2t", left + 86, legendY, "本轮已放回", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("rd-leg-3", left + 140, legendY, "7", { "font-size": 11, fill: "#8b96a8", "font-weight": "bold" }));
  specs.push(text("rd-leg-3t", left + 156, legendY, "当前位数字", { "font-size": 10, fill: "#8b96a8" }));

  const Wtotal = left + n * (cellW + gap) + 40;
  const Htotal = legendY + 30;
  renderSVG(stage, "0 0 " + Wtotal + " " + Htotal, specs);
}

/* 排序页面统一初始化入口 */
function sortPageSetup(codeLines, genStepsFn, extraRender) {
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const btnRandom = document.getElementById("btn-random");
  const sizeInput = document.getElementById("size");

  let arr = [];
  let player = null;

  function rebuild() {
    const n = Math.min(Math.max(+sizeInput.value || 8, 4), 15);
    arr = randomArray(n, 99);
    if (player) {
      player.code = codeLines;
      player.setSteps(genStepsFn(arr));
    }
  }

  function render(step) {
    const specs = buildSortSpecs(step);
    if (extraRender) specs.push.apply(specs, extraRender(step, step.arr.length) || []);
    renderSVG(stage, "0 0 " + SVG_W + " " + SVG_H, specs);
    status.innerHTML = step.msg || "";
  }

  player = new StepPlayer({
    steps: [],
    code: codeLines,
    render: render,
    speed: 800,
  });
  bindPlayer(player);
  window._sortPlayer = player;

  btnRandom.addEventListener("click", rebuild);
  sizeInput.addEventListener("change", rebuild);
  rebuild();
}
