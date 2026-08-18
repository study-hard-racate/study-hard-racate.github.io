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
