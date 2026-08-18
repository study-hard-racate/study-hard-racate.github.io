/* 树与图共享逻辑：布局计算 + specs 生成（配合 svg.js 平滑渲染） */

/* 节点对象: {data, left, right, depth}。中序遍历计算 x，y=深度*间距 */
function treeLayout(root) {
  const order = [];
  (function inorder(n) {
    if (!n) return;
    inorder(n.left);
    order.push(n);
    inorder(n.right);
  })(root);
  const W = 90, H = 74;
  order.forEach((n, i) => { n.x = (i + 1) * W; n.y = n.depth * H + 30; });
  let depth = 0;
  (function maxDepth(n, d) {
    if (!n) return;
    depth = Math.max(depth, d);
    maxDepth(n.left, d + 1);
    maxDepth(n.right, d + 1);
  })(root, 0);
  return { w: (order.length + 1) * W, h: (depth + 1) * H + 40 };
}

/* colors: nodeId -> 颜色 */
function treeSpecs(root, colors) {
  const box = treeLayout(root);
  const specs = [];
  (function walkEdges(n) {
    if (!n) return;
    if (n.left) specs.push(line("e-" + n.id + "-l", n.x, n.y, n.left.x, n.left.y, { stroke: "#2e3a52", "stroke-width": 2 }));
    if (n.right) specs.push(line("e-" + n.id + "-r", n.x, n.y, n.right.x, n.right.y, { stroke: "#2e3a52", "stroke-width": 2 }));
    walkEdges(n.left);
    walkEdges(n.right);
  })(root);
  (function walkNodes(n) {
    if (!n) return;
    const hl = !!colors[n.id];
    const c = colors[n.id] || "#232c40";
    specs.push(circ("n-" + n.id, n.x, n.y, 22, {
      fill: c, stroke: hl ? "#ffffff" : "#4da3ff", "stroke-width": hl ? 3 : 1.5,
    }));
    specs.push(text("t-" + n.id, n.x, n.y + 5, n.data, {
      "text-anchor": "middle", "font-size": 14, fill: "#ffffff",
    }));
    walkNodes(n.left);
    walkNodes(n.right);
  })(root);
  return { specs: specs, w: box.w, h: box.h };
}

/* 遍历顺序序列（盒子流），y 为在 svg 中的起始行 */
function orderStripSpecs(items, y) {
  const specs = [];
  (items || []).forEach((v, i) => {
    const x = 12 + i * 46;
    specs.push(rect("os-" + i, x, y + 8, 40, 28, { rx: 6, fill: "#232c40", stroke: "#4da3ff", "stroke-width": 1.5 }));
    specs.push(text("osv-" + i, x + 20, y + 27, v, { "text-anchor": "middle", "font-size": 14, fill: "#dbe4f4" }));
  });
  return specs;
}

/* 队列/栈内容盒子 */
function seqBoxSpecs(items, y, prefix, emptyText) {
  const specs = [];
  if (items && items.length) {
    items.forEach((v, i) => {
      const x = 12 + i * 52;
      specs.push(rect(prefix + "-b" + i, x, y + 8, 46, 30, { rx: 6, fill: "#1a2130", stroke: "#4da3ff", "stroke-width": 1.5 }));
      specs.push(text(prefix + "-v" + i, x + 23, y + 29, v, { "text-anchor": "middle", "font-size": 14, fill: "#dbe4f4" }));
    });
  } else {
    specs.push(text(prefix + "-e", 12, y + 28, emptyText || "空", { "font-size": 13, fill: "#5c6a85" }));
  }
  return specs;
}

/* 自定义代码（csim）的树快照 → 树形图渲染。
   snap: { nodes:{id→{data,left,right}}, rootId, cur, markNode, markField, cmpIds } */
function renderTreeCsim(stage, snap) {
  const out = document.getElementById("status");
  if (out) out.innerHTML = "";
  if (!snap || !snap.nodes || !snap.rootId || !snap.nodes[snap.rootId]) {
    renderSVG(stage, "0 0 300 120",
      [text("empty", 150, 60, "（空树 root = NULL）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }
  /* 构建 treeSpecs 期望的对象树：BFS 填 depth + left/right 引用 */
  const byId = {};
  for (const k in snap.nodes) {
    byId[k] = { id: Number(k), data: snap.nodes[k].data, left: null, right: null, depth: 0 };
  }
  const root = byId[snap.rootId];
  const q = [root];
  const seen = {};
  seen[root.id] = 1;
  while (q.length) {
    const n = q.shift();
    const nn = snap.nodes[n.id];
    if (nn.left !== null && nn.left !== undefined && byId[nn.left]) {
      n.left = byId[nn.left];
      n.left.depth = n.depth + 1;
      if (!seen[n.left.id]) { seen[n.left.id] = 1; q.push(n.left); }
    }
    if (nn.right !== null && nn.right !== undefined && byId[nn.right]) {
      n.right = byId[nn.right];
      n.right.depth = n.depth + 1;
      if (!seen[n.right.id]) { seen[n.right.id] = 1; q.push(n.right); }
    }
  }
  /* 着色：mark 红 > cur 黄 > cmp 紫 */
  const colors = {};
  if (snap.markNode !== null && snap.markNode !== undefined) colors[snap.markNode] = "#ff6b6b";
  if (snap.cur !== null && snap.cur !== undefined && !colors[snap.cur]) colors[snap.cur] = "#ffd166";
  if (snap.cmpIds) {
    for (const cid of snap.cmpIds) {
      if (cid !== null && cid !== undefined && !colors[cid]) colors[cid] = "#b98cff";
    }
  }
  const r = treeSpecs(root, colors);
  renderSVG(stage, "0 0 " + r.w + " " + r.h, r.specs);
}
