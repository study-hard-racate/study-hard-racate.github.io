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

/* ===== Dijkstra 最短路径渲染器（renderMode: "dijkstra"）=====
   输入为数组模式步骤：step.arr = dist[]（main），step.vars = { n, fin[], parent[], w[], phase, u, v }。
   圆形布局 + 边权重标签 + 距离标签 + 已确定顶点绿色 + 最短路径树绿色加粗。 */
function renderDijkstra(stage, step) {
  const vars = step.vars || {};
  const n = vars.n || 0;
  const dist = (step.arr && Array.isArray(step.arr)) ? step.arr : (vars.dist || []);
  if (!n || !dist.length) {
    renderSVG(stage, "0 0 300 120",
      [text("dj-empty", 150, 60, "（空图，无邻接信息）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }
  const w = vars.w || [];
  const fin = vars.fin || [];
  const parent = vars.parent || [];
  const phase = vars.phase !== undefined ? vars.phase : 0;
  const cur = vars.u !== undefined ? vars.u : null;   /* 当前选中的顶点（黄） */
  const relaxV = vars.v !== undefined ? vars.v : null; /* 正在松弛的邻居（紫） */
  const INF = 9999;

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
  /* 顶部留出阶段标签与距离标签空间 */
  const pad = R + 40;
  const vbX = minX - pad, vbY = minY - pad - 24;
  const W = maxX - minX + 2 * pad;
  const H = maxY - minY + 2 * pad + 34;
  const specs = [];

  /* 阶段标签 */
  let phaseText = "", phaseColor = "#8b96a8";
  if (phase === 1) { phaseText = "阶段：初始化（dist 置 ∞，源点 dist[0]=0）"; phaseColor = "#f472b6"; }
  else if (phase === 2) { phaseText = "阶段：主循环（选最近未确定顶点 → 松弛邻居）"; phaseColor = "#ffd166"; }
  else if (phase === 3) { phaseText = "阶段：完成 ✓ 全部顶点最短距离已确定"; phaseColor = "#3ecf8e"; }
  specs.push(text("dj-phase", minX, vbY + 22, phaseText,
    { "font-size": 12, "font-weight": "bold", fill: phaseColor }));

  /* 判断边是否为最短路径树边：parent[v] === u 或 parent[u] === v */
  function isTreeEdge(u, v) {
    return (parent[u] === v) || (parent[v] === u);
  }

  /* 边（无向：只画一次 u < v），权重标签 */
  for (let u = 0; u < n; u++) {
    for (let v = u + 1; v < n; v++) {
      const wt = w[u * n + v];
      if (!wt || wt <= 0) continue;
      const [x1, y1] = pos[u];
      const [x2, y2] = pos[v];
      const dx = x2 - x1, dy = y2 - y1;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / d, uy = dy / d;
      const sx = x1 + ux * R, sy = y1 + uy * R;
      const tipX = x2 - ux * (R + 7), tipY = y2 - uy * (R + 7);
      const tree = phase >= 2 && isTreeEdge(u, v);
      const stroke = tree ? "#3ecf8e" : "#4da3ff";
      const sw = tree ? 3 : 2;
      specs.push(line("de-" + u + "-" + v, sx, sy, tipX, tipY, { stroke: stroke, "stroke-width": sw }));
      /* 权重标签（边中点，避开箭头） */
      const mx = (x1 + x2) / 2 + (tree ? 0 : -uy * 10);
      const my = (y1 + y2) / 2 + (tree ? 0 : ux * 10);
      specs.push(rect("deb-" + u + "-" + v, mx - 9, my - 9, 18, 16, { fill: "#1a2332", rx: 3, opacity: 0.9 }));
      specs.push(text("dwt-" + u + "-" + v, mx, my + 4, String(wt),
        { "text-anchor": "middle", "font-size": 11, "font-weight": "bold", fill: tree ? "#3ecf8e" : "#5eead4" }));
    }
  }

  /* 顶点：dist 标签 + 状态着色 */
  for (let i = 0; i < n; i++) {
    const [x, y] = pos[i];
    const done = fin[i] === 1;
    const isCur = cur === i;
    const isRelax = relaxV === i && phase === 2;
    let fill = "#232c40", stroke = "#4da3ff", sw = 1.5, tc = "#e8eef7";
    if (isCur) { fill = "#ffd166"; stroke = "#ffd166"; sw = 3; tc = "#1c2433"; }
    else if (isRelax) { fill = "#b98cff"; stroke = "#b98cff"; sw = 3; tc = "#1c2433"; }
    else if (done) { fill = "#3ecf8e"; stroke = "#3ecf8e"; sw = 2; }
    specs.push(circ("dn-" + i, x, y, R, { fill: fill, stroke: stroke, "stroke-width": sw }));
    specs.push(text("dt-" + i, x, y + 5, String(i),
      { "text-anchor": "middle", "font-size": 16, "font-weight": "bold", fill: tc }));

    /* 距离标签（顶点上方） */
    const dv = dist[i] !== undefined ? dist[i] : INF;
    const dText = dv >= INF ? "∞" : String(dv);
    const dFill = isCur ? "#ffd166" : (done ? "#3ecf8e" : (dv < INF ? "#93a4c2" : "#5c6a85"));
    specs.push(rect("djb-" + i, x - 14, y - R - 24, 28, 18, { fill: "#1a2332", rx: 4, opacity: 0.92 }));
    specs.push(text("djv-" + i, x, y - R - 11, dText,
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: dFill }));
  }

  /* 状态说明 */
  const statusY = maxY + pad - 6;
  if (phase === 1) {
    specs.push(text("dj-status", (minX + maxX) / 2, statusY,
      "dist[0]=0，其余顶点距离暂为 ∞（9999 表示无穷大）",
      { "text-anchor": "middle", "font-size": 12, fill: "#f472b6" }));
  } else if (phase === 2) {
    if (cur !== null && cur !== undefined && relaxV !== null && relaxV !== undefined) {
      const du = dist[cur] !== undefined ? dist[cur] : INF;
      const dv = dist[relaxV] !== undefined ? dist[relaxV] : INF;
      const wt = w[cur * n + relaxV] || 0;
      specs.push(text("dj-status", (minX + maxX) / 2, statusY,
        "松弛：dist[" + relaxV + "] 原=" + (dv >= INF ? "∞" : dv) +
        "，经 " + cur + " 为 " + (du >= INF ? "∞" : du) + "+" + wt + "=" +
        ((du + wt) < dv ? (du + wt) : "不更新"),
        { "text-anchor": "middle", "font-size": 12, fill: "#b98cff" }));
    } else if (cur !== null && cur !== undefined) {
      specs.push(text("dj-status", (minX + maxX) / 2, statusY,
        "选择未确定顶点中距离最小的 u=" + cur + "，标记 fin[" + cur + "]=1（绿色）",
        { "text-anchor": "middle", "font-size": 12, fill: "#ffd166" }));
    } else {
      specs.push(text("dj-status", (minX + maxX) / 2, statusY,
        "在未确定最短距离的顶点中选出 dist 最小者",
        { "text-anchor": "middle", "font-size": 12, fill: "#8b96a8" }));
    }
  } else if (phase === 3) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      parts.push("0→" + i + "=" + (dist[i] >= INF ? "∞" : dist[i]));
    }
    specs.push(text("dj-status", (minX + maxX) / 2, statusY,
      "完成！" + parts.join("　"),
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: "#3ecf8e" }));
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
    const deg = inDegree ? (inDegree[i] !== undefined ? inDegree[i] : -1) : -1;
    const isReady = deg === 0 && !done && !isCur;
    const fill = isCur ? "#ffd166" : (done ? "#3ecf8e" : (isReady ? "rgba(77,163,255,0.25)" : "#232c40"));
    const stroke = isCur ? "#ffd166" : (done ? "#3ecf8e" : (isReady ? "#4da3ff" : "#4da3ff"));
    const sw = isCur ? 3 : (isReady ? 2.5 : 1.5);
    specs.push(circ("gn-" + i, x, y, R, { fill: fill, stroke: stroke, "stroke-width": sw }));
    specs.push(text("gt-" + i, x, y + 5, String(i),
      { "text-anchor": "middle", "font-size": 16, "font-weight": "bold", fill: isCur ? "#1c2433" : "#e8eef7" }));
    
    /* 入度标签（顶点下方），入度为 0 时高亮 */
    if (inDegree) {
      if (deg === 0 && !done) {
        /* 入度为 0 的顶点显示蓝色背景标签 */
        specs.push(rect("gdb-" + i, x - 22, y + R + 4, 44, 18, { fill: "#4da3ff", rx: 9, opacity: 0.2 }));
        specs.push(text("gd-" + i, x, y + R + 16, "入度:0",
          { "text-anchor": "middle", "font-size": 11, fill: "#4da3ff", "font-weight": "bold" }));
      } else {
        specs.push(text("gd-" + i, x, y + R + 16, "入度:" + deg,
          { "text-anchor": "middle", "font-size": 11, fill: done ? "#3ecf8e" : "#b98cff" }));
      }
    }
  }

  /* 结果序列（底部） */
  if (result && top > 0) {
    const resultY = maxY + pad + 15;
    specs.push(text("rlabel", (minX + maxX) / 2, resultY, "排序结果：",
      { "text-anchor": "middle", "font-size": 12, fill: "#93a4c2" }));
    for (let i = 0; i < top; i++) {
      const rx = (minX + maxX) / 2 - (top - 1) * 16 + i * 32;
      /* 结果项背景 */
      specs.push(rect("rr-" + i, rx - 12, resultY + 6, 24, 20, { fill: "#3ecf8e", rx: 4, opacity: 0.15 }));
      specs.push(text("rv-" + i, rx, resultY + 20, String(result[i]),
        { "text-anchor": "middle", "font-size": 14, "font-weight": "bold", fill: "#3ecf8e" }));
      if (i < top - 1) {
        specs.push(text("ra-" + i, rx + 16, resultY + 20, "→",
          { "text-anchor": "middle", "font-size": 13, fill: "#93a4c2" }));
      }
    }
  }

  renderSVG(stage, vbX + " " + vbY + " " + W + " " + H, specs);
}
