/* 链表渲染器：把 csim.js 的链表快照（ids/data/ptrs/cur）渲染为水平链表 SVG。
   依赖 svg.js 的持久化渲染引擎（renderSVG）。
   键前缀：ln- 节点框 / lt- 节点数据 / le- 边线与箭头 / lpt- 指针标签 /
           lp- 指针连线 / lnull 末尾 NULL 框 / lempty 空链表提示
   指针标签布局：同一节点的多个指针按标签宽度自动换行；所有标签行做
   全局槽分配（宽行优先、x 区间不相交才同层），保证标签与连线互不重叠。 */

const L_NODE_W = 64;
const L_NODE_H = 40;
const L_GAP = 36;
const L_TOP = 58;
const L_LEFT = 24;
const L_ARROW = 12;
const L_H = 200;
const L_ROW_DY = L_NODE_H + 48; /* 次链行偏移（双链表并存时 l2 显示在主链下方） */

/* 颜色：常规节点深底蓝框；当前访问（cur）黄框；指针标签青色 */
const L_NODE_FILL = "#232c40";
const L_NODE_STROKE = "#4da3ff";
const L_CUR_FILL = "#ffd166";
const L_CUR_TEXT = "#1c2433";
const L_TEXT = "#e8eef7";
const L_PTR = "#5eead4";
const L_NULL = "#8b96a8";
const L_DET = "#f5a623";

function listNodeX(i) {
  return L_LEFT + i * (L_NODE_W + L_GAP);
}

/* 文本近似像素宽（12px 字号：ASCII ~6.3px/字符，汉字 12px/字符） */
function labelW(txt) {
  var w = 0;
  for (var i = 0; i < txt.length; i++) w += txt.charCodeAt(i) > 255 ? 12 : 6.3;
  return w + 6;
}

/* 组内标签打包成行（按宽度自动换行，行内不重叠）。
   names: [{ name, label, ptr }]，返回 [{ items:[{name,label,ptr,x}], minX, maxX }] */
function layoutPtrRows(cx, maxW, names) {
  var rows = [], cur = [], curW = 0;
  for (var i = 0; i < names.length; i++) {
    var w = labelW(names[i].label);
    if (cur.length && curW + w > maxW) { rows.push(cur); cur = []; curW = 0; }
    names[i].w = w;
    cur.push(names[i]);
    curW += w + 10;
  }
  if (cur.length) rows.push(cur);
  return rows.map(function (row) {
    var rowW = 0;
    row.forEach(function (it) { rowW += it.w; });
    var x = cx - (rowW + 10 * (row.length - 1)) / 2;
    row.forEach(function (it) { it.x = x + it.w / 2; x += it.w + 10; });
    return {
      items: row,
      minX: row[0].x - row[0].w / 2,
      maxX: x - 10 + row[row.length - 1].w / 2,
    };
  });
}

/* 全部指针标签布局：组内换行 → 全局槽分配（宽行优先，x 区间冲突才换槽）。
   返回 { items:[{name,label,isNull,order,groupN,id,x,y}], layers,
          detInfo:{ id → 游离框 x }, detInTail: 链尾新节点数 } */
