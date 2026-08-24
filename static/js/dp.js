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

/* ===== 2D DP 表格渲染器（LCS / 编辑距离）=====
   C 代码用一维数组模拟二维表：dp[i*(n+1)+j]，渲染端按行列重塑为 2D 网格。
   数据来源：step.dp（table/weights/n/phase/i/j/prevW）+ step.vars（b|t/m/path/path_len） */
function renderDP2D(stage, step, mode) {
  const dp = step.dp || {};
  const vars = step.vars || {};
  const table = dp.table || [];
  const seqA = dp.weights || [];      /* 序列 A（main 数组，行标签） */
  const seqB = vars.b || vars.t || [];/* 序列 B（b[] 或 t[]，列标签） */
  const m = vars.m !== undefined ? vars.m : (seqA.length - 1);
  const n = dp.n !== undefined ? dp.n : (seqB.length - 1);
  const phase = dp.phase !== undefined ? dp.phase : 0;
  const i = dp.i;
  const j = dp.j;
  const prevW = dp.prevW !== undefined ? dp.prevW : -1;
  const path = vars.path || [];
  const pathLen = vars.path_len !== undefined ? vars.path_len : 0;

  if (!table.length) {
    renderSVG(stage, "0 0 300 120",
      [text("dp-empty", 150, 60, "（空表格）",
        { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }

  const cols = n + 1;                 /* 列数 = B 长度 + 1 */
  const leftMargin = 46;              /* 行标签区 */
  const topMargin = 52;               /* 列标签区 */
  const specs = [];

  /* 在路径中的格子（回溯阶段绿色，当前回溯格优先黄色） */
  function inPath(row, col) {
    const idx = row * cols + col;
    for (let p = 0; p < pathLen; p++) if (path[p] === idx) return true;
    return false;
  }

  /* 阶段标签 */
  let phaseText = "", phaseColor = "#8b96a8";
  if (phase === 1) { phaseText = "阶段：初始化第 0 行 / 第 0 列"; phaseColor = DP_COLORS.init; }
  else if (phase === 2) { phaseText = "阶段：DP 填表（逐格计算）"; phaseColor = DP_COLORS.cur; }
  else if (phase === 3) { phaseText = "阶段：回溯（从右下角往回走）"; phaseColor = DP_COLORS.path; }
  else if (phase === 4) { phaseText = "阶段：完成 ✓"; phaseColor = DP_COLORS.processed; }
  specs.push(text("dp2-phase", leftMargin, 20, phaseText,
    { "font-size": 12, "font-weight": "bold", fill: phaseColor }));

  /* 序列标签 */
  specs.push(text("dp2-seqA", leftMargin - 12, 40, "A↓",
    { "font-size": 10, fill: "#8b96a8", "text-anchor": "middle" }));
  specs.push(text("dp2-seqB", leftMargin + 8, 40, "B→",
    { "font-size": 10, fill: "#8b96a8" }));

  /* 绘制网格：row = 0..m，col = 0..n */
  for (let row = 0; row <= m; row++) {
    for (let col = 0; col <= n; col++) {
      const x = leftMargin + col * (DP_CELL_W + DP_GAP);
      const y = topMargin + row * (DP_CELL_H + DP_GAP);
      const idx = row * cols + col;

      let fillColor = DP_COLORS.normal;
      let strokeColor = DP_COLORS.border;
      let strokeW = 1.5;

      /* 当前计算的格子（黄）：填表时的 (i,j)，或回溯时的当前位置 */
      const isCur = (phase === 2 && i !== undefined && i === row && j !== undefined && j === col) ||
                    (phase === 3 && i !== undefined && i === row && j !== undefined && j === col);
      /* 依赖的格子（紫） */
      const isDep = (phase === 2 && prevW >= 0 && prevW === idx);
      /* 回溯路径上的格子（绿） */
      const isPath = phase >= 3 && inPath(row, col);
      /* 初始化格子（粉）：第 0 行 / 第 0 列 */
      const isInit = phase === 1 && (row === 0 || col === 0);
      /* 已填好的格子（蓝）：当前 (i,j) 之前的行列；完成阶段全表已填好 */
      const isFilled = !isCur && !isDep && !isPath &&
        ((phase === 2 && (row < i || (row === i && col < j))) || phase === 4);

      if (isCur) {
        fillColor = DP_COLORS.cur; strokeColor = DP_COLORS.cur; strokeW = 2.5;
      } else if (isDep) {
        fillColor = DP_COLORS.dep; strokeColor = DP_COLORS.dep; strokeW = 2.5;
      } else if (isPath) {
        fillColor = DP_COLORS.path; strokeColor = DP_COLORS.path; strokeW = 2;
      } else if (isInit) {
        fillColor = DP_COLORS.init; strokeColor = DP_COLORS.init; strokeW = 1.5;
      } else if (isFilled) {
        fillColor = DP_COLORS.filled; strokeColor = DP_COLORS.filled; strokeW = 1.5;
      }

      specs.push(rect("dp2c-" + row + "-" + col, x, y, DP_CELL_W, DP_CELL_H, {
        rx: 4, fill: fillColor, stroke: strokeColor, "stroke-width": strokeW,
      }));

      const val = table[idx];
      const darkText = isCur || isDep || isInit;
      specs.push(text("dp2t-" + row + "-" + col, x + DP_CELL_W / 2, y + DP_CELL_H / 2 + 5,
        val !== undefined ? String(val) : "0",
        { "text-anchor": "middle", "font-size": 13, "font-weight": "bold",
          fill: darkText ? DP_COLORS.textDark : DP_COLORS.text }));
    }
  }

  /* 行标签（A 序列）：row = 1..m 显示 a[row-1] */
  for (let row = 1; row <= m; row++) {
    const y = topMargin + row * (DP_CELL_H + DP_GAP) + DP_CELL_H / 2 + 5;
    specs.push(text("dp2-row-" + row, leftMargin - 12, y, String(seqA[row - 1]),
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: "#5eead4" }));
  }
  /* 列标签（B 序列）：col = 1..n 显示 b[col-1] */
  for (let col = 1; col <= n; col++) {
    const x = leftMargin + col * (DP_CELL_W + DP_GAP) + DP_CELL_W / 2;
    specs.push(text("dp2-col-" + col, x, topMargin - 8, String(seqB[col - 1]),
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: "#5eead4" }));
  }

  /* 依赖箭头：从当前格指向依赖格（仅填表阶段） */
  if (phase === 2 && i !== undefined && j !== undefined && prevW >= 0) {
    const curRow = i, curCol = j;
    const depRow = Math.floor(prevW / cols), depCol = prevW % cols;
    const cx = leftMargin + curCol * (DP_CELL_W + DP_GAP) + DP_CELL_W / 2;
    const cy = topMargin + curRow * (DP_CELL_H + DP_GAP);
    const dx = leftMargin + depCol * (DP_CELL_W + DP_GAP) + DP_CELL_W / 2;
    const dy = topMargin + depRow * (DP_CELL_H + DP_GAP) + DP_CELL_H;
    specs.push(line("dp2-arrow", cx, cy + 2, dx, dy - 2,
      { stroke: DP_COLORS.formula, "stroke-width": 2, "stroke-dasharray": "5 3",
        "marker-end": "url(#dp2-arrowhead)" }));
  }

  /* 箭头标记定义 */
  specs.push(el("dp2-def-arrow", "defs", {}, ""));
  specs.push(el("dp2-arrowhead", "marker", {
    id: "dp2-arrowhead", viewBox: "0 0 10 10", refX: 9, refY: 5,
    markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse",
  }, ""));
  specs.push(el("dp2-arrowhead-path", "path", { d: "M 0 0 L 10 5 L 0 10 z", fill: DP_COLORS.formula }, ""));

  /* 状态说明 + 状态转移公式 */
  const statusY = topMargin + (m + 1) * (DP_CELL_H + DP_GAP) + 30;
  const isLcs = mode === "lcs";
  if (phase === 1) {
    specs.push(text("dp2-status", leftMargin, statusY,
      "第 0 行 / 第 0 列全部置 0" + (isLcs ? "（空序列与任何序列的公共子序列为 0）" : "（第 i 行第 0 列为 i，表示删除 i 次）"),
      { "font-size": 12, fill: DP_COLORS.init }));
  } else if (phase === 2 && i !== undefined && j !== undefined) {
    const aVal = seqA[i - 1], bVal = seqB[j - 1];
    if (isLcs) {
      if (aVal === bVal) {
        specs.push(text("dp2-status", leftMargin, statusY,
          "A[" + (i-1) + "]=" + aVal + " == B[" + (j-1) + "]=" + bVal + "　→　dp[" + i + "][" + j + "] = dp[" + (i-1) + "][" + (j-1) + "] + 1",
          { "font-size": 12, fill: DP_COLORS.cur }));
      } else {
        specs.push(text("dp2-status", leftMargin, statusY,
          "A[" + (i-1) + "]=" + aVal + " ≠ B[" + (j-1) + "]=" + bVal + "　→　dp[" + i + "][" + j + "] = max(dp[" + (i-1) + "][" + j + "], dp[" + i + "][" + (j-1) + "])",
          { "font-size": 12, fill: DP_COLORS.cur }));
      }
    } else {
      if (aVal === bVal) {
        specs.push(text("dp2-status", leftMargin, statusY,
          "S[" + (i-1) + "]=" + aVal + " == T[" + (j-1) + "]=" + bVal + "　→　dp[" + i + "][" + j + "] = dp[" + (i-1) + "][" + (j-1) + "]（无需操作）",
          { "font-size": 12, fill: DP_COLORS.cur }));
      } else {
        specs.push(text("dp2-status", leftMargin, statusY,
          "S[" + (i-1) + "]=" + aVal + " ≠ T[" + (j-1) + "]=" + bVal + "　→　dp = min(上+1 删除, 左+1 插入, 左上+1 替换)",
          { "font-size": 12, fill: DP_COLORS.cur }));
      }
    }
  } else if (phase === 3) {
    const curVal = (i !== undefined && j !== undefined) ? (table[i * cols + j] || 0) : 0;
    specs.push(text("dp2-status", leftMargin, statusY,
      isLcs
        ? "回溯中：从 dp[" + m + "][" + n + "]=" + curVal + " 沿依赖方向回走，绿色格为路径"
        : "回溯中：从 dp[" + m + "][" + n + "]=" + curVal + " 反推最小操作路径，绿色格为路径",
      { "font-size": 12, fill: DP_COLORS.path }));
  } else if (phase === 4) {
    const ans = (m >= 0 && n >= 0) ? (table[m * cols + n] || 0) : 0;
    specs.push(text("dp2-status", leftMargin, statusY,
      isLcs ? "完成！最长公共子序列长度 = dp[" + m + "][" + n + "] = " + ans
            : "完成！最小编辑距离 = dp[" + m + "][" + n + "] = " + ans,
      { "font-size": 13, "font-weight": "bold", fill: DP_COLORS.processed }));
  }

  /* 图例 */
  const legendY = statusY + 22;
  specs.push(el("dp2-legend-bg", "rect", {
    x: leftMargin - 5, y: legendY - 12, width: 500, height: 20, rx: 4,
    fill: "#1a2332", opacity: 0.8 }));
  specs.push(text("dp2-leg-1", leftMargin, legendY, "■ ", { "font-size": 11, fill: DP_COLORS.cur }));
  specs.push(text("dp2-leg-1t", leftMargin + 16, legendY, "当前", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("dp2-leg-2", leftMargin + 50, legendY, "■ ", { "font-size": 11, fill: DP_COLORS.dep }));
  specs.push(text("dp2-leg-2t", leftMargin + 66, legendY, "依赖", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("dp2-leg-3", leftMargin + 100, legendY, "■ ", { "font-size": 11, fill: DP_COLORS.filled }));
  specs.push(text("dp2-leg-3t", leftMargin + 116, legendY, "已填好", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("dp2-leg-4", leftMargin + 155, legendY, "■ ", { "font-size": 11, fill: DP_COLORS.path }));
  specs.push(text("dp2-leg-4t", leftMargin + 171, legendY, "回溯路径", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("dp2-leg-5", leftMargin + 220, legendY, "■ ", { "font-size": 11, fill: DP_COLORS.init }));
  specs.push(text("dp2-leg-5t", leftMargin + 236, legendY, "初始化", { "font-size": 10, fill: "#8b96a8" }));
  specs.push(text("dp2-leg-6", leftMargin + 285, legendY, "→ ", { "font-size": 11, fill: DP_COLORS.formula }));
  specs.push(text("dp2-leg-6t", leftMargin + 301, legendY, "依赖方向", { "font-size": 10, fill: "#8b96a8" }));

  /* 计算 viewBox */
  const Wtotal = leftMargin + (n + 1) * (DP_CELL_W + DP_GAP) + 40;
  const Htotal = legendY + 30;

  renderSVG(stage, "0 0 " + Wtotal + " " + Htotal, specs);
}
