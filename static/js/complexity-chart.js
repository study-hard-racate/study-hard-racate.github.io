/* 算法复杂度对比图表（首页）：
   - 柱状图：按类别展示各算法平均时间复杂度（柱高 = 复杂度等级，越大越慢）
   - 雷达图：排序算法四维对比（平均速度 / 最坏速度 / 空间 / 稳定性，越靠外越好）
   - 总览表：全部模块时间/空间复杂度 + 稳定性 + 跳转链接
   纯原生 JS + 内联 SVG，无依赖；深色/浅色主题跟随 CSS 变量。 */

(function () {
  "use strict";

  /* 复杂度数据：score 用于柱状图高度（1=O(1) … 7=O(2ⁿ)），
     radar 轴的 score 为 1..5（1=最优），图表会取反显示（越靠外越好） */
  var DATA = {
    sorting: [
      { name: "冒泡排序", url: "/sorting/bubble", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: "稳定", avgScore: 5, rAvg: 5, rWorst: 5, rSpace: 1, rStable: 1 },
      { name: "选择排序", url: "/sorting/selection", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: "不稳定", avgScore: 5, rAvg: 5, rWorst: 5, rSpace: 1, rStable: 5 },
      { name: "插入排序", url: "/sorting/insertion", avg: "O(n²)", worst: "O(n²)", space: "O(1)", stable: "稳定", avgScore: 5, rAvg: 5, rWorst: 5, rSpace: 1, rStable: 1 },
      { name: "快速排序", url: "/sorting/quick", avg: "O(n·log n)", worst: "O(n²)", space: "O(log n)", stable: "不稳定", avgScore: 4, rAvg: 4, rWorst: 5, rSpace: 2, rStable: 5 },
      { name: "归并排序", url: "/sorting/merge", avg: "O(n·log n)", worst: "O(n·log n)", space: "O(n)", stable: "稳定", avgScore: 4, rAvg: 4, rWorst: 4, rSpace: 3, rStable: 1 },
      { name: "希尔排序", url: "/sorting/shell", avg: "O(n^1.3)", worst: "O(n²)", space: "O(1)", stable: "不稳定", avgScore: 5, rAvg: 5, rWorst: 5, rSpace: 1, rStable: 5 },
      { name: "堆排序", url: "/sorting/heap", avg: "O(n·log n)", worst: "O(n·log n)", space: "O(1)", stable: "不稳定", avgScore: 4, rAvg: 4, rWorst: 4, rSpace: 1, rStable: 5 },
      { name: "计数排序", url: "/sorting/counting", avg: "O(n+k)", worst: "O(n+k)", space: "O(n+k)", stable: "稳定", avgScore: 3, rAvg: 3, rWorst: 3, rSpace: 3, rStable: 1 },
      { name: "基数排序", url: "/sorting/radix", avg: "O(d·(n+k))", worst: "O(d·(n+k))", space: "O(n+k)", stable: "稳定", avgScore: 3, rAvg: 3, rWorst: 3, rSpace: 3, rStable: 1 },
    ],
    search: [
      { name: "线性查找", url: "/search/linear", avg: "O(n)", worst: "O(n)", space: "O(1)", stable: "—", avgScore: 3 },
      { name: "二分查找", url: "/search/binary", avg: "O(log n)", worst: "O(log n)", space: "O(1)", stable: "需有序", avgScore: 2 },
      { name: "哈希查找", url: "/search/hash", avg: "O(1)", worst: "O(n)", space: "O(n)", stable: "—", avgScore: 1 },
      { name: "分块查找", url: "/search/block", avg: "O(√n)", worst: "O(n)", space: "O(1)", stable: "—", avgScore: 3 },
    ],
    ds: [
      { name: "数组", url: "/array", avg: "访问 O(1)", worst: "插入/删除 O(n)", space: "O(n)", stable: "—", avgScore: 3 },
      { name: "链表", url: "/linked-list", avg: "访问 O(n)", worst: "头插删 O(1)", space: "O(n)", stable: "—", avgScore: 3 },
      { name: "双向链表", url: "/doubly-linked-list", avg: "访问 O(n)", worst: "已知节点删除 O(1)", space: "O(n)", stable: "—", avgScore: 3 },
      { name: "栈", url: "/stack", avg: "压/弹 O(1)", worst: "压/弹 O(1)", space: "O(n)", stable: "—", avgScore: 1 },
      { name: "队列", url: "/queue", avg: "入/出 O(1)", worst: "入/出 O(1)", space: "O(n)", stable: "—", avgScore: 1 },
      { name: "循环队列", url: "/circular-queue", avg: "入/出 O(1)", worst: "入/出 O(1)", space: "O(n)", stable: "—", avgScore: 1 },
      { name: "Trie 字典树", url: "/trie", avg: "查找 O(L)", worst: "查找 O(L)", space: "O(节点×字母表)", stable: "—", avgScore: 3 },
      { name: "并查集", url: "/tree/union-find", avg: "≈O(1)", worst: "≈O(1)", space: "O(n)", stable: "—", avgScore: 1 },
    ],
    graph: [
      { name: "二叉树", url: "/tree/binary-tree", avg: "访问 O(h)", worst: "O(n)", space: "O(n)", stable: "—", avgScore: 4 },
      { name: "二叉搜索树", url: "/tree/bst", avg: "访问 O(h)", worst: "O(n)", space: "O(n)", stable: "—", avgScore: 4 },
      { name: "树的遍历", url: "/tree/traversal", avg: "O(n)", worst: "O(n)", space: "O(n)", stable: "—", avgScore: 3 },
      { name: "堆 / 优先队列", url: "/tree/heap", avg: "插入/删除 O(log n)", worst: "O(log n)", space: "O(n)", stable: "—", avgScore: 2 },
      { name: "红黑树", url: "/tree/rbtree", avg: "访问 O(log n)", worst: "O(log n)", space: "O(n)", stable: "—", avgScore: 2 },
      { name: "图的 BFS / DFS", url: "/graph/bfs-dfs", avg: "O(n+e)", worst: "O(n+e)", space: "O(n)", stable: "—", avgScore: 4 },
      { name: "拓扑排序", url: "/graph/topological", avg: "O(n+e)", worst: "O(n+e)", space: "O(n)", stable: "—", avgScore: 4 },
      { name: "Dijkstra", url: "/graph/dijkstra", avg: "O(n²)", worst: "O(n²)", space: "O(n²)", stable: "—", avgScore: 5 },
      { name: "Prim", url: "/graph/prim", avg: "O(n²)", worst: "O(n²)", space: "O(n²)", stable: "—", avgScore: 5 },
      { name: "Kruskal", url: "/graph/kruskal", avg: "O(e·log e)", worst: "O(e·log e)", space: "O(e+n)", stable: "—", avgScore: 4 },
      { name: "Floyd-Warshall", url: "/graph/floyd", avg: "O(n³)", worst: "O(n³)", space: "O(n²)", stable: "—", avgScore: 6 },
    ],
    dp: [
      { name: "0-1 背包", url: "/dp/01-knapsack", avg: "O(n·W)", worst: "O(n·W)", space: "O(W)", stable: "—", avgScore: 5 },
      { name: "完全背包", url: "/dp/complete-knapsack", avg: "O(n·W)", worst: "O(n·W)", space: "O(W)", stable: "—", avgScore: 5 },
      { name: "LCS", url: "/dp/lcs", avg: "O(m·n)", worst: "O(m·n)", space: "O(m·n)", stable: "—", avgScore: 5 },
      { name: "编辑距离", url: "/dp/edit-distance", avg: "O(m·n)", worst: "O(m·n)", space: "O(m·n)", stable: "—", avgScore: 5 },
      { name: "爬楼梯", url: "/dp/stairs", avg: "O(n)", worst: "O(n)", space: "O(n)", stable: "—", avgScore: 3 },
      { name: "LIS", url: "/dp/lis", avg: "O(n²)", worst: "O(n²)", space: "O(n)", stable: "—", avgScore: 5 },
    ],
    classic: [
      { name: "汉诺塔", url: "/classic/hanoi", avg: "O(2ⁿ)", worst: "O(2ⁿ)", space: "O(n)", stable: "—", avgScore: 7 },
      { name: "KMP", url: "/classic/kmp", avg: "O(n+m)", worst: "O(n+m)", space: "O(m)", stable: "—", avgScore: 4 },
    ],
  };

  var CATS = [
    { key: "sorting", label: "排序算法" },
    { key: "search", label: "查找算法" },
    { key: "ds", label: "数据结构" },
    { key: "graph", label: "树与图" },
    { key: "dp", label: "动态规划" },
    { key: "classic", label: "经典算法" },
  ];

  var CAT_COLORS = {
    sorting: "#4da3ff",
    search: "#3ecf8e",
    ds: "#ffd166",
    graph: "#b98cff",
    dp: "#f472b6",
    classic: "#2dd4bf",
  };

  function catOf(url) {
    for (var i = 0; i < CATS.length; i++) {
      for (var j = 0; j < DATA[CATS[i].key].length; j++) {
        if (DATA[CATS[i].key][j].url === url) return CATS[i].key;
      }
    }
    return "sorting";
  }

  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* ============ 柱状图：平均时间复杂度 ============ */
  function buildBarChart(root, activeCat) {
    root.innerHTML = "";
    root.appendChild(h("p", "cx-note", "柱高 = 平均时间复杂度等级（越高越慢）：O(1)=1 · O(log n)=2 · O(n)=3 · O(n·log n)=4 · O(n²)=5 · O(n³)=6 · O(2ⁿ)=7"));
    var chips = h("div", "cx-chips");
    var allBtn = h("button", "cx-chip" + (activeCat === null ? " active" : ""), "全部");
    allBtn.addEventListener("click", function () { buildBarChart(root, null); });
    chips.appendChild(allBtn);
    CATS.forEach(function (c) {
      var b = h("button", "cx-chip" + (activeCat === c.key ? " active" : ""), c.label);
      b.addEventListener("click", function () { buildBarChart(root, c.key); });
      chips.appendChild(b);
    });
    root.appendChild(chips);

    var wrap = h("div", "cx-bars");
    var list = activeCat ? DATA[activeCat] : [];
    if (!activeCat) {
      CATS.forEach(function (c) { list = list.concat(DATA[c.key]); });
    }
    var maxScore = 7;
    list.forEach(function (item) {
      var barCol = document.createElement("div");
      barCol.className = "cx-bar-col";
      var hgt = 8 + (item.avgScore / maxScore) * 170;
      var bar = h("div", "cx-bar", "");
      bar.style.height = hgt + "px";
      bar.style.background = CAT_COLORS[catOf(item.url)];
      var value = h("div", "cx-bar-val", item.avg);
      var name = h("a", "cx-bar-name", item.name);
      name.href = item.url;
      barCol.appendChild(value);
      barCol.appendChild(bar);
      barCol.appendChild(name);
      wrap.appendChild(barCol);
    });
    root.appendChild(wrap);
  }

  /* ============ 雷达图：排序算法四维对比 ============ */
  function buildRadar(root) {
    root.innerHTML = "";
    root.appendChild(h("p", "cx-note",
      "排序算法四维对比：平均速度 / 最坏速度 / 空间 / 稳定性 —— 多边形越靠外越好（速度越快、越省空间、越稳定）"));
    var select = h("select", "cx-select");
    var optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "— 全部（灰色轮廓）—";
    select.appendChild(optAll);
    DATA.sorting.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.url;
      o.textContent = s.name;
      select.appendChild(o);
    });
    root.appendChild(select);

    var svgWrap = h("div", "cx-radar-wrap");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 460 380");
    svg.setAttribute("class", "cx-radar");
    svgWrap.appendChild(svg);
    root.appendChild(svgWrap);

    var info = h("div", "cx-radar-info", "选择一个算法查看综合画像");
    root.appendChild(info);

    var cx = 230, cy = 195, maxR = 140, minR = 28;
    var AXES = [
      { label: "平均速度", key: "rAvg" },
      { label: "最坏速度", key: "rWorst" },
      { label: "空间省", key: "rSpace" },
      { label: "稳定性", key: "rStable" },
    ];
    /* 轴角度：上、右、下、左 */
    var ANGLES = [-90, 0, 90, 180].map(function (a) { return (a * Math.PI) / 180; });

    function pt(score, i, rScale) {
      var v = (6 - score) / 5; /* 1..5 → 0.2..1（越大越好） */
      var r = minR + v * (maxR - minR) * (rScale || 1);
      return [cx + r * Math.cos(ANGLES[i]), cy + r * Math.sin(ANGLES[i])];
    }

    function drawAll() {
      /* 网格（4 层） */
      for (var g = 1; g <= 4; g++) {
        var pts = [];
        for (var i = 0; i < 4; i++) {
          var p = pt(6 - g * 1.25 + 1.25, i, 1);
          /* 网格半径按 score 1..5 均分：score 值 = 1 + g */
          var r = minR + (g / 4) * (maxR - minR);
          p = [cx + r * Math.cos(ANGLES[i]), cy + r * Math.sin(ANGLES[i])];
          pts.push(p[0].toFixed(1) + "," + p[1].toFixed(1));
        }
        var poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute("points", pts.join(" "));
        poly.setAttribute("class", "cx-grid");
        svg.appendChild(poly);
      }
      /* 轴 */
      for (var a = 0; a < 4; a++) {
        var x2 = cx + maxR * Math.cos(ANGLES[a]);
        var y2 = cy + maxR * Math.sin(ANGLES[a]);
        var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", cx); line.setAttribute("y1", cy);
        line.setAttribute("x2", x2); line.setAttribute("y2", y2);
        line.setAttribute("class", "cx-axis");
        svg.appendChild(line);
        var tx = cx + (maxR + 26) * Math.cos(ANGLES[a]);
        var ty = cy + (maxR + 26) * Math.sin(ANGLES[a]);
        var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", tx); label.setAttribute("y", ty + 4);
        label.setAttribute("class", "cx-axis-label");
        label.setAttribute("text-anchor", "middle");
        label.textContent = AXES[a].label;
        svg.appendChild(label);
      }
      /* 中心点 */
      var center = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      center.setAttribute("cx", cx); center.setAttribute("cy", cy); center.setAttribute("r", 2.5);
      center.setAttribute("class", "cx-center");
      svg.appendChild(center);
      /* 全部算法（淡色轮廓） */
      DATA.sorting.forEach(function (s) {
        var pts = [];
        for (var i = 0; i < 4; i++) {
          var p = pt(s[AXES[i].key], i, 1);
          pts.push(p[0].toFixed(1) + "," + p[1].toFixed(1));
        }
        var poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute("points", pts.join(" "));
        poly.setAttribute("class", "cx-faint");
        poly.setAttribute("data-url", s.url);
        poly.addEventListener("click", function () { select.value = this.getAttribute("data-url"); highlight(this.getAttribute("data-url")); });
        svg.appendChild(poly);
      });
    }

    function highlight(url) {
      var nodes = svg.querySelectorAll(".cx-faint, .cx-algo");
      for (var i = 0; i < nodes.length; i++) svg.removeChild(nodes[i]);
      /* 重画淡色轮廓 */
      DATA.sorting.forEach(function (s) {
        var pts = [];
        for (var k = 0; k < 4; k++) {
          var p = pt(s[AXES[k].key], k, 1);
          pts.push(p[0].toFixed(1) + "," + p[1].toFixed(1));
        }
        var poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute("points", pts.join(" "));
        poly.setAttribute("class", url === s.url ? "cx-algo" : "cx-faint");
        poly.setAttribute("data-url", s.url);
        poly.addEventListener("click", function () { select.value = this.getAttribute("data-url"); highlight(this.getAttribute("data-url")); });
        svg.appendChild(poly);
      });
      if (url) {
        var hit = null;
        DATA.sorting.forEach(function (s) { if (s.url === url) hit = s; });
        if (hit) {
          info.innerHTML = "";
          info.appendChild(h("b", "", hit.name + "："));
          info.appendChild(document.createTextNode(
            "平均 " + hit.avg + " · 最坏 " + hit.worst + " · 空间 " + hit.space + " · " + hit.stable +
            "　"));
          var link = h("a", "cx-link", "查看动画 →");
          link.href = hit.url;
          info.appendChild(link);
        }
      } else {
        info.textContent = "选择一个算法查看综合画像（灰色轮廓为全部算法，可点击）";
      }
    }

    drawAll();
    select.addEventListener("change", function () { highlight(select.value); });
  }

  /* ============ 总览表 ============ */
  function buildTable(root, activeCat) {
    root.innerHTML = "";
    var chips = h("div", "cx-chips");
    var allBtn = h("button", "cx-chip" + (activeCat === null ? " active" : ""), "全部");
    allBtn.addEventListener("click", function () { buildTable(root, null); });
    chips.appendChild(allBtn);
    CATS.forEach(function (c) {
      var b = h("button", "cx-chip" + (activeCat === c.key ? " active" : ""), c.label);
      b.addEventListener("click", function () { buildTable(root, c.key); });
      chips.appendChild(b);
    });
    root.appendChild(chips);

    var table = h("table", "cx-table");
    var thead = h("thead", "", "<tr><th>算法 / 结构</th><th>平均 / 典型</th><th>最坏</th><th>空间</th><th>稳定性</th></tr>");
    table.appendChild(thead);
    var tbody = h("tbody", "");
    CATS.forEach(function (c) {
      if (activeCat && activeCat !== c.key) return;
      var items = DATA[c.key];
      if (!activeCat) {
        var groupRow = h("tr", "cx-group");
        groupRow.innerHTML = "<td colspan='5'>" + c.label + "</td>";
        tbody.appendChild(groupRow);
      }
      items.forEach(function (item) {
        var tr = h("tr", "");
        tr.appendChild(h("td", "", '<a href="' + item.url + '">' + item.name + "</a>"));
        tr.appendChild(h("td", "", item.avg));
        tr.appendChild(h("td", "", item.worst));
        tr.appendChild(h("td", "", item.space));
        tr.appendChild(h("td", "", item.stable));
        tbody.appendChild(tr);
      });
    });
    table.appendChild(tbody);
    root.appendChild(table);
  }

  /* ============ 入口 ============ */
  function init() {
    var root = document.getElementById("complexity-chart");
    if (!root) return;

    var tabs = h("div", "cx-tabs");
    var tabBar = null, tabRadar = null, tabTable = null;
    function show(fn) {
      root.innerHTML = "";
      var t = h("div", "cx-tabs");
      var mk = function (label, active, click) {
        var b = h("button", "cx-tab" + (active ? " active" : ""), label);
        b.addEventListener("click", click);
        return b;
      };
      t.appendChild(mk("柱状图对比", fn === buildBarChart, function () { show(buildBarChart); }));
      t.appendChild(mk("排序雷达图", fn === buildRadar, function () { show(buildRadar); }));
      t.appendChild(mk("复杂度总表", fn === buildTable, function () { show(buildTable); }));
      root.appendChild(t);
      var body = h("div", "cx-body");
      root.appendChild(body);
      fn(body, null);
    }
    show(buildBarChart);
  }

  window.__complexity = { DATA: DATA, CATS: CATS, buildBarChart: buildBarChart, buildRadar: buildRadar, buildTable: buildTable };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