function layoutPtrItems(ids, ptrs, endX, nullCenterX, nodePos, sideIds) {
  const groups = {}, nullPts = [];
  ptrs.forEach(function (p) {
    if (p.id === null) nullPts.push(p);
    else (groups[p.id] || (groups[p.id] = [])).push(p);
  });
  const rows = [];
  const detInfo = {};
  let detInTail = 0;
  Object.keys(groups).forEach(function (id) {
    const g = groups[id];
    const idx = ids.indexOf(Number(id));
    let cx, boxX;
    if (idx >= 0) {
      cx = listNodeX(idx) + L_NODE_W / 2;
    } else if (sideIds && sideIds.indexOf(Number(id)) >= 0) {
      /* 次链节点：在主链下方的绿色行 */
      cx = listNodeX(sideIds.indexOf(Number(id))) + L_NODE_W / 2;
    } else if (nodePos && nodePos[id] !== undefined) {
      /* 曾位于链上的节点（反转时摘下）：画在原位，动画不跳变 */
      boxX = listNodeX(nodePos[id]);
      cx = boxX + L_NODE_W / 2;
    } else {
      /* 刚 malloc 的新节点：排到链尾右侧 */
      boxX = endX + L_NODE_W + 12 + detInTail * (L_NODE_W + 18);
      cx = boxX + L_NODE_W / 2;
      detInTail++;
    }
    if (boxX !== undefined) detInfo[id] = boxX;
    const names = g.map(function (q) {
      return { name: q.name, label: q.name, ptr: q };
    });
    layoutPtrRows(cx, L_NODE_W + 84, names).forEach(function (row) {
      row.id = Number(id);
      rows.push(row);
    });
  });
  if (nullPts.length) {
    const names = nullPts.map(function (q) {
      return { name: q.name, label: q.name + (q.struct ? " → 结构体" : " → NULL"), ptr: q };
    });
    layoutPtrRows(nullCenterX, 170, names).forEach(function (row) {
      row.isNull = true;
      rows.push(row);
    });
  }

  /* 全局槽分配：宽行优先占位，x 区间相交则换下一槽 */
  rows.sort(function (a, b) { return (b.maxX - b.minX) - (a.maxX - a.minX); });
  const slots = [];
  rows.forEach(function (row) {
    for (let r = 0; ; r++) {
      const occ = slots[r] || [];
      const clash = occ.some(function (o) { return row.minX < o.maxX && o.minX < row.maxX; });
      if (!clash) {
        row.y = L_TOP - 30 - r * 17;
        occ.push(row);
        slots[r] = occ;
        break;
      }
    }
  });

  /* 最左标签不得超出画布左缘（保持 8px 边距），逐行右移 */
  rows.forEach(function (row) {
    let sh = 0;
    if (row.minX < 8) sh = 8 - row.minX;
    if (sh) {
      row.items.forEach(function (it) { it.x += sh; });
      row.minX += sh;
      row.maxX += sh;
    }
  });

  /* 汇总 items（含每个指针的组内序号与组大小，用于连线落点） */
  const items = [];
  Object.keys(groups).forEach(function (id) {
    const g = groups[id];
    const n = g.length;
    rows.filter(function (row) { return row.id === Number(id); }).forEach(function (row) {
      row.items.forEach(function (it) {
        items.push({
          name: it.name, label: it.label, isNull: false, id: Number(id),
          order: g.indexOf(it.ptr), groupN: n, x: it.x, y: row.y,
        });
      });
    });
  });
  if (nullPts.length) {
    const n = nullPts.length;
    rows.filter(function (row) { return row.isNull; }).forEach(function (row) {
      row.items.forEach(function (it) {
        items.push({
          name: it.name, label: it.label, isNull: true, id: null,
          order: nullPts.indexOf(it.ptr), groupN: n, x: it.x, y: row.y,
        });
      });
    });
  }
  return { items: items, layers: slots.length, detInfo: detInfo, detInTail: detInTail };
}

