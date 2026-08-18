/* 并查集渲染器：parent 数组（顶部）+ 森林树形图（下方）+ 路径压缩高亮。
   输入为 csim 数组模式快照：step.arr（parent 数组）+ step.vars + step.uf */

const UF_CELL_W = 48;
const UF_CELL_H = 32;
const UF_GAP = 4;
const UF_NODE_R = 22;

function renderUnionFind(stage, step) {
  var vars = (step && step.vars) ? step.vars : {};
  var parent = (step && step.arr) ? step.arr : [];
  var n = parent.length;
  if (!n) {
    renderSVG(stage, "0 0 300 120",
      [text("ufempty", 150, 60, "（暂无数据）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }

  var uf = (step && step.uf) ? step.uf : null;
  var compressed = (uf && uf.compressed) ? uf.compressed : [];
  var curX = vars.x !== undefined ? vars.x : -1;

  /* 1. 构建森林 */
  var children = [];
  var roots = [];
  for (var i = 0; i < n; i++) children.push([]);
  for (var i = 0; i < n; i++) {
    if (parent[i] === i) {
      roots.push(i);
    } else if (parent[i] >= 0 && parent[i] < n) {
      children[parent[i]].push(i);
    }
  }

  /* 2. 子树宽度 */
  var subtreeW = [];
  for (var i = 0; i < n; i++) subtreeW.push(0);
  function calcWidth(u) {
    if (children[u].length === 0) { subtreeW[u] = 1; return 1; }
    var w = 0;
    for (var ci = 0; ci < children[u].length; ci++) w += calcWidth(children[u][ci]);
    subtreeW[u] = Math.max(w, 1);
    return subtreeW[u];
  }
  for (var ri = 0; ri < roots.length; ri++) calcWidth(roots[ri]);

  /* 3. 布局 */
  var TREE_GAP = 30;
  var H_SPACING = 56;
  var V_SPACING = 64;
  var ARR_AREA_H = UF_CELL_H + 36;
  var TREE_TOP = ARR_AREA_H + 30;
  var pos = [];
  for (var i = 0; i < n; i++) pos.push([0, 0]);
  var posValid = false;

  if (roots.length > 0) {
    /* 有根节点：树形布局 */
    var startX = 0;
    for (var ri = 0; ri < roots.length; ri++) {
      var treeW = subtreeW[roots[ri]] * H_SPACING;
      var treeRootX = startX + treeW / 2;
      (function lay(u, cx, cy) {
        pos[u] = [cx, cy];
        posValid = true;
        var cc = children[u].length;
        if (cc === 0) return;
        var tcw = 0;
        for (var ci = 0; ci < cc; ci++) tcw += subtreeW[children[u][ci]] * H_SPACING;
        var csx = cx - tcw / 2;
        for (var ci = 0; ci < cc; ci++) {
          var cw = subtreeW[children[u][ci]] * H_SPACING;
          lay(children[u][ci], csx + cw / 2, cy + V_SPACING);
          csx += cw;
        }
      })(roots[ri], treeRootX, TREE_TOP);
      startX += treeW + TREE_GAP;
    }
  }

  /* 无根节点：所有节点平铺在数组下方一行 */
  if (!posValid) {
    var flatY = ARR_AREA_H + UF_NODE_R + 10;
    var flatSpacing = H_SPACING;
    var flatTotal = n * flatSpacing;
    for (var i = 0; i < n; i++) {
      pos[i] = [-flatTotal / 2 + i * flatSpacing + flatSpacing / 2, flatY];
    }
  }

  /* 4. viewBox */
  var minX = 1e9, maxX = -1e9, maxY = -1e9;
  for (var i = 0; i < n; i++) {
    minX = Math.min(minX, pos[i][0] - UF_NODE_R);
    maxX = Math.max(maxX, pos[i][0] + UF_NODE_R);
    maxY = Math.max(maxY, pos[i][1] + UF_NODE_R);
  }
  var pad = 20;
  var arrW = n * (UF_CELL_W + UF_GAP);
  var totalW = Math.max(maxX - minX + 2 * pad, arrW + 40);
  var totalH = maxY + pad + 10;
  var offsetX = (totalW - (maxX - minX)) / 2 - minX;
  var specs = [];

  /* 5. parent 数组 */
  var arrStartX = (totalW - arrW) / 2;
  specs.push(text("uf-label", arrStartX, 14, "parent[]",
    { "font-size": 12, fill: "#8b96a8", "font-weight": "bold" }));
  for (var i = 0; i < n; i++) {
    var x = arrStartX + i * (UF_CELL_W + UF_GAP);
    var y = 22;
    var isRoot = parent[i] === i;
    var isComp = compressed.indexOf(i) >= 0;
    var isCur = curX === i;
    var fill = isCur ? "#ffd166" : (isComp ? "#ff6b6b" : (isRoot ? "#3ecf8e" : "#232c40"));
    var stroke = isCur ? "#ffd166" : (isComp ? "#ff6b6b" : (isRoot ? "#3ecf8e" : "#4da3ff"));
    specs.push(rect("uf-a" + i, x, y, UF_CELL_W, UF_CELL_H, {
      rx: 5, fill: fill, stroke: stroke, "stroke-width": isCur || isComp ? 2.5 : 1.5
    }));
    specs.push(text("uf-av" + i, x + UF_CELL_W / 2, y + UF_CELL_H / 2 + 5,
      String(parent[i]),
      { "text-anchor": "middle", "font-size": 14, "font-weight": "bold", fill: isCur ? "#1c2433" : "#e8eef7" }));
    specs.push(text("uf-ai" + i, x + UF_CELL_W / 2, y + UF_CELL_H + 14,
      String(i),
      { "text-anchor": "middle", "font-size": 11, fill: "#8b96a8" }));
  }

  /* 6. 边 */
  for (var i = 0; i < n; i++) {
    var p = parent[i];
    if (p === i || p < 0 || p >= n) continue;
    var x1 = pos[i][0] + offsetX, y1 = pos[i][1];
    var x2 = pos[p][0] + offsetX, y2 = pos[p][1];
    var dx = x2 - x1, dy = y2 - y1;
    var d = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / d, uy = dy / d;
    var sx = x1 + ux * UF_NODE_R, sy = y1 + uy * UF_NODE_R;
    var tipX = x2 - ux * (UF_NODE_R + 7), tipY = y2 - uy * (UF_NODE_R + 7);
    var isEC = compressed.indexOf(i) >= 0;
    var ec = isEC ? "#ff6b6b" : "#4da3ff";
    specs.push(line("uf-e" + i, sx, sy, tipX, tipY, { stroke: ec, "stroke-width": isEC ? 2.5 : 1.8 }));
    specs.push(path("uf-ea" + i,
      "M" + tipX + "," + tipY +
      " L" + (tipX - ux * 8 + -uy * 4) + "," + (tipY - uy * 8 + ux * 4) +
      " L" + (tipX - ux * 8 + uy * 4) + "," + (tipY - uy * 8 - ux * 4) + " Z",
      { fill: ec }));
  }

  /* 7. 节点 */
  for (var i = 0; i < n; i++) {
    var x = pos[i][0] + offsetX, y = pos[i][1];
    var isRoot = parent[i] === i;
    var isCur = curX === i;
    var isComp = compressed.indexOf(i) >= 0;
    var fc, sc;
    if (isCur) { fc = "#ffd166"; sc = "#ffd166"; }
    else if (isComp) { fc = "#ff6b6b"; sc = "#ff6b6b"; }
    else if (isRoot) { fc = "#3ecf8e"; sc = "#3ecf8e"; }
    else { fc = "#232c40"; sc = "#4da3ff"; }
    specs.push(circ("uf-n" + i, x, y, UF_NODE_R,
      { fill: fc, stroke: sc, "stroke-width": isCur || isComp ? 2.5 : 1.5 }));
    specs.push(text("uf-nt" + i, x, y + 5, String(i),
      { "text-anchor": "middle", "font-size": 16, "font-weight": "bold",
        fill: isCur || isComp ? "#1c2433" : (isRoot ? "#1c2433" : "#e8eef7") }));
  }

  renderSVG(stage, "0 0 " + totalW + " " + totalH, specs);
}
