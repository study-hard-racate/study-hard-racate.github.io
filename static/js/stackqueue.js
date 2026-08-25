/* 栈/队列的数组形态渲染：数组栈（竖直，top 指针）与数组队列（水平，front/rear）。
   输入为 csim 数组模式快照：step.arr（主数组）+ step.vars（top/front/rear 等 int 变量）。 */

const SQ_CELL_W = 46;
const SQ_CELL_H = 32;
const SQ_GAP = 4;

/* 竖直数组栈：栈底在下、栈顶在上，top 指针标签跟随 */
function renderArrayStack(stage, step) {
  const arr = (step && step.arr) ? step.arr : [];
  const vars = (step && step.vars) ? step.vars : {};
  const top = vars.top !== undefined ? vars.top : (vars.TOP !== undefined ? vars.TOP : -1);
  const n = Math.max(arr.length, 1);
  const W = SQ_CELL_W + 70;
  const H = n * (SQ_CELL_H + SQ_GAP) + 46;
  const specs = [];
  /* 从下往上：底部一行是 index 0（栈底） */
  for (let i = 0; i < arr.length; i++) {
    const y = H - 30 - (i + 1) * (SQ_CELL_H + SQ_GAP);
    const active = i <= top;
    specs.push(rect("sq-" + i, 30, y, SQ_CELL_W, SQ_CELL_H, {
      rx: 5,
      fill: active ? "#232c40" : "#161c29",
      stroke: active ? "#4da3ff" : "#2e3a52",
      "stroke-width": i === top ? 2.5 : 1.5,
    }));
    specs.push(text("sqv-" + i, 30 + SQ_CELL_W / 2, y + SQ_CELL_H / 2 + 5,
      active ? String(arr[i]) : "",
      { "text-anchor": "middle", "font-size": 14, "font-weight": "bold", fill: "#e8eef7" }));
  }
  /* 栈底标签 */
  specs.push(text("sqbase", 14, H - 30 + SQ_CELL_H / 2 + 5, "底",
    { "text-anchor": "middle", "font-size": 11, fill: "#8b96a8" }));
  /* top 指针标签 */
  if (top >= 0 && top < arr.length) {
    const y = H - 30 - (top + 1) * (SQ_CELL_H + SQ_GAP);
    specs.push(text("sqtop", 30 + SQ_CELL_W + 12, y + SQ_CELL_H / 2 + 5, "top",
      { "text-anchor": "start", "font-size": 12, "font-weight": "bold", fill: "#5eead4" }));
    specs.push(line("sqtopl", 30 + SQ_CELL_W, y + SQ_CELL_H / 2, 30 + SQ_CELL_W + 10, y + SQ_CELL_H / 2,
      { stroke: "#5eead4", "stroke-width": 1.5 }));
  } else {
    specs.push(text("sqtop", 30 + SQ_CELL_W + 12, 20, "top = -1（空栈）",
      { "text-anchor": "start", "font-size": 12, fill: "#5c6a85" }));
  }
  renderSVG(stage, "0 0 " + W + " " + H, specs);
}

/* 水平数组队列：front/rear 指针标签跟随 */
function renderArrayQueue(stage, step) {
  const arr = (step && step.arr) ? step.arr : [];
  const vars = (step && step.vars) ? step.vars : {};
  const front = vars.front !== undefined ? vars.front : -1;
  const rear = vars.rear !== undefined ? vars.rear : -1;
  const n = Math.max(arr.length, 4);
  const W = 30 + n * (SQ_CELL_W + SQ_GAP) + 10;
  const H = 96;
  const y = 44;
  const specs = [];
  for (let i = 0; i < arr.length; i++) {
    const x = 30 + i * (SQ_CELL_W + SQ_GAP);
    const inQ = i > front && i <= rear;
    specs.push(rect("qq-" + i, x, y, SQ_CELL_W, SQ_CELL_H, {
      rx: 5,
      fill: inQ ? "#232c40" : "#161c29",
      stroke: inQ ? "#4da3ff" : "#2e3a52",
      "stroke-width": 1.5,
    }));
    specs.push(text("qqv-" + i, x + SQ_CELL_W / 2, y + SQ_CELL_H / 2 + 5,
      inQ ? String(arr[i]) : "",
      { "text-anchor": "middle", "font-size": 14, "font-weight": "bold", fill: "#e8eef7" }));
  }
  /* front / rear 指针标签 */
  const label = (name, idx, color, key) => {
    const x = 30 + idx * (SQ_CELL_W + SQ_GAP);
    specs.push(text(key, x, y - 10, name,
      { "text-anchor": "start", "font-size": 12, "font-weight": "bold", fill: color }));
    specs.push(line(key + "l", x + 2, y - 2, x + SQ_CELL_W / 2, y - 2,
      { stroke: color, "stroke-width": 1.5 }));
  };
  if (front >= 0) label("front", front, "#5eead4", "qqfront");
  if (rear >= 0) label("rear", rear, "#ffd166", "qqrear");
  if (front < 0) {
    specs.push(text("qqfront", 30, y - 10, "front = -1（空队列）",
      { "text-anchor": "start", "font-size": 12, fill: "#5c6a85" }));
  }
  renderSVG(stage, "0 0 " + W + " " + H, specs);
}

