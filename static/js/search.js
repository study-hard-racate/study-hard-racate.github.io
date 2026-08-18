/* 查找算法渲染器：线性查找 / 二分查找 / 分块查找。
   输入为 csim 数组模式快照：step.arr（主数组）+ step.vars（lo/hi/mid/i/found/b/block 等）。
   颜色约定：黄=正在访问，绿=找到，红=未找到/指针区域。 */

const SRCH_W = 46;   /* 格宽 */
const SRCH_H = 36;   /* 格高 */
const SRCH_GAP = 6;

function _cellSpecs(x, y, val, opts) {
  const specs = [];
  const fill = opts.fill || "#232c40";
  const stroke = opts.stroke || "#4da3ff";
  specs.push(rect(opts.key, x, y, SRCH_W, SRCH_H, {
    rx: 6, fill: fill, stroke: stroke, "stroke-width": opts.thick ? 2.5 : 1.5,
  }));
  specs.push(text(opts.key + "t", x + SRCH_W / 2, y + SRCH_H / 2 + 5,
    val === undefined || val === null ? "" : String(val),
    { "text-anchor": "middle", "font-size": 14, "font-weight": "bold", fill: opts.tc || "#e8eef7" }));
  return specs;
}

function _targetBadge(x, y, val) {
  return [
    rect("stgt", x, y, 46, 22, { rx: 6, fill: "rgba(94,234,212,.12)", stroke: "#5eead4", "stroke-width": 1.5 }),
    text("stgtt", x + 23, y + 16, "目标 " + val, { "text-anchor": "middle", "font-size": 11, fill: "#5eead4", "font-weight": "bold" }),
  ];
}

/* 数组行渲染公共部分：返回 { specs, cellX(i), y } */
function _rowBase(arr, topY, cellH) {
  const n = arr.length;
  const W = 40 + n * (SRCH_W + SRCH_GAP) + 10;
  return { n: n, W: W, y: topY, x0: 40 };
}

/* 线性查找：当前扫描下标 vars.i 高亮黄，找到（vars.found>=0）后绿色 */
function renderLinearSearch(stage, step) {
  const arr = (step && step.arr) ? step.arr : [];
  const vars = (step && step.vars) ? step.vars : {};
  const target = vars.x !== undefined ? vars.x : (vars.target !== undefined ? vars.target : null);
  const i = vars.i !== undefined ? vars.i : -1;
  const found = vars.found !== undefined ? vars.found : -1;
  const base = _rowBase(arr, 96, SRCH_H);
  const specs = [];
  if (target !== null) specs.push.apply(specs, _targetBadge(12, 40, target));
  for (let k = 0; k < arr.length; k++) {
    const x = base.x0 + k * (SRCH_W + SRCH_GAP);
    const isFound = found === k;
    const isScan = k === i && !isFound;
    specs.push.apply(specs, _cellSpecs(x, base.y, arr[k], {
      key: "sc-" + k,
      fill: isFound ? "rgba(62,207,142,.2)" : (isScan ? "#3d3a2e" : "#232c40"),
      stroke: isFound ? "#3ecf8e" : (isScan ? "#ffd166" : "#4da3ff"),
      thick: isFound || isScan,
      tc: isFound ? "#3ecf8e" : "#e8eef7",
    }));
  }
  specs.push(text("smsg", 12, 200, found >= 0 ? "找到 " + target + "，下标 " + found
    : (i >= arr.length ? "未找到 " + target : "正在扫描第 " + (i + 1) + " 个元素"),
    { "font-size": 13, fill: found >= 0 ? "#3ecf8e" : "#8fa1bd" }));
  renderSVG(stage, "0 0 " + base.W + " 230", specs);
}

