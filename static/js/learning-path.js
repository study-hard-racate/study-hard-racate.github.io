/* 学习路径：前置依赖 DAG → 拓扑排序分层 → 按阶段推荐学习顺序，
   localStorage 记录已学/未学进度。
   页面容器：#learning-path（进度条 + 阶段列表），每模块一个"标记已学"按钮。 */

(function () {
  "use strict";

  /* 全部 40 个模块（与站点导航一致） */
  var CAT_ORDER = { sorting: 0, search: 1, ds: 2, graph: 3, dp: 4, classic: 5 };
  var CAT_LABEL = { sorting: "排序", search: "查找", ds: "数据结构", graph: "树与图", dp: "动态规划", classic: "经典" };

  var MODULES = [
    { url: "/array", name: "数组", cat: "ds" },
    { url: "/linked-list", name: "链表", cat: "ds" },
    { url: "/doubly-linked-list", name: "双向链表", cat: "ds" },
    { url: "/stack", name: "栈", cat: "ds" },
    { url: "/queue", name: "队列", cat: "ds" },
    { url: "/circular-queue", name: "循环队列", cat: "ds" },
    { url: "/trie", name: "Trie 字典树", cat: "ds" },
    { url: "/tree/union-find", name: "并查集", cat: "ds" },
    { url: "/tree/binary-tree", name: "二叉树", cat: "graph" },
    { url: "/tree/bst", name: "二叉搜索树", cat: "graph" },
    { url: "/tree/traversal", name: "树的遍历", cat: "graph" },
    { url: "/tree/heap", name: "堆 / 优先队列", cat: "graph" },
    { url: "/tree/rbtree", name: "红黑树", cat: "graph" },
    { url: "/graph/bfs-dfs", name: "图 BFS / DFS", cat: "graph" },
    { url: "/graph/topological", name: "拓扑排序", cat: "graph" },
    { url: "/graph/dijkstra", name: "Dijkstra 最短路", cat: "graph" },
    { url: "/graph/prim", name: "Prim 最小生成树", cat: "graph" },
    { url: "/graph/kruskal", name: "Kruskal 最小生成树", cat: "graph" },
    { url: "/graph/floyd", name: "Floyd-Warshall", cat: "graph" },
    { url: "/sorting/bubble", name: "冒泡排序", cat: "sorting" },
    { url: "/sorting/selection", name: "选择排序", cat: "sorting" },
    { url: "/sorting/insertion", name: "插入排序", cat: "sorting" },
    { url: "/sorting/shell", name: "希尔排序", cat: "sorting" },
    { url: "/sorting/quick", name: "快速排序", cat: "sorting" },
    { url: "/sorting/merge", name: "归并排序", cat: "sorting" },
    { url: "/sorting/heap", name: "堆排序", cat: "sorting" },
    { url: "/sorting/counting", name: "计数排序", cat: "sorting" },
    { url: "/sorting/radix", name: "基数排序", cat: "sorting" },
    { url: "/search/linear", name: "线性查找", cat: "search" },
    { url: "/search/binary", name: "二分查找", cat: "search" },
    { url: "/search/hash", name: "哈希查找", cat: "search" },
    { url: "/search/block", name: "分块查找", cat: "search" },
    { url: "/dp/stairs", name: "爬楼梯", cat: "dp" },
    { url: "/dp/lis", name: "LIS 最长递增子序列", cat: "dp" },
    { url: "/dp/01-knapsack", name: "0-1 背包", cat: "dp" },
    { url: "/dp/complete-knapsack", name: "完全背包", cat: "dp" },
    { url: "/dp/lcs", name: "LCS 最长公共子序列", cat: "dp" },
    { url: "/dp/edit-distance", name: "编辑距离", cat: "dp" },
    { url: "/classic/hanoi", name: "汉诺塔", cat: "classic" },
    { url: "/classic/kmp", name: "KMP 字符串匹配", cat: "classic" },
  ];

  /* 前置依赖（DAG）：学某模块前建议先学的模块 */
  var PREREQS = {
    "/array": [],
    "/linked-list": ["/array"],
    "/doubly-linked-list": ["/linked-list"],
    "/stack": ["/array"],
    "/queue": ["/array"],
    "/circular-queue": ["/queue"],
    "/trie": ["/linked-list"],
    "/tree/union-find": ["/linked-list"],
    "/tree/binary-tree": ["/linked-list"],
    "/tree/bst": ["/tree/binary-tree"],
    "/tree/traversal": ["/tree/binary-tree", "/stack", "/queue"],
    "/tree/heap": ["/tree/binary-tree"],
    "/tree/rbtree": ["/tree/bst", "/tree/heap"],
    "/graph/bfs-dfs": ["/stack", "/queue"],
    "/graph/topological": ["/graph/bfs-dfs"],
    "/graph/dijkstra": ["/graph/bfs-dfs"],
    "/graph/prim": ["/graph/bfs-dfs", "/graph/dijkstra"],
    "/graph/kruskal": ["/graph/bfs-dfs", "/tree/union-find", "/sorting/quick"],
    "/graph/floyd": ["/graph/dijkstra", "/dp/01-knapsack"],
    "/sorting/bubble": ["/array"],
    "/sorting/selection": ["/array"],
    "/sorting/insertion": ["/array"],
    "/sorting/shell": ["/sorting/insertion"],
    "/sorting/quick": ["/sorting/bubble", "/sorting/selection"],
    "/sorting/merge": ["/sorting/bubble", "/sorting/selection"],
    "/sorting/heap": ["/tree/heap"],
    "/sorting/counting": ["/array"],
    "/sorting/radix": ["/sorting/counting"],
    "/search/linear": ["/array"],
    "/search/binary": ["/sorting/quick"],
    "/search/hash": ["/linked-list"],
    "/search/block": ["/search/linear"],
    "/dp/stairs": ["/array"],
    "/dp/lis": ["/dp/stairs"],
    "/dp/01-knapsack": ["/dp/stairs"],
    "/dp/complete-knapsack": ["/dp/01-knapsack"],
    "/dp/lcs": ["/dp/01-knapsack"],
    "/dp/edit-distance": ["/dp/lcs"],
    "/classic/hanoi": ["/stack"],
    "/classic/kmp": ["/array", "/search/binary"],
  };

  var STORE_KEY = "learning-path-v1";

  var urlToModule = {};
  MODULES.forEach(function (m) { urlToModule[m.url] = m; });

  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) {}
  }
  function isLearned(p, url) { return p[url] === true; }

  /* 拓扑排序（Kahn）+ 阶段分层：level = 前置最大 level + 1 */
  function computeLevels() {
    var level = {};
    var indeg = {};
    MODULES.forEach(function (m) { level[m.url] = 0; indeg[m.url] = 0; });
    MODULES.forEach(function (m) {
      (PREREQS[m.url] || []).forEach(function (u) {
        if (urlToModule[u]) indeg[m.url]++;
      });
    });
    /* 队列中同时记录当前层（BFS 分层） */
    var queue = [];
    MODULES.forEach(function (m) { if (indeg[m.url] === 0) queue.push(m.url); });
    var order = [];
    var head = 0;
    while (head < queue.length) {
      var u = queue[head++];
      order.push(u);
      MODULES.forEach(function (m) {
        var prereqs = PREREQS[m.url] || [];
        for (var i = 0; i < prereqs.length; i++) {
          if (prereqs[i] === u) {
            indeg[m.url]--;
            if (level[m.url] < level[u] + 1) level[m.url] = level[u] + 1;
            if (indeg[m.url] === 0) queue.push(m.url);
            break;
          }
        }
      });
    }
    /* 防环保护：若存在环（未排完），把剩余模块按原名追加到末尾 */
    if (order.length < MODULES.length) {
      MODULES.forEach(function (m) {
        if (order.indexOf(m.url) < 0) { order.push(m.url); level[m.url] = 99; }
      });
    }
    return { order: order, level: level };
  }

  /* ---------- 渲染 ---------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function prereqText(p, url) {
    var need = [];
    (PREREQS[url] || []).forEach(function (u) {
      if (urlToModule[u] && !isLearned(p, u)) need.push(urlToModule[u].name);
    });
    return need;
  }

  function render() {
    var root = document.getElementById("learning-path");
    if (!root) return;
    var p = loadProgress();
    var levels = computeLevels();

    /* 进度条 */
    var total = MODULES.length;
    var done = 0;
    MODULES.forEach(function (m) { if (isLearned(p, m.url)) done++; });
    var pct = Math.round((done / total) * 100);
    var progWrap = document.getElementById("lp-progress");
    if (progWrap) {
      progWrap.innerHTML = "";
      progWrap.appendChild(el("div", "lp-prog-label",
        "已完成 <b>" + done + "</b> / " + total + " 个模块（" + pct + "%）"));
      var bar = el("div", "lp-prog-bar", "");
      var fill = el("div", "lp-prog-fill", "");
      fill.style.width = pct + "%";
      bar.appendChild(fill);
      progWrap.appendChild(bar);
    }

    /* 按阶段分组（level 升序），组内按分类排序 */
    var stages = {};
    MODULES.forEach(function (m) {
      var lv = levels.level[m.url];
      (stages[lv] = stages[lv] || []).push(m);
    });
    Object.keys(stages).forEach(function (lv) {
      stages[lv].sort(function (a, b) {
        if (CAT_ORDER[a.cat] !== CAT_ORDER[b.cat]) return CAT_ORDER[a.cat] - CAT_ORDER[b.cat];
        return a.name.localeCompare(b.name, "zh");
      });
    });
    var lvs = Object.keys(stages).map(Number).sort(function (a, b) { return a - b; });

    var list = document.getElementById("lp-stages");
    if (!list) return;
    list.innerHTML = "";
    lvs.forEach(function (lv, idx) {
      var stage = el("div", "lp-stage");
      var head = el("div", "lp-stage-head", "");
      head.appendChild(el("span", "lp-stage-num", "第 " + (idx + 1) + " 阶段"));
      var headInfo = el("span", "lp-stage-info", "推荐顺序：先掌握前置，再进入本阶段");
      head.appendChild(headInfo);
      stage.appendChild(head);
      var grid = el("div", "lp-grid", "");
      stages[lv].forEach(function (m) {
        var learned = isLearned(p, m.url);
        var need = prereqText(p, m.url);
        var row = el("div", "lp-module" + (learned ? " learned" : ""), "");
        var name = el("a", "lp-name", m.name);
        name.href = m.url;
        row.appendChild(name);
        row.appendChild(el("span", "lp-cat", CAT_LABEL[m.cat]));
        if (need.length) {
          row.appendChild(el("span", "lp-prereq", "前置：需先学 " + need.join("、")));
        } else if (learned) {
          row.appendChild(el("span", "lp-prereq ok", "✓ 前置已具备"));
        } else {
          row.appendChild(el("span", "lp-prereq ready", "可开始学习"));
        }
        var btn = el("button", "lp-toggle" + (learned ? " learned" : ""),
          learned ? "已学 ✓（点击取消）" : "标记已学");
        btn.addEventListener("click", function () {
          p[m.url] = !isLearned(p, m.url);
          saveProgress(p);
          render();
        });
        row.appendChild(btn);
        grid.appendChild(row);
      });
      stage.appendChild(grid);
      list.appendChild(stage);
    });
  }

  /* 重置进度 */
  function bindReset() {
    var btn = document.getElementById("lp-reset");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (window.confirm && !window.confirm("确定清除全部学习进度吗？")) return;
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      render();
    });
  }

  function init() {
    if (!document.getElementById("learning-path")) return;
    render();
    bindReset();
  }

  window.__learningPath = { MODULES: MODULES, PREREQS: PREREQS, computeLevels: computeLevels, render: render };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