/* 快照 → SVG specs */
function listSpecs(snap) {
  const ids = snap && snap.ids ? snap.ids : [];
  const data = (snap && snap.data) ? snap.data : {};
  const ptrs = (snap && snap.ptrs) ? snap.ptrs : [];
  const cur = snap ? snap.cur : null;
  const edges = (snap && snap.edges) ? snap.edges : null;
  const markNode = (snap && snap.markNode !== undefined && snap.markNode !== null) ? snap.markNode : null;
  const markField = (snap && snap.markField) ? snap.markField : null;
  const side = (snap && snap.side && snap.side.ids && snap.side.ids.length) ? snap.side : null;
  const cmpIds = (snap && snap.cmpIds && snap.cmpIds.length === 2) ? snap.cmpIds : null;
  const sideIds = side ? side.ids : [];
  const specs = [];

  if (!ids.length) {
    /* 空链表 */
    specs.push(rect("ln-0", L_LEFT, L_TOP, L_NODE_W, L_NODE_H, {
      fill: L_NODE_FILL, stroke: L_NULL, "stroke-dasharray": "5 4", rx: 6,
    }));
    specs.push(text("lempty", L_LEFT + L_NODE_W / 2, L_TOP + L_NODE_H / 2 + 5,
      "空链表", { fill: L_NULL, "text-anchor": "middle", "font-size": 15 }));
  } else {
    /* 节点 + 数据 */
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const x = listNodeX(i);
      const isCur = id === cur;
      const isMark = id === markNode;
      const isCmp = cmpIds && cmpIds.indexOf(id) >= 0;
      const fill = isCur ? L_CUR_FILL : (isMark ? "#3a2a3a" : L_NODE_FILL);
      const stroke = isMark ? "#ff6b6b" : (isCur ? L_CUR_FILL : (isCmp ? "#b98cff" : L_NODE_STROKE));
      const tc = isCur ? L_CUR_TEXT : (isMark ? "#ff9f9f" : (isCmp ? "#d9c4ff" : L_TEXT));
      specs.push(rect("ln-" + id, x, L_TOP, L_NODE_W, L_NODE_H, {
        fill: fill, stroke: stroke, "stroke-width": (isCur || isMark) ? 2.5 : 1.5, rx: 6,
      }));
      specs.push(text("lt-" + id, x + L_NODE_W / 2, L_TOP + L_NODE_H / 2 + 5,
        data[id] !== undefined ? String(data[id]) : "·",
        { fill: tc, "text-anchor": "middle", "font-size": 16, "font-weight": "bold" }));
    }

    /* 边线 + 箭头（无 edges 信息时的旧快照：相邻节点直线连接） */
    if (!(edges && Object.keys(edges).length)) {
      for (let i = 0; i < ids.length - 1; i++) {
        const x1 = listNodeX(i) + L_NODE_W;
        const y1 = L_TOP + L_NODE_H / 2;
        const x2 = listNodeX(i + 1) - 2;
        specs.push(line("le-" + i, x1, y1, x2 - L_ARROW, y1, { stroke: L_NODE_STROKE, "stroke-width": 2 }));
        specs.push(path("la-" + i, "M" + (x2 - L_ARROW) + "," + (y1 - 5) + " L" + x2 + "," + y1 +
          " L" + (x2 - L_ARROW) + "," + (y1 + 5) + " Z", { fill: L_NODE_STROKE }));
      }
    }

    /* 末尾 NULL 框 */
    const endX = listNodeX(ids.length) - L_GAP / 2 + 6;
    specs.push(rect("lnull", endX, L_TOP, L_NODE_W / 2, L_NODE_H, {
      fill: "none", stroke: L_NULL, "stroke-dasharray": "5 4", rx: 6,
    }));
    specs.push(text("lntext", endX + L_NODE_W / 4, L_TOP + L_NODE_H / 2 + 5,
      "NULL", { fill: L_NULL, "text-anchor": "middle", "font-size": 13 }));
  }

  const endX = listNodeX(ids.length) - L_GAP / 2 + 6;
  const nullCenterX = ids.length ? endX + L_NODE_W / 4 : L_LEFT + L_NODE_W / 2;
  const nodePos = (snap && snap.nodePos) ? snap.nodePos : {};
  const layout = layoutPtrItems(ids, ptrs, endX, nullCenterX, nodePos, sideIds);

  /* edges 驱动：按真实 next 指向渲染边（主链 + 次链 + 游离节点）。
     同行相邻 → 蓝色/绿色直线；指向 NULL → 对应行 NULL 框；
     跨行/指回 → 红色曲线从底部绕行，一目了然 */
  if (edges && Object.keys(edges).length) {
    const allIds = ids.slice();
    for (const sid of sideIds) if (allIds.indexOf(sid) < 0) allIds.push(sid);
    for (const did in layout.detInfo) {
      if (allIds.indexOf(Number(did)) < 0) allIds.push(Number(did));
    }
    const sideEndX = side ? listNodeX(sideIds.length) - L_GAP / 2 + 6 : nullCenterX;
    const rowOf = function (id) {
      const mi = ids.indexOf(id);
      if (mi >= 0) return { y: L_TOP, idx: mi, x: listNodeX(mi) };
      const si2 = sideIds.indexOf(id);
      if (si2 >= 0) return { y: L_TOP + L_ROW_DY, idx: si2, x: listNodeX(si2) };
      if (layout.detInfo[id] !== undefined) return { y: L_TOP, idx: -1, x: layout.detInfo[id] };
      return null;
    };
    for (let i = 0; i < allIds.length; i++) {
      const id = allIds[i];
      const to = edges[id] !== undefined ? edges[id] : null;
      const src = rowOf(id);
      if (!src) continue;
      const x1 = src.x + L_NODE_W;
      const y1 = src.y + L_NODE_H / 2;
      const lnColor = src.y === L_TOP ? L_NODE_STROKE : "#3ecf8e";
      if (to === null) {
        if (src.idx < 0) continue; /* 游离节点指向 NULL：无框可连 */
        const nx = src.y === L_TOP ? nullCenterX : sideEndX + L_NODE_W / 4;
        specs.push(line("le-" + id, x1, y1, nx - 14, y1, { stroke: lnColor, "stroke-width": 2 }));
        specs.push(path("la-" + id, "M" + (nx - 19) + "," + (y1 - 5) + " L" + (nx - 14) + "," + y1 +
          " L" + (nx - 19) + "," + (y1 + 5) + " Z", { fill: lnColor }));
        continue;
      }
      const dst = rowOf(to);
      if (!dst) continue;
      if (src.idx >= 0 && dst.idx >= 0 && src.y === dst.y && dst.idx === src.idx + 1) {
        /* 同行相邻 → 直线 */
        const x2 = dst.x - 2;
        specs.push(line("le-" + id, x1, y1, x2 - L_ARROW, y1, { stroke: lnColor, "stroke-width": 2 }));
        specs.push(path("la-" + id, "M" + (x2 - L_ARROW) + "," + (y1 - 5) + " L" + x2 + "," + y1 +
          " L" + (x2 - L_ARROW) + "," + (y1 + 5) + " Z", { fill: lnColor }));
      } else {
        /* 跨行/跳跃/指回：红色曲线 */
        const tx = dst.x + L_NODE_W / 2;
        const by = (src.y !== dst.y) ? L_TOP + L_NODE_H + 22 : L_TOP + L_NODE_H + 20;
        const srcCx = src.x + L_NODE_W / 2;
        specs.push(path("ler-" + id,
          "M" + srcCx + "," + (src.y + L_NODE_H) +
          " L" + srcCx + "," + by +
          " L" + tx + "," + by +
          " L" + tx + "," + (dst.y + L_NODE_H - 8),
          { stroke: "#ff6b6b", "stroke-width": 2, fill: "none" }));
        specs.push(path("lra-" + id,
          "M" + (tx - 5) + "," + (dst.y + L_NODE_H - 2) + " L" + tx + "," + (dst.y + L_NODE_H - 8) +
          " L" + (tx + 5) + "," + (dst.y + L_NODE_H - 2) + " Z",
          { fill: "#ff6b6b" }));
      }
    }
  }

  /* 次链（side）：主链下方第二行，绿色描边，与主链蓝色区分；
     节点被并入主链后自动变蓝（合并动画一目了然） */
  if (side) {
    const sideY = L_TOP + L_ROW_DY;
    if (side.label) {
      specs.push(text("lside-label", L_LEFT, sideY - 14, side.label + " 链",
        { fill: "#3ecf8e", "text-anchor": "start", "font-size": 12, "font-weight": "bold" }));
    }
    for (let i = 0; i < sideIds.length; i++) {
      const id = sideIds[i];
      const x = listNodeX(i);
      const isCur = id === cur;
      const isMark = id === markNode;
      const isCmp = cmpIds && cmpIds.indexOf(id) >= 0;
      const fill = isCur ? L_CUR_FILL : (isMark ? "#3a2a3a" : "#12261c");
      const stroke = isMark ? "#ff6b6b" : (isCur ? L_CUR_FILL : (isCmp ? "#b98cff" : "#3ecf8e"));
      const tc = isCur ? L_CUR_TEXT : (isMark ? "#ff9f9f" : (isCmp ? "#d9c4ff" : "#3ecf8e"));
      specs.push(rect("ln-" + id, x, sideY, L_NODE_W, L_NODE_H, {
        fill: fill, stroke: stroke, "stroke-width": (isCur || isMark || isCmp) ? 2.5 : 1.5, rx: 6,
      }));
      specs.push(text("lt-" + id, x + L_NODE_W / 2, sideY + L_NODE_H / 2 + 5,
        data[id] !== undefined ? String(data[id]) : "·",
        { fill: tc, "text-anchor": "middle", "font-size": 16, "font-weight": "bold" }));
    }
    /* 次链末尾 NULL 框 */
    const sideEndX = listNodeX(sideIds.length) - L_GAP / 2 + 6;
    specs.push(rect("lnull2", sideEndX, sideY, L_NODE_W / 2, L_NODE_H, {
      fill: "none", stroke: "#3ecf8e", "stroke-dasharray": "5 4", rx: 6,
    }));
    specs.push(text("lntext2", sideEndX + L_NODE_W / 4, sideY + L_NODE_H / 2 + 5,
      "NULL", { fill: "#3ecf8e", "text-anchor": "middle", "font-size": 13 }));
  }

  /* 游离节点（链外临时节点：反转时摘下/刚 malloc/非主链的其他结构如树节点）：虚线橙框，
     曾有链上位置的画回原位，新节点排链尾右侧；被访问（cur）时亮黄，被写入（mark）时亮红 */
  Object.keys(layout.detInfo).forEach(function (id) {
    const x = layout.detInfo[id];
    const isCur = Number(id) === cur;
    const isMark = Number(id) === markNode;
    const st = isMark ? "#ff6b6b" : (isCur ? L_CUR_FILL : L_DET);
    specs.push(rect("ln-" + id, x, L_TOP, L_NODE_W, L_NODE_H, {
      fill: isCur ? L_CUR_FILL : (isMark ? "#3a2a3a" : "rgba(245,166,35,0.08)"),
      stroke: st, "stroke-width": (isCur || isMark) ? 2.5 : 1.5,
      "stroke-dasharray": "6 4", rx: 6,
    }));
    specs.push(text("lt-" + id, x + L_NODE_W / 2, L_TOP + L_NODE_H / 2 + 5,
      String(data[id] !== undefined ? data[id] : "·"),
      { fill: isCur ? L_CUR_TEXT : (isMark ? "#ff9f9f" : L_DET), "text-anchor": "middle", "font-size": 16, "font-weight": "bold" }));
  });

  /* 指针标签与连线：每个标签带深色半透明背景块，文字清晰不压线 */
  layout.items.forEach(function (it) {
    const tw = labelW(it.label);
    const bgY = it.y - 11;
    specs.push(rect("lptbg-" + it.name, it.x - tw / 2 - 4, bgY, tw + 8, 17, {
      fill: "rgba(28,36,51,0.88)", stroke: "rgba(94,234,212,0.4)", "stroke-width": 1, rx: 4,
    }));
    if (it.isNull) {
      const tx = nullCenterX - 12 + 24 * (it.order + 1) / (it.groupN + 1);
      specs.push(line("lp-" + it.name, it.x, bgY + 17, tx, L_TOP - 5,
        { stroke: L_PTR, "stroke-width": 1.5 }));
      specs.push(text("lpt-" + it.name, it.x, it.y, it.label,
        { fill: L_PTR, "text-anchor": "middle", "font-size": 12 }));
      return;
    }
    const idx = ids.indexOf(it.id);
    const si3 = sideIds.indexOf(it.id);
    const cx = (idx >= 0 ? listNodeX(idx) :
      (si3 >= 0 ? listNodeX(si3) : layout.detInfo[it.id])) + L_NODE_W / 2;
    const tx = cx - 13 + 26 * (it.order + 1) / (it.groupN + 1);
    specs.push(line("lp-" + it.name, it.x, bgY + 17, tx, L_TOP - 4, { stroke: L_PTR, "stroke-width": 1.5 }));
    specs.push(path("lpa-" + it.name, "M" + (tx - 5) + "," + (L_TOP - 2) + " L" + tx + "," + (L_TOP - 9) +
      " L" + (tx + 5) + "," + (L_TOP - 2) + " Z", { fill: L_PTR }));
    specs.push(text("lpt-" + it.name, it.x, it.y, it.label,
      { fill: L_PTR, "text-anchor": "middle", "font-size": 12, "font-weight": "bold" }));
  });

  return specs;
}

