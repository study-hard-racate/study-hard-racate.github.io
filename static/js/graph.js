/* 图渲染器（邻接表）：顶点圆形布局 + 有向边 + visited 访问高亮。
   输入为 csim 图模式快照：{ adj:{顶点号→[邻接节点id]}, data:{节点id→顶点号}, n, vars } */

function renderGraphCsim(stage, snap) {
  const n = (snap && snap.n) ? snap.n : 0;
  if (!n) {
    renderSVG(stage, "0 0 300 120",
      [text("gempty", 150, 60, "（空图，无邻接表）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }
  const R = 26;                    /* 顶点半径 */
  const cx = 65, cy = 65;          /* 布局圆心 */
  const RLAY = Math.max(75, Math.min(135, n * 26)); /* 布局圆半径 */
  const pos = [];
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + RLAY * Math.cos(a);
    const y = cy + RLAY * Math.sin(a);
    pos.push([x, y]);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  /* viewBox 按实际顶点范围计算（含边箭头），避免负坐标被裁剪 */
  const pad = R + 14;
  const vbX = minX - pad, vbY = minY - pad;
  const W = maxX - minX + 2 * pad;
  const H = maxY - minY + 2 * pad;
  const specs = [];

  /* 边：邻接节点 val 即目标顶点号 */
  for (const u in snap.adj) {
    for (const vid of snap.adj[u]) {
      const tv = snap.data[vid];
      if (tv === undefined || tv === null || pos[tv] === undefined) continue;
      const [x1, y1] = pos[Number(u)];
      const [x2, y2] = pos[tv];
      const dx = x2 - x1, dy = y2 - y1;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / d, uy = dy / d;
      const sx = x1 + ux * R, sy = y1 + uy * R;
      const tipX = x2 - ux * (R + 7), tipY = y2 - uy * (R + 7);
      specs.push(line("ge-" + u + "-" + vid, sx, sy, tipX, tipY,
        { stroke: "#4da3ff", "stroke-width": 2 }));
      specs.push(path("ga-" + u + "-" + vid,
        "M" + tipX + "," + tipY +
        " L" + (tipX - ux * 9 + -uy * 5) + "," + (tipY - uy * 9 + ux * 5) +
        " L" + (tipX - ux * 9 + uy * 5) + "," + (tipY - uy * 9 - ux * 5) + " Z",
        { fill: "#4da3ff" }));
    }
  }

  /* 顶点：visited 数组为 1 的顶点绿色 */
  const visited = (snap.vars && snap.vars.visited) ? snap.vars.visited : null;
  for (let i = 0; i < n; i++) {
    const [x, y] = pos[i];
    const done = !!(visited && visited[i] === 1);
    const isCur = (snap.curVertex !== undefined && snap.curVertex === i);
    const fill = isCur ? "#ffd166" : (done ? "#3ecf8e" : "#232c40");
    const stroke = isCur ? "#ffd166" : (done ? "#3ecf8e" : "#4da3ff");
    specs.push(circ("gn-" + i, x, y, R, { fill: fill, stroke: stroke, "stroke-width": isCur ? 3 : 1.5 }));
    specs.push(text("gt-" + i, x, y + 5, String(i),
      { "text-anchor": "middle", "font-size": 16, "font-weight": "bold", fill: isCur ? "#1c2433" : "#e8eef7" }));
  }
  renderSVG(stage, vbX + " " + vbY + " " + W + " " + H, specs);
}

/* 拓扑排序渲染器：在图的基础上显示入度标签和结果顺序 */
function renderTopological(stage, step) {
  const snap = step.graph;
  const n = (snap && snap.n) ? snap.n : 0;
  if (!n) {
    renderSVG(stage, "0 0 300 120",
      [text("gempty", 150, 60, "（空图，无邻接表）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }
  const R = 26;
  const cx = 65, cy = 65;
  const RLAY = Math.max(75, Math.min(135, n * 26));
  const pos = [];
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + RLAY * Math.cos(a);
    const y = cy + RLAY * Math.sin(a);
    pos.push([x, y]);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const pad = R + 20;
  const vbX = minX - pad, vbY = minY - pad;
  const W = maxX - minX + 2 * pad;
  const H = maxY - minY + 2 * pad + 30;
  const specs = [];

  /* 边 */
  for (const u in snap.adj) {
    for (const vid of snap.adj[u]) {
      const tv = snap.data[vid];
      if (tv === undefined || tv === null || pos[tv] === undefined) continue;
      const [x1, y1] = pos[Number(u)];
      const [x2, y2] = pos[tv];
      const dx = x2 - x1, dy = y2 - y1;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / d, uy = dy / d;
      const sx = x1 + ux * R, sy = y1 + uy * R;
      const tipX = x2 - ux * (R + 7), tipY = y2 - uy * (R + 7);
      specs.push(line("ge-" + u + "-" + vid, sx, sy, tipX, tipY,
        { stroke: "#4da3ff", "stroke-width": 2 }));
      specs.push(path("ga-" + u + "-" + vid,
        "M" + tipX + "," + tipY +
        " L" + (tipX - ux * 9 + -uy * 5) + "," + (tipY - uy * 9 + ux * 5) +
        " L" + (tipX - ux * 9 + uy * 5) + "," + (tipY - uy * 9 - ux * 5) + " Z",
        { fill: "#4da3ff" }));
    }
  }

  /* 获取状态 */
  const visited = (snap.vars && snap.vars.visited) ? snap.vars.visited : null;
  const inDegree = (snap.vars && snap.vars.inDegree) ? snap.vars.inDegree : null;
  const result = (snap.vars && snap.vars.result) ? snap.vars.result : null;
  const top = (snap.vars && snap.vars.top !== undefined) ? snap.vars.top : 0;

  /* 顶点 */
  for (let i = 0; i < n; i++) {
    const [x, y] = pos[i];
    const done = !!(visited && visited[i] === 1);
    const isCur = (snap.curVertex !== undefined && snap.curVertex === i);
    const fill = isCur ? "#ffd166" : (done ? "#3ecf8e" : "#232c40");
    const stroke = isCur ? "#ffd166" : (done ? "#3ecf8e" : "#4da3ff");
    specs.push(circ("gn-" + i, x, y, R, { fill: fill, stroke: stroke, "stroke-width": isCur ? 3 : 1.5 }));
    specs.push(text("gt-" + i, x, y + 5, String(i),
      { "text-anchor": "middle", "font-size": 16, "font-weight": "bold", fill: isCur ? "#1c2433" : "#e8eef7" }));
    
    /* 入度标签（顶点下方） */
    if (inDegree) {
      const deg = inDegree[i] !== undefined ? inDegree[i] : "-";
      const degColor = (deg === 0) ? "#4da3ff" : "#b98cff";
      specs.push(text("gd-" + i, x, y + R + 16, "入度:" + deg,
        { "text-anchor": "middle", "font-size": 11, fill: degColor }));
    }
  }

  /* 结果序列（底部） */
  if (result && top > 0) {
    const resultY = maxY + pad + 15;
    specs.push(text("rlabel", (minX + maxX) / 2, resultY, "排序结果：",
      { "text-anchor": "middle", "font-size": 12, fill: "#93a4c2" }));
    for (let i = 0; i < top; i++) {
      const rx = (minX + maxX) / 2 - (top - 1) * 14 + i * 28;
      specs.push(text("rv-" + i, rx, resultY + 18, String(result[i]),
        { "text-anchor": "middle", "font-size": 14, "font-weight": "bold", fill: "#3ecf8e" }));
      if (i < top - 1) {
        specs.push(text("ra-" + i, rx + 14, resultY + 18, "→",
          { "text-anchor": "middle", "font-size": 12, fill: "#93a4c2" }));
      }
    }
  }

  renderSVG(stage, vbX + " " + vbY + " " + W + " " + H, specs);
}
