/* 算法对比模式（/compare）：
   左右两栏各跑一种排序算法，使用同一份数据；共享 播放/暂停/单步/速度，
   结束时对比 步数/比较/交换。纯数组模式 + buildSortSpecs 柱状图。 */

(function () {
  "use strict";

  /* 7 种比较排序的函数代码（csim 可直接执行），页面负责注入同一份 main */
  var SORTS = [
    {
      name: "冒泡排序", url: "/sorting/bubble", fn: "bubble_sort",
      code: "void bubble_sort(int a[], int n) {\n" +
        "    for (int i = 0; i < n - 1; i++) {\n" +
        "        for (int j = 0; j < n - 1 - i; j++) {\n" +
        "            if (a[j] > a[j + 1]) {\n" +
        "                int t = a[j];\n" +
        "                a[j] = a[j + 1];\n" +
        "                a[j + 1] = t;\n" +
        "            }\n" +
        "        }\n" +
        "    }\n" +
        "}",
    },
    {
      name: "选择排序", url: "/sorting/selection", fn: "selection_sort",
      code: "void selection_sort(int a[], int n) {\n" +
        "    for (int i = 0; i < n - 1; i++) {\n" +
        "        int min = i;\n" +
        "        for (int j = i + 1; j < n; j++) {\n" +
        "            if (a[j] < a[min]) min = j;\n" +
        "        }\n" +
        "        if (min != i) {\n" +
        "            int t = a[i]; a[i] = a[min]; a[min] = t;\n" +
        "        }\n" +
        "    }\n" +
        "}",
    },
    {
      name: "插入排序", url: "/sorting/insertion", fn: "insertion_sort",
      code: "void insertion_sort(int a[], int n) {\n" +
        "    for (int i = 1; i < n; i++) {\n" +
        "        int key = a[i];\n" +
        "        int j = i - 1;\n" +
        "        while (j >= 0 && a[j] > key) {\n" +
        "            a[j + 1] = a[j];\n" +
        "            j--;\n" +
        "        }\n" +
        "        a[j + 1] = key;\n" +
        "    }\n" +
        "}",
    },
    {
      name: "快速排序", url: "/sorting/quick", fn: "quick_sort", callMain: "quick_sort(a, 0, n - 1)",
      code: "void quick_sort(int a[], int lo, int hi) {\n" +
        "    if (lo >= hi) return;\n" +
        "    int i = lo, j = hi;\n" +
        "    int pivot = a[(lo + hi) / 2];\n" +
        "    while (i <= j) {\n" +
        "        while (a[i] < pivot) i++;\n" +
        "        while (a[j] > pivot) j--;\n" +
        "        if (i <= j) {\n" +
        "            int t = a[i]; a[i] = a[j]; a[j] = t;\n" +
        "            i++;\n" +
        "            j--;\n" +
        "        }\n" +
        "    }\n" +
        "    quick_sort(a, lo, j);\n" +
        "    quick_sort(a, i, hi);\n" +
        "}",
    },
    {
      name: "归并排序", url: "/sorting/merge", fn: "merge_sort", callMain: "merge_sort(a, 0, n - 1)",
      code: "void merge_sort(int a[], int lo, int hi) {\n" +
        "    if (lo >= hi) return;\n" +
        "    int mid = (lo + hi) / 2;\n" +
        "    merge_sort(a, lo, mid);\n" +
        "    merge_sort(a, mid + 1, hi);\n" +
        "    int tmp[32];\n" +
        "    int i = lo, j = mid + 1, k = lo;\n" +
        "    while (i <= mid && j <= hi) {\n" +
        "        if (a[i] <= a[j]) { tmp[k] = a[i]; i++; }\n" +
        "        else { tmp[k] = a[j]; j++; }\n" +
        "        k++;\n" +
        "    }\n" +
        "    while (i <= mid) { tmp[k] = a[i]; i++; k++; }\n" +
        "    while (j <= hi) { tmp[k] = a[j]; j++; k++; }\n" +
        "    for (int t = lo; t <= hi; t++) a[t] = tmp[t];\n" +
        "}",
    },
    {
      name: "希尔排序", url: "/sorting/shell", fn: "shell_sort",
      code: "void shell_sort(int a[], int n) {\n" +
        "    int gap = n / 2;\n" +
        "    while (gap > 0) {\n" +
        "        for (int i = gap; i < n; i++) {\n" +
        "            int key = a[i];\n" +
        "            int j = i;\n" +
        "            while (j >= gap && a[j - gap] > key) {\n" +
        "                a[j] = a[j - gap];\n" +
        "                j = j - gap;\n" +
        "            }\n" +
        "            a[j] = key;\n" +
        "        }\n" +
        "        gap = gap / 2;\n" +
        "    }\n" +
        "}",
    },
    {
      name: "堆排序", url: "/sorting/heap", fn: "heap_sort",
      code: "void heapify(int a[], int n, int i) {\n" +
        "    int largest = i;\n" +
        "    int l = 2 * i + 1;\n" +
        "    int r = 2 * i + 2;\n" +
        "    if (l < n && a[l] > a[largest]) largest = l;\n" +
        "    if (r < n && a[r] > a[largest]) largest = r;\n" +
        "    if (largest != i) {\n" +
        "        int t = a[i]; a[i] = a[largest]; a[largest] = t;\n" +
        "        heapify(a, n, largest);\n" +
        "    }\n" +
        "}\n" +
        "void heap_sort(int a[], int n) {\n" +
        "    for (int i = n / 2 - 1; i >= 0; i--) heapify(a, n, i);\n" +
        "    for (int i = n - 1; i > 0; i--) {\n" +
        "        int t = a[0]; a[0] = a[i]; a[i] = t;\n" +
        "        heapify(a, i, 0);\n" +
        "    }\n" +
        "}",
    },
  ];

  var state = { A: null, B: null, timer: null, playing: false, speed: 500, arr: null };

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function parseCSV(raw) {
    if (!raw || typeof raw !== "string") return null;
    var parts = raw.split(/[,，\s]+/).filter(function (s) { return s.length > 0; });
    if (parts.length < 4 || parts.length > 15) return null;
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var n = Number(parts[i]);
      if (!isFinite(n) || Math.floor(n) !== n || n < 1 || n > 99) return null;
      out.push(n);
    }
    return out;
  }

  function randomArray() {
    var a = [];
    for (var i = 0; i < 10; i++) a.push(1 + Math.floor(Math.random() * 99));
    return a;
  }

  function buildCode(algo, arr) {
    return algo.code +
      "\nint main(void) {\n" +
      "    int a[] = { " + arr.join(", ") + " };\n" +
      "    int n = sizeof(a) / sizeof(a[0]);\n" +
      "    " + (algo.callMain || algo.fn + "(a, n)") + ";\n" +
      "    return 0;\n" +
      "}";
  }

  /* 跑一个算法：返回 { steps, stats }；失败返回 { error } */
  function run(algo, arr) {
    var res = CSim.run(buildCode(algo, arr), {});
    if (!res.ok) return { error: res.error && res.error.msg ? res.error.msg : "执行失败" };
    var stats = { comparisons: 0, swaps: 0, visited: 0, writes: 0 };
    for (var i = 0; i < res.steps.length; i++) {
      var s = res.steps[i];
      if (s.cmp) stats.comparisons++;
      if (s.swap) stats.swaps++;
      if (s.markNode != null) stats.writes++;
    }
    return { steps: res.steps, stats: stats };
  }

  function renderStep(stage, step) {
    if (!step) return;
    if (typeof buildSortSpecs === "function") {
      var specs = buildSortSpecs(step);
      renderSVG(stage, "0 0 " + SVG_W + " " + SVG_H, specs);
    } else {
      renderSVG(stage, "0 0 320 120",
        [text("empty", 160, 60, "（暂无画面）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    }
  }

  function makeSide(selId, stageId, infoId, statsId) {
    return {
      select: $(selId), stage: $(stageId), info: $(infoId), statsEl: $(statsId),
      algo: null, steps: [], i: 0, stats: null, done: false,
    };
  }

  function currentAlgo(side) {
    var url = side.select.value;
    for (var i = 0; i < SORTS.length; i++) if (SORTS[i].url === url) return SORTS[i];
    return SORTS[0];
  }

  function precompute(side) {
    var r = run(side.algo, state.arr);
    if (r.error) {
      side.steps = [];
      side.info.textContent = "执行失败：" + r.error;
      return false;
    }
    side.steps = r.steps;
    side.stats = r.stats;
    side.i = 0;
    side.done = false;
    side.info.textContent = "";
    return true;
  }

  function drawBoth() {
    for (var k = 0; k < 2; k++) {
      var s = state[k ? "B" : "A"];
      if (!s || !s.steps.length) continue;
      var t = $("cmp-title-" + (k ? "b" : "a"));
      if (t && s.algo) t.innerHTML = '<a href="' + s.algo.url + '">' + s.algo.name + "</a>";
      renderStep(s.stage, s.steps[s.i]);
      s.info.textContent = "步骤 " + (s.i + 1) + " / " + s.steps.length +
        (s.done ? "　✅ 完成" : "");
      var parts = [];
      if (s.stats.comparisons) parts.push("比较 " + s.stats.comparisons);
      if (s.stats.swaps) parts.push("交换 " + s.stats.swaps);
      if (s.stats.writes) parts.push("写入 " + s.stats.writes);
      s.statsEl.innerHTML = parts.join("　");
      s.statsEl.style.display = parts.length ? "" : "none";
    }
  }

  function advance() {
    var ended = 0;
    for (var k = 0; k < 2; k++) {
      var s = state[k ? "B" : "A"];
      if (!s.steps.length || s.done) { ended++; continue; }
      if (s.i < s.steps.length - 1) { s.i++; }
      if (s.i >= s.steps.length - 1) { s.done = true; ended++; }
    }
    drawBoth();
    return ended === 2;
  }

  function tick() {
    if (!state.playing) return;
    if (advance()) {
      state.playing = false;
      $("btn-cmp-play").textContent = "▶ 播放";
      showVerdict();
      return;
    }
    state.timer = setTimeout(tick, state.speed);
  }

  function play() {
    if (state.playing) return;
    /* 两边都结束时从头播 */
    if ((!state.A.steps.length) || (state.A.done && state.B.done)) {
      state.A.i = 0; state.A.done = false;
      state.B.i = 0; state.B.done = false;
    }
    state.playing = true;
    $("btn-cmp-play").textContent = "⏸ 暂停";
    tick();
  }
  function pause() {
    state.playing = false;
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    $("btn-cmp-play").textContent = "▶ 播放";
  }

  function stepBoth(dir) {
    pause();
    if (dir === 1) advance();
    else {
      for (var k = 0; k < 2; k++) {
        var s = state[k ? "B" : "A"];
        if (s.i > 0) { s.i--; s.done = false; }
      }
      drawBoth();
    }
  }

  function showVerdict() {
    var v = $("cmp-verdict");
    if (!v) return;
    var A = state.A, B = state.B;
    var aSteps = A.steps.length, bSteps = B.steps.length;
    var aCmp = A.stats.comparisons, bCmp = B.stats.comparisons;
    var aSw = A.stats.swaps, bSw = B.stats.swaps;
    var quickLine = aSteps === bSteps ? "步数相同" : (aSteps < bSteps ? A.algo.name + " 更快完成" : B.algo.name + " 更快完成");
    v.innerHTML =
      "<b>" + A.algo.name + "</b>：共 " + aSteps + " 步 · 比较 " + aCmp + " · 交换 " + aSw +
      "　<b>" + B.algo.name + "</b>：共 " + bSteps + " 步 · 比较 " + bCmp + " · 交换 " + bSw +
      "<br>结论：" + quickLine +
      (aCmp !== bCmp ? "；比较次数 " + (aCmp < bCmp ? A.algo.name : B.algo.name) + " 更少" : "") +
      (aSw !== bSw ? "；交换次数 " + (aSw < bSw ? A.algo.name : B.algo.name) + " 更少" : "");
  }

  function initSides() {
    state.A = makeSide("cmp-algo-a", "cmp-stage-a", "cmp-info-a", "cmp-stats-a");
    state.B = makeSide("cmp-algo-b", "cmp-stage-b", "cmp-info-b", "cmp-stats-b");
    var sA = state.A.select, sB = state.B.select;
    SORTS.forEach(function (s, idx) {
      var o1 = document.createElement("option");
      o1.value = s.url; o1.textContent = s.name;
      sA.appendChild(o1);
      var o2 = document.createElement("option");
      o2.value = s.url; o2.textContent = s.name;
      sB.appendChild(o2);
    });
    /* 默认：冒泡 vs 快速 */
    sA.value = "/sorting/bubble";
    sB.value = "/sorting/quick";
    sA.addEventListener("change", function () { reset(false); });
    sB.addEventListener("change", function () { reset(false); });
    var dataEl = $("cmp-data");
    var randomize = function () {
      state.arr = randomArray();
      if (dataEl) dataEl.textContent = "数据：" + state.arr.join(", ");
      reset(false);
    };
    $("btn-cmp-random").addEventListener("click", randomize);
    var customBtn = $("btn-cmp-custom");
    if (customBtn) customBtn.addEventListener("click", function () {
      var raw = $("cmp-custom-input").value;
      var arr = parseCSV(raw);
      if (!arr) {
        var st = $("cmp-status");
        if (st) st.textContent = "请输入 4~15 个 1~99 的整数，用逗号分隔";
        return;
      }
      state.arr = arr;
      if (dataEl) dataEl.textContent = "数据：" + arr.join(", ");
      reset(false);
    });
    $("btn-cmp-play").addEventListener("click", function () { state.playing ? pause() : play(); });
    $("btn-cmp-prev").addEventListener("click", function () { stepBoth(-1); });
    $("btn-cmp-next").addEventListener("click", function () { stepBoth(1); });
    $("btn-cmp-reset").addEventListener("click", function () { reset(true); });
    var sp = $("cmp-speed");
    if (sp) sp.addEventListener("input", function () { state.speed = +sp.value; });
    randomize();
  }

  function reset(regenerateData) {
    pause();
    if (regenerateData) {
      state.arr = randomArray();
      var dataEl = $("cmp-data");
      if (dataEl) dataEl.textContent = "数据：" + state.arr.join(", ");
    }
    if (!state.arr) { state.arr = randomArray(); }
    state.A.algo = currentAlgo(state.A);
    state.B.algo = currentAlgo(state.B);
    var okA = precompute(state.A), okB = precompute(state.B);
    var st = $("cmp-status");
    if (!okA || !okB) {
      if (st) st.textContent = "有一个算法无法执行，请换一组数据";
      return;
    }
    if (st) st.textContent = "";
    var v = $("cmp-verdict");
    if (v) v.textContent = "";
    drawBoth();
    if ($("btn-cmp-play")) $("btn-cmp-play").textContent = "▶ 播放";
  }

  function init() {
    if (!document.getElementById("cmp-stage-a")) return;
    initSides();
  }

  window.__compare = { SORTS: SORTS, state: state, reset: reset, advance: advance, run: run };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