function listViewBox(snap) {
  const ids = (snap && snap.ids) ? snap.ids : [];
  const n = ids.length;
  const ptrs = (snap && snap.ptrs) ? snap.ptrs : [];
  const side = (snap && snap.side && snap.side.ids && snap.side.ids.length) ? snap.side : null;
  const sideN = side ? side.ids.length : 0;
  const nodePos = (snap && snap.nodePos) ? snap.nodePos : {};
  const endX = listNodeX(n) - L_GAP / 2 + 6;
  const nullCenterX = n ? endX + L_NODE_W / 4 : L_LEFT + L_NODE_W / 2;
  const sideIds = side ? side.ids : [];
  const layout = layoutPtrItems(ids, ptrs, endX, nullCenterX, nodePos, sideIds);
  /* 宽度稳定：主链/次链按较长者，右侧恒定预留 1 个新节点位；
     链尾游离新节点超过 2 个时再扩展，其余情况（含反转摘节点）宽度不跳变 */
  const span = Math.max(n, sideN);
  const tailW = Math.max(0, layout.detInTail - 2) * (L_NODE_W + 18);
  const w = Math.max(380, L_LEFT * 2 + span * (L_NODE_W + L_GAP) + 70 + 82 * 2 + tailW);
  const pad = Math.max(0, (layout.layers - 1) * 17 - 24);
  return (pad ? "0 -" + pad + " " : "0 0 ") + w + " " + (L_H + pad);
}

/* 在 stage 中渲染链表快照 */
function renderList(stage, snap) {
  if (window.svglib) window.svglib(stage, listViewBox(snap), listSpecs(snap));
  else renderSVG(stage, listViewBox(snap), listSpecs(snap));
}
