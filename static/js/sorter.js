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
