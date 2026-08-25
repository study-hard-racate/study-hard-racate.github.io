/* 汉诺塔渲染器（renderMode: "hanoi"）：
   三柱 A/B/C + 盘片（宽度 ∝ 盘号，自底向上堆叠），当前移动的盘黄色高亮。
   数据：step.arr = A 柱（main 数组），vars = { B, C, size, cur }。
   cur 由 C 代码 moveDisk 内的局部变量提供（collectVars 收集所有作用域）。 */

function renderHanoi(stage, step) {
  const vars = step.vars || {};
  const A = step.arr || [];
  const B = vars.B || [];
  const C = vars.C || [];
  const n = vars.size !== undefined ? vars.size : Math.max(A.length, B.length, C.length);
  const cur = vars.cur;   /* 当前移动的盘号 */

  if (!n || (!A.length && !B.length && !C.length)) {
    renderSVG(stage, "0 0 300 120",
      [text("hn-empty", 150, 60, "（空柱）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }

  const W = 620, H = 280;
  const baseY = 232;              /* 底座 y */
  const diskH = 24;               /* 盘高 */
  const maxW = 168;               /* 最大盘半宽（盘 n） */
  const pegXs = [130, 310, 490];  /* 三柱中心 x */
  const specs = [];

  /* 底座 */
  specs.push(rect("hn-base", 30, baseY, W - 60, 6, { fill: "#3a4c6e", rx: 3 }));
  /* 三柱 */
  for (let p = 0; p < 3; p++) {
    specs.push(line("hn-peg-" + p, pegXs[p], baseY, pegXs[p], baseY - (n * diskH + 26),
      { stroke: "#4da3ff", "stroke-width": 4 }));
    specs.push(text("hn-peg-label-" + p, pegXs[p], baseY + 26, String.fromCharCode(65 + p),
      { "text-anchor": "middle", "font-size": 16, "font-weight": "bold", fill: "#93a4c2" }));
  }

  /* 盘片：三柱数组 0..n-1，下标 0 为底部 */
  const pegs = [["A", A], ["B", B], ["C", C]];
  for (let p = 0; p < 3; p++) {
    const name = pegs[p][0], arr = pegs[p][1];
    for (let level = 0; level < arr.length; level++) {
      const d = arr[level];
      if (!d || d <= 0) continue;
      const halfW = (d / n) * maxW;
      const x = pegXs[p] - halfW;
      const y = baseY - (level + 1) * diskH + 2;
      const isCur = cur !== undefined && cur !== null && cur === d;
      specs.push(rect("hn-" + name + "-" + d, x, y, halfW * 2, diskH - 3, {
        rx: 5,
        fill: isCur ? "#ffd166" : "#4da3ff",
        stroke: isCur ? "#ffd166" : (d === n ? "#5eead4" : "#2e3a52"),
        "stroke-width": isCur ? 3 : 1.5,
      }));
      specs.push(text("hn-" + name + "-" + d + "-t", pegXs[p], y + diskH / 2 + 1,
        String(d),
        { "text-anchor": "middle", "font-size": 12, "font-weight": "bold",
          fill: isCur ? "#1c2433" : "#e8eef7" }));
    }
  }

  /* 状态说明 */
  const statusY = H - 18;
  if (cur !== undefined && cur !== null && cur >= 1 && cur <= n) {
    specs.push(text("hn-status", W / 2, statusY,
      "正在移动盘 " + cur + "（黄色高亮）",
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: "#ffd166" }));
  } else if (A.length && C.length && A.every(v => v === 0) && B.every(v => v === 0)) {
    specs.push(text("hn-status", W / 2, statusY,
      "完成！全部 " + n + " 个盘已移到 C 柱",
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: "#3ecf8e" }));
  } else {
    specs.push(text("hn-status", W / 2, statusY,
      "目标：把 " + n + " 个盘从 A 移到 C，每次只能移一个且大盘不能压小盘",
      { "text-anchor": "middle", "font-size": 12, fill: "#8b96a8" }));
  }

  renderSVG(stage, "0 0 " + W + " " + H, specs);
}