/* 二分查找：low / high / mid 指针标签 + 当前区间高亮 */
function renderBinarySearch(stage, step) {
  const arr = (step && step.arr) ? step.arr : [];
  const vars = (step && step.vars) ? step.vars : {};
  const target = vars.x !== undefined ? vars.x : null;
  const lo = vars.lo !== undefined ? vars.lo : 0;
  const hi = vars.hi !== undefined ? vars.hi : arr.length - 1;
  const mid = vars.mid !== undefined ? vars.mid : -1;
  const found = vars.found !== undefined ? vars.found : -1;
  const base = _rowBase(arr, 120, SRCH_H);
  const specs = [];
  if (target !== null) specs.push.apply(specs, _targetBadge(12, 40, target));
  for (let k = 0; k < arr.length; k++) {
    const x = base.x0 + k * (SRCH_W + SRCH_GAP);
    const inRange = k >= lo && k <= hi;
    const isMid = k === mid;
    const isFound = found === k;
    specs.push.apply(specs, _cellSpecs(x, base.y, arr[k], {
      key: "bc-" + k,
      fill: isFound ? "rgba(62,207,142,.25)" : (isMid ? "rgba(255,209,102,.25)" : (inRange ? "#232c40" : "#141a28")),
      stroke: isFound ? "#3ecf8e" : (isMid ? "#ffd166" : (inRange ? "#4da3ff" : "#2e3a52")),
      thick: isFound || isMid,
      tc: isFound ? "#3ecf8e" : "#e8eef7",
    }));
  }
  /* 指针标签 */
  const lab = (name, idx, color) => {
    const x = base.x0 + idx * (SRCH_W + SRCH_GAP) + SRCH_W / 2;
    specs.push(text("bp-" + name, x, base.y - 12, name + "=" + idx,
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: color }));
    specs.push(line("bpl-" + name, x, base.y - 6, x, base.y - 1, { stroke: color, "stroke-width": 2 }));
  };
  if (lo >= 0 && lo < arr.length) lab("lo", lo, "#5eead4");
  if (hi >= 0 && hi < arr.length) lab("hi", hi, "#b98cff");
  if (mid >= 0 && mid < arr.length) lab("mid", mid, "#ffd166");
  specs.push(text("smsg", 12, 210, found >= 0 ? "找到 " + target + "，下标 " + found
    : (lo > hi ? "未找到 " + target + "（区间已空）" : "mid = " + mid + "，比较 a[" + mid + "] 与目标"),
    { "font-size": 13, fill: found >= 0 ? "#3ecf8e" : (lo > hi ? "#ff6b6b" : "#8fa1bd") }));
  renderSVG(stage, "0 0 " + base.W + " 240", specs);
}

/* 分块查找：索引表（block[]）+ 数据数组，先定位块（b）再块内查找 */
function renderBlockSearch(stage, step) {
  const arr = (step && step.arr) ? step.arr : [];
  const vars = (step && step.vars) ? step.vars : {};
  const target = vars.x !== undefined ? vars.x : null;
  const block = (vars.block && vars.block.length) ? vars.block : [];
  const b = vars.b !== undefined ? vars.b : -1;
  const found = vars.found !== undefined ? vars.found : -1;
  const start = b >= 0 ? b * 4 : -1;
  const base = _rowBase(arr, 190, SRCH_H);
  const specs = [];
  if (target !== null) specs.push.apply(specs, _targetBadge(12, 30, target));
  /* 索引表 */
  const blockW = block.length * (SRCH_W + SRCH_GAP) + 40;
  specs.push(text("bidx", 12, 96, "索引表（每块最大值）", { "font-size": 12, fill: "#8fa1bd" }));
  for (let k = 0; k < block.length; k++) {
    const x = 40 + k * (SRCH_W + SRCH_GAP);
    const active = k === b;
    specs.push.apply(specs, _cellSpecs(x, 104, block[k], {
      key: "bl-" + k,
      fill: active ? "rgba(255,209,102,.22)" : "#1f2940",
      stroke: active ? "#ffd166" : "#5eead4",
      thick: active,
    }));
  }
  /* 数据数组 */
  specs.push(text("darr", 12, 172, "数据（每块 4 个，块内有序）", { "font-size": 12, fill: "#8fa1bd" }));
  for (let k = 0; k < arr.length; k++) {
    const x = base.x0 + k * (SRCH_W + SRCH_GAP);
    const inBlock = b >= 0 && k >= start && k < start + 4;
    const isFound = found === k;
    specs.push.apply(specs, _cellSpecs(x, base.y, arr[k], {
      key: "blk-" + k,
      fill: isFound ? "rgba(62,207,142,.25)" : (inBlock ? "#232c40" : "#141a28"),
      stroke: isFound ? "#3ecf8e" : (inBlock ? "#ffd166" : "#2e3a52"),
      thick: isFound || inBlock,
      tc: isFound ? "#3ecf8e" : "#e8eef7",
    }));
  }
  specs.push(text("smsg", 12, 250, found >= 0 ? "找到 " + target + "，下标 " + found
    : (b < 0 ? "目标大于所有块的最大值，未找到" : "在第 " + (b + 1) + " 块内顺序查找"),
    { "font-size": 13, fill: found >= 0 ? "#3ecf8e" : (b < 0 ? "#ff6b6b" : "#8fa1bd") }));
  renderSVG(stage, "0 0 " + Math.max(base.W, blockW) + " 270", specs);
}
