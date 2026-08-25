/* Trie 字典树渲染器（renderMode: "trie"）：
   数组模拟 trie：ch[i] 为节点字母（1=A 2=B 3=C 4=D，根为 0），
   a/b/c/d[i] 为四个字母的子节点编号（-1 表示无），isWord[i] 标记单词结尾。
   数据：step.arr = ch（main），vars = { isWord, a, b, c, d, phase, cur, cnt }。 */

function renderTrie(stage, step) {
  const vars = step.vars || {};
  const ch = step.arr || [];
  const isWord = vars.isWord || [];
  const a = vars.a || [];
  const b = vars.b || [];
  const c = vars.c || [];
  const d = vars.d || [];
  const phase = vars.phase !== undefined ? vars.phase : 0;
  const cur = vars.cur !== undefined ? vars.cur : -1;
  const cnt = vars.cnt !== undefined ? vars.cnt : 0;

  if (!ch.length || !a.length) {
    renderSVG(stage, "0 0 300 120",
      [text("tr-empty", 150, 60, "（空树，等待初始化）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }

  const LETTER = ["·", "A", "B", "C", "D"];
  const EDGE_COLORS = { 1: "#4da3ff", 2: "#3ecf8e", 3: "#ffd166", 4: "#b98cff" };

  /* 收集有效节点（ch > 0 或根 0），并建立 children 列表 */
  const nodes = [0];
  const childIdx = [[], [], [], [], []];
  for (let i = 0; i < ch.length; i++) {
    if (ch[i] >= 1 && ch[i] <= 4) nodes.push(i);
  }
  for (let i = 0; i < nodes.length; i++) {
    const id = nodes[i];
    const arrs = [a[id], b[id], c[id], d[id]];
    for (let l = 0; l < 4; l++) {
      if (arrs[l] !== undefined && arrs[l] >= 0) childIdx[l + 1].push([id, arrs[l]]);
    }
  }
  /* childIdx[letter] = [[parent, child], ...] */

  /* 递归布局：先算叶子数，再分配 x */
  const xPos = {}, yPos = {};
  const W = 560, H = 300;
  const topY = 70, levelH = 62;

  function computeLeafCount(id) {
    let kids = 0;
    for (let l = 1; l <= 4; l++) {
      for (const pair of childIdx[l]) if (pair[0] === id) kids++;
    }
    if (!kids) return 1;
    let total = 0;
    for (let l = 1; l <= 4; l++) {
      for (const pair of childIdx[l]) if (pair[0] === id) total += computeLeafCount(pair[1]);
    }
    return total;
  }
  const leafCount = computeLeafCount(0);
  const margin = 60, spacing = (W - 2 * margin) / Math.max(1, leafCount - 1);
  let leafSlot = leafCount;
  function assignX(id, depth) {
    let kids = [];
    for (let l = 1; l <= 4; l++) {
      for (const pair of childIdx[l]) if (pair[0] === id) kids.push(pair[1]);
    }
    yPos[id] = topY + depth * levelH;
    if (!kids.length) {
      leafSlot--;
      xPos[id] = margin + leafSlot * spacing;
      return;
    }
    let sum = 0;
    for (const k of kids) { assignX(k, depth + 1); sum += xPos[k]; }
    xPos[id] = sum / kids.length;
  }
  assignX(0, 0);

  const specs = [];

  /* 阶段标签 */
  let phaseText = "", phaseColor = "#8b96a8";
  if (phase === 1) { phaseText = "阶段：初始化（创建根节点，children 全部 -1）"; phaseColor = "#f472b6"; }
  else if (phase === 2) { phaseText = "阶段：插入单词（沿字母路径走，缺失则创建节点）"; phaseColor = "#ffd166"; }
  else if (phase === 3) { phaseText = "阶段：完成 ✓ 共 " + cnt + " 个节点，3 个单词已插入"; phaseColor = "#3ecf8e"; }
  specs.push(text("tr-phase", 30, 26, phaseText,
    { "font-size": 12, "font-weight": "bold", fill: phaseColor }));

  /* 边（按字母着色） */
  for (let l = 1; l <= 4; l++) {
    for (const pair of childIdx[l]) {
      const [p, child] = pair;
      if (xPos[p] === undefined || xPos[child] === undefined) continue;
      const x1 = xPos[p], y1 = yPos[p] + 16;
      const x2 = xPos[child], y2 = yPos[child] - 16;
      specs.push(line("tre-" + p + "-" + child, x1, y1, x2, y2,
        { stroke: EDGE_COLORS[l], "stroke-width": 1.5 }));
      /* 字母标签（边中点） */
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      specs.push(rect("trb-" + p + "-" + child, mx - 8, my - 9, 16, 15, { fill: "#1a2332", rx: 3, opacity: 0.9 }));
      specs.push(text("trl-" + p + "-" + child, mx, my + 3, LETTER[l],
        { "text-anchor": "middle", "font-size": 10, "font-weight": "bold", fill: EDGE_COLORS[l] }));
    }
  }

  /* 节点 */
  for (const id of nodes) {
    const x = xPos[id], y = yPos[id];
    const letter = ch[id] !== undefined ? LETTER[ch[id]] : "·";
    const isCur = id === cur && phase === 2;
    const word = isWord[id] === 1;
    let fill = "#232c40", stroke = "#4da3ff", sw = 1.5, tc = "#e8eef7";
    if (isCur) { fill = "#ffd166"; stroke = "#ffd166"; sw = 3; tc = "#1c2433"; }
    else if (word) { stroke = "#3ecf8e"; sw = 2.5; }
    specs.push(circ("trn-" + id, x, y, 16, { fill: fill, stroke: stroke, "stroke-width": sw }));
    specs.push(text("trt-" + id, x, y + 5, id === 0 ? "根" : letter,
      { "text-anchor": "middle", "font-size": 13, "font-weight": "bold", fill: tc }));
    /* 单词结尾标记（下方小圆点） */
    if (word) {
      specs.push(circ("trw-" + id, x, y + 24, 4, { fill: "#3ecf8e" }));
    }
    /* 节点编号（上方小字） */
    specs.push(text("trni-" + id, x, y - 22, "#" + id,
      { "text-anchor": "middle", "font-size": 9, fill: "#5c6a85" }));
  }

  /* 状态说明 */
  const statusY = H - 22;
  if (phase === 2 && cur >= 0) {
    specs.push(text("tr-status", W / 2, statusY,
      "当前节点 #" + cur + (cur === 0 ? "（根）" : "，字母 " + LETTER[ch[cur]]),
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: "#ffd166" }));
  } else if (phase === 3) {
    specs.push(text("tr-status", W / 2, statusY,
      "完成！前缀共享：AB、ABC 共用 A→B 路径，插入 AD 时 A 节点复用",
      { "text-anchor": "middle", "font-size": 12, "font-weight": "bold", fill: "#3ecf8e" }));
  } else {
    specs.push(text("tr-status", W / 2, statusY,
      "根节点下方逐字母延伸；绿色小圆点 = 单词结尾",
      { "text-anchor": "middle", "font-size": 12, fill: "#8b96a8" }));
  }

  renderSVG(stage, "0 0 " + W + " " + H, specs);
}