/* 循环队列渲染器：环形布局 + front/rear 指针从圆心指向格子，直观展示"循环利用" */
function renderCircularQueue(stage, step) {
  const arr = (step && step.arr) ? step.arr : [];
  const vars = (step && step.vars) ? step.vars : {};
  const front = vars.front !== undefined ? vars.front : 0;
  const rear = vars.rear !== undefined ? vars.rear : 0;
  const size = vars.size !== undefined ? vars.size : 0;
  const n = Math.max(arr.length, 6);
  const cx = 150, cy = 118;
  const R = 90;
  const cellW = 42, cellH = 36;
  const specs = [];

  specs.push(text("cq-title", cx, 22, "循环队列 · 容量 " + n + "（最多存 " + (n - 1) + " 个元素）",
    { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: "#8b96a8" }));

  /* 是否在队列中：从 front 起 size 个（模 n） */
  function inQ(i) {
    if (size <= 0) return false;
    let d = (i - front + n) % n;
    return d >= 0 && d < size;
  }

  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + R * Math.cos(a) - cellW / 2;
    const y = cy + R * Math.sin(a) - cellH / 2;
    const active = inQ(i);
    const isFront = i === front && size > 0;
    const isRear = i === rear;
    let fill = active ? "#232c40" : "#161c29";
    let stroke = active ? "#4da3ff" : "#2e3a52";
    let sw = 1.5;
    if (isFront) { stroke = "#3ecf8e"; sw = 3; }
    else if (isRear) { stroke = "#ffd166"; sw = 3; }
    specs.push(rect("cqc-" + i, x, y, cellW, cellH, {
      rx: 5, fill: fill, stroke: stroke, "stroke-width": sw,
    }));
    specs.push(text("cqv-" + i, cx + R * Math.cos(a), cy + R * Math.sin(a) + 5,
      active ? String(arr[i]) : "",
      { "text-anchor": "middle", "font-size": 13, "font-weight": "bold", fill: "#e8eef7" }));
    /* 下标（格子外侧） */
    const ix = cx + (R + 24) * Math.cos(a);
    const iy = cy + (R + 24) * Math.sin(a);
    specs.push(text("cqi-" + i, ix, iy + 4, String(i),
      { "text-anchor": "middle", "font-size": 10, fill: "#5c6a85" }));
  }

  /* front / rear 指针：从圆心指向格子中心 */
  function ptrLabel(name, idx, color, key, valid) {
    if (!valid) return;
    const a = (2 * Math.PI * idx) / n - Math.PI / 2;
    const tx = cx + R * Math.cos(a);
    const ty = cy + R * Math.sin(a);
    specs.push(line(key, cx, cy, tx, ty, { stroke: color, "stroke-width": 1.5, "stroke-dasharray": "4 3" }));
    specs.push(text(key + "-t", cx - 40, cy + (name === "front" ? -6 : 14), name,
      { "font-size": 12, "font-weight": "bold", fill: color }));
  }
  ptrLabel("front", front, "#3ecf8e", "cqfront", size > 0);
  ptrLabel("rear", rear, "#ffd166", "cqrear", true);

  /* 状态说明 */
  specs.push(text("cq-status", cx, 238,
    size === 0
      ? "空队列：front = rear = " + front
      : "front = " + front + "（绿）　rear = " + rear + "（黄）　size = " + size + "　队列元素：" +
        (function () { const els = []; for (let k = 0; k < n; k++) if (inQ(k)) els.push(arr[k]); return els.join(", "); })(),
    { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: "#8b96a8" }));

  /* 图例 */
  specs.push(el("cq-legend-bg", "rect", {
    x: cx - 210, y: 258, width: 420, height: 20, rx: 4, fill: "#1a2332", opacity: 0.8 }));
  specs.push(text("cq-leg-1", cx - 190, 272, "■ ", { "font-size": 11, fill: "#3ecf8e" }));
  specs.push(text("cq-leg-1t", cx - 174, 272, "front", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("cq-leg-2", cx - 130, 272, "■ ", { "font-size": 11, fill: "#ffd166" }));
  specs.push(text("cq-leg-2t", cx - 114, 272, "rear", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("cq-leg-3", cx - 80, 272, "■ ", { "font-size": 11, fill: "#4da3ff" }));
  specs.push(text("cq-leg-3t", cx - 64, 272, "队中元素", { "font-size": 10, fill: "#8b96a8" }));

  renderSVG(stage, "0 0 " + (cx * 2) + " " + 290, specs);
}
