/* 动态规划可视化渲染器：二维表格 + 依赖高亮 + 回溯路径 */

const DP_CELL_W = 48;
const DP_CELL_H = 32;
const DP_GAP = 3;

const DP_COLORS = {
  normal:   "#232c40",
  cur:      "#ffd166",    /* 当前计算的格子（黄） */
  dep:      "#b98cff",    /* 依赖的格子（紫） */
  filled:   "#4da3ff",    /* 已填好的格子（蓝） */
  path:     "#3ecf8e",    /* 回溯路径（绿） */
  processed:"#3ecf8e",    /* 已处理物品标记（绿） */
  border:   "#2e3a52",
  text:     "#e8eef7",
  textDark: "#1c2433",
  init:     "#f472b6",    /* 初始化阶段（粉） */
  formula:  "#b98cff",    /* 公式文字（紫） */
};

/* 渲染DP表格 */
function renderDP(stage, step) {
  const dp = step.dp;
  const vars = step.vars || {};
  const table = dp.table || [];
  const weights = dp.weights || [];
  const values = dp.values || [];
  const n = dp.n || 0;
  const W = dp.W || 0;
  const phase = dp.phase !== undefined ? dp.phase : 0;
  const i = dp.i;
  const j = dp.j;
  const prevW = dp.prevW;
  const processed = dp.processed || [];
  
  if (!table.length) {
    renderSVG(stage, "0 0 300 120",
      [text("dp-empty", 150, 60, "（空表格）", 
        { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }

  const leftMargin = 60;
  const topMargin = 80;
  const specs = [];
  
  /* 物品信息 */
  specs.push(text("dp-items-label", leftMargin, 30, "物品：", 
    { "font-size": 12, fill: "#8b96a8" }));
  for (let idx = 0; idx < n; idx++) {
    const x = leftMargin + 40 + idx * 90;
    let itemColor = "#5eead4";
    let itemLabel = "#" + idx + "(w=" + weights[idx] + ",v=" + values[idx] + ")";
    /* 已处理物品：绿色对勾 */
    if (processed.indexOf(idx) >= 0) {
      itemColor = DP_COLORS.processed;
      itemLabel = "✓ " + itemLabel;
    }
    /* 当前物品：黄色 */
    if (i !== undefined && i === idx && phase === 2) {
      itemColor = DP_COLORS.cur;
      itemLabel = "▶ " + itemLabel;
    }
    specs.push(text("dp-item-" + idx, x, 30, itemLabel,
      { "font-size": 11, fill: itemColor, "font-weight": (i === idx) ? "bold" : "normal" }));
  }
  
  /* 阶段标签 */
  let phaseText = "";
  let phaseColor = "#8b96a8";
  if (phase === 1) { phaseText = "阶段：初始化 dp[] = 0"; phaseColor = DP_COLORS.init; }
  else if (phase === 2) { phaseText = "阶段：DP 填表"; phaseColor = DP_COLORS.cur; }
  else if (phase === 3) { phaseText = "阶段：完成 ✓"; phaseColor = DP_COLORS.processed; }
  specs.push(text("dp-phase", leftMargin, 50, phaseText,
    { "font-size": 12, "font-weight": "bold", fill: phaseColor }));
  
  /* 容量标签 */
  specs.push(text("dp-cap-label", leftMargin, 70, "容量 →", 
    { "font-size": 11, fill: "#8b96a8" }));
  
  /* DP表格 */
  for (let c = 0; c <= W; c++) {
    const x = leftMargin + c * (DP_CELL_W + DP_GAP);
    const y = topMargin;
    
    let fillColor = DP_COLORS.normal;
    let strokeColor = DP_COLORS.border;
    let strokeW = 1.5;
    
    /* 高亮：当前计算的单元格（黄） */
    const isCur = (j !== undefined && j === c && phase === 2);
    /* 高亮：依赖的单元格 dp[j-w[i]]（紫） */
    const isDep = (prevW >= 0 && prevW === c && phase === 2);
    
    if (isCur) {
      fillColor = DP_COLORS.cur;
      strokeColor = DP_COLORS.cur;
      strokeW = 2.5;
    } else if (isDep) {
      fillColor = DP_COLORS.dep;
      strokeColor = DP_COLORS.dep;
      strokeW = 2.5;
    }
    
    specs.push(rect("dpc-" + c, x, y, DP_CELL_W, DP_CELL_H, {
      rx: 4, fill: fillColor, stroke: strokeColor, "stroke-width": strokeW,
    }));
    
    /* 单元格值 */
    const val = table[c];
    specs.push(text("dpt-" + c, x + DP_CELL_W / 2, y + DP_CELL_H / 2 + 5,
      val !== undefined ? String(val) : "0",
      { "text-anchor": "middle", "font-size": 13, "font-weight": "bold", 
        fill: (isCur || isDep) ? DP_COLORS.textDark : DP_COLORS.text }));
    
    /* 容量刻度 */
    specs.push(text("dpc-label-" + c, x + DP_CELL_W / 2, topMargin + DP_CELL_H + 15,
      String(c), { "text-anchor": "middle", "font-size": 10, fill: "#8b96a8" }));
  }
  
  /* 依赖箭头：从当前格到依赖格 */
  if (phase === 2 && j !== undefined && prevW >= 0) {
    const cx = leftMargin + j * (DP_CELL_W + DP_GAP) + DP_CELL_W / 2;
    const cy = topMargin;
    const dx = leftMargin + prevW * (DP_CELL_W + DP_GAP) + DP_CELL_W / 2;
    const dy = topMargin + DP_CELL_H;
    specs.push(line("dp-arrow", cx, cy + 2, dx, dy - 2,
      { stroke: DP_COLORS.formula, "stroke-width": 2, "stroke-dasharray": "5 3",
        "marker-end": "url(#dp-arrowhead)" }));
  }
  
  /* 箭头标记定义 */
  specs.push(el("dp-def-arrow", "defs", {}, ""));
  specs.push(el("dp-arrowhead", "marker", {
    id: "dp-arrowhead", viewBox: "0 0 10 10", refX: 9, refY: 5,
    markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse",
  }, ""));
  specs.push(el("dp-arrowhead-path", "path", { d: "M 0 0 L 10 5 L 0 10 z", fill: DP_COLORS.formula }, ""));
  
  /* 状态说明 */
  const statusY = topMargin + DP_CELL_H + 35;
  if (phase === 1) {
    specs.push(text("dp-status", leftMargin, statusY, 
      "将 dp[0.." + W + "] 全部初始化为 0",
      { "font-size": 12, fill: DP_COLORS.init }));
  } else if (phase === 2 && i !== undefined && j !== undefined) {
    specs.push(text("dp-status-i", leftMargin, statusY, 
      "物品 #" + i + " (w=" + (weights[i] || 0) + ", v=" + (values[i] || 0) + ")　容量 " + j,
      { "font-size": 12, fill: DP_COLORS.cur }));
  } else if (phase === 3) {
    specs.push(text("dp-status", leftMargin, statusY, 
      "最大价值 = dp[" + W + "] = " + (table[W] || 0),
      { "font-size": 13, "font-weight": "bold", fill: DP_COLORS.processed }));
  }
  
  /* 状态转移公式 */
  const formulaY = statusY + 20;
  if (phase === 2 && i !== undefined && j !== undefined) {
    const wi = weights[i] || 0;
    const vi = values[i] || 0;
    if (j >= wi) {
      const oldVal = table[j] || 0;
      const depVal = (table[prevW] || 0) + vi;
      const picked = depVal > oldVal;
      specs.push(text("dp-formula", leftMargin, formulaY, 
        "dp[" + j + "] = max(dp[" + j + "]=" + oldVal + ", dp[" + prevW + "]+" + vi + "=" + depVal + ") = " + (picked ? depVal : oldVal),
        { "font-size": 11, fill: DP_COLORS.formula }));
      specs.push(text("dp-result", leftMargin + 380, formulaY,
        picked ? "← 选" : "← 不选",
        { "font-size": 11, "font-weight": "bold", fill: picked ? "#3ecf8e" : "#8b96a8" }));
    } else {
      specs.push(text("dp-formula", leftMargin, formulaY, 
        "容量不足 (w[i]=" + wi + " > " + j + ")，跳过",
        { "font-size": 11, fill: "#8b96a8" }));
    }
  }
  
  /* 图例 */
  const legendY = formulaY + 25;
  specs.push(el("dp-legend-bg", "rect", {
    x: leftMargin - 5, y: legendY - 12, width: 480, height: 20, rx: 4,
    fill: "#1a2332", opacity: 0.8 }));
  specs.push(text("dp-leg-1", leftMargin, legendY, 
    "■ ", { "font-size": 11, fill: DP_COLORS.cur }));
  specs.push(text("dp-leg-1t", leftMargin + 16, legendY, 
    "当前", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("dp-leg-2", leftMargin + 50, legendY, 
    "■ ", { "font-size": 11, fill: DP_COLORS.dep }));
  specs.push(text("dp-leg-2t", leftMargin + 66, legendY, 
    "依赖", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("dp-leg-3", leftMargin + 100, legendY, 
    "■ ", { "font-size": 11, fill: DP_COLORS.filled }));
  specs.push(text("dp-leg-3t", leftMargin + 116, legendY, 
    "已填好", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("dp-leg-4", leftMargin + 155, legendY, 
    "■ ", { "font-size": 11, fill: DP_COLORS.processed }));
  specs.push(text("dp-leg-4t", leftMargin + 171, legendY, 
    "已处理", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("dp-leg-5", leftMargin + 215, legendY, 
    "■ ", { "font-size": 11, fill: DP_COLORS.init }));
  specs.push(text("dp-leg-5t", leftMargin + 231, legendY, 
    "初始化", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("dp-leg-6", leftMargin + 280, legendY, 
    "→ ", { "font-size": 11, fill: DP_COLORS.formula }));
  specs.push(text("dp-leg-6t", leftMargin + 296, legendY, 
    "依赖方向", { "font-size": 10, fill: "#8b96a8" }));
  
  /* 计算 viewBox */
  const Wtotal = leftMargin + (W + 1) * (DP_CELL_W + DP_GAP) + 40;
  const Htotal = legendY + 30;
  
  renderSVG(stage, "0 0 " + Wtotal + " " + Htotal, specs);
}
