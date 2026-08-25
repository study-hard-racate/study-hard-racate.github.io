/* 固定演示页初始化：用 csim 引擎跑内置示例代码，生成步骤交给播放器与对应渲染器。
   页面用法：setupDemo({ sample, renderMode, withRandom, speed })
   renderMode: "sort"（排序数组）| "array"（通用数组）| "stack"（竖直数组栈）
               | "queue"（数组队列）| "list"（链表）| "tree"（树形图）| "graph"（图）
               | "dp01"/"dpcomplete"（一维 DP 滚动数组）| "lcs"/"editdistance"（2D DP 表） */

/* 根据步骤快照生成人类可读的步骤注释 */
function generateStepComment(step, renderMode) {
  if (!step) return "";
  const msg = step.msg || "";
  
  /* 排序模式：msg 已包含详细信息 */
  if (renderMode === "sort" && msg) {
    if (msg.indexOf("交换") >= 0) return "交换两个元素的位置";
    if (msg.indexOf("比较") >= 0) return "比较两个元素的大小";
    if (msg.indexOf("归位") >= 0 || msg.indexOf("已排好") >= 0) return "元素已到达最终位置";
    if (msg.indexOf("pivot") >= 0 || msg.indexOf("基准") >= 0) return "选择基准元素进行分区";
    return msg;
  }
  
  /* 堆排序模式 */
  if (renderMode === "heap" && step.arr) {
    const arr = step.arr;
    const line = step.line;
    if (msg && msg.indexOf("初始化数组") >= 0) return "建堆准备：即将对数组进行原地堆排序";
    if (msg && msg.indexOf("交换") >= 0) return "交换堆顶与末尾元素，最大值归位";
    if (line >= 4 && line <= 11) return "调整堆：比较父子节点，下沉较大值";
    if (line >= 14 && line <= 15) return "建堆阶段：从最后一个非叶子节点开始，逐个下沉";
    if (line >= 18 && line <= 20) return "排序阶段：交换堆顶与末尾，缩小堆范围";
    return msg || "堆排序操作";
  }
  
  /* 链表模式 */
  if (step.list && renderMode === "list") {
    const snap = step.list;
    if (snap.markNode != null && snap.markField) {
      const val = snap.data ? snap.data[snap.markNode] : "";
      return "写入节点 " + val + " 的 " + snap.markField + " 字段";
    }
    if (snap.cmpIds && snap.cmpIds.length === 2) {
      return "比较节点 " + (snap.data ? snap.data[snap.cmpIds[0]] : "") + " 与 " + (snap.data ? snap.data[snap.cmpIds[1]] : "");
    }
    if (snap.cur != null) {
      return "访问节点 " + (snap.data ? snap.data[snap.cur] : "");
    }
    return "链表操作";
  }
  
  /* 树模式 */
  if (step.tree && (renderMode === "tree" || renderMode === "bst")) {
    const snap = step.tree;
    if (snap.markNode != null && snap.markField) {
      const node = snap.nodes ? snap.nodes[snap.markNode] : null;
      return "写入节点 " + (node ? node.data : "") + " 的 " + snap.markField + " 字段";
    }
    if (snap.cmpIds && snap.cmpIds.length === 2) {
      const n1 = snap.nodes ? snap.nodes[snap.cmpIds[0]] : null;
      const n2 = snap.nodes ? snap.nodes[snap.cmpIds[1]] : null;
      return "比较节点 " + (n1 ? n1.data : "") + " 与 " + (n2 ? n2.data : "");
    }
    if (snap.cur != null) {
      const node = snap.nodes ? snap.nodes[snap.cur] : null;
      return "访问节点 " + (node ? node.data : "");
    }
    return "树操作";
  }

  /* 红黑树模式 */
  if (step.tree && renderMode === "rbtree") {
    const snap = step.tree;
    const msg = step.msg || "";
    if (msg.indexOf("左旋") >= 0) return "左旋操作：调整树平衡";
    if (msg.indexOf("右旋") >= 0) return "右旋操作：调整树平衡";
    if (msg.indexOf("变色") >= 0 || msg.indexOf("color") >= 0) return "调整节点颜色，维护红黑性质";
    if (snap.markNode != null && snap.markField) {
      const node = snap.nodes ? snap.nodes[snap.markNode] : null;
      return "写入节点 " + (node ? node.data : "") + " 的 " + snap.markField;
    }
    if (snap.cmpIds && snap.cmpIds.length === 2) {
      const n1 = snap.nodes ? snap.nodes[snap.cmpIds[0]] : null;
      const n2 = snap.nodes ? snap.nodes[snap.cmpIds[1]] : null;
      return "比较节点 " + (n1 ? n1.data : "") + " 与 " + (n2 ? n2.data : "");
    }
    if (snap.cur != null) {
      const node = snap.nodes ? snap.nodes[snap.cur] : null;
      return "访问节点 " + (node ? node.data : "");
    }
    return msg || "红黑树操作";
  }
  
  /* 哈希表模式（必须在图模式之前检查，防止 fall-through 到"图遍历"） */
  if (step.graph && renderMode === "hash") {
    const snap = step.graph;
    if (snap.cur != null) {
      const val = snap.data ? snap.data[snap.cur] : "";
      return "访问哈希槽中的元素 " + val;
    }
    return "哈希表操作";
  }

  /* 图模式 */
  if (step.graph && renderMode === "graph") {
    const snap = step.graph;
    if (snap.curVertex != null) {
      return "访问顶点 " + snap.curVertex;
    }
    if (snap.vars && snap.vars.visited) {
      const visited = snap.vars.visited;
      const count = visited.filter(function(v) { return v === 1; }).length;
      return "已访问 " + count + "/" + snap.n + " 个顶点";
    }
    return "图遍历";
  }

  /* 拓扑排序模式 */
  if (step.graph && renderMode === "topological") {
    const snap = step.graph;
    const vars = snap.vars || {};
    const inDegree = vars.inDegree;
    const result = vars.result;
    const top = vars.top !== undefined ? vars.top : 0;
    if (snap.curVertex != null) {
      if (inDegree && inDegree[snap.curVertex] === 0 && (!vars.visited || !vars.visited[snap.curVertex])) {
        return "入度为 0，顶点 " + snap.curVertex + " 入队并加入结果";
      }
      return "处理顶点 " + snap.curVertex + " 的邻居，减少入度";
    }
    if (top > 0 && result) {
      return "已排序 " + top + " 个顶点：" + result.slice(0, top).join(" → ");
    }
    return "计算入度，准备拓扑排序";
  }
  
  /* 查找模式 */
  if (renderMode === "linear" || renderMode === "binary" || renderMode === "block") {
    const vars = step.vars || {};
    if (vars.found != null) return "找到目标元素，下标为 " + vars.found;
    if (renderMode === "binary") {
      if (vars.mid != null) return "计算中间位置 mid = " + vars.mid + "，比较 arr[mid] 与目标";
      if (vars.lo != null && vars.hi != null) return "当前搜索区间 [" + vars.lo + ", " + vars.hi + "]";
    }
    if (renderMode === "linear" && vars.i != null) return "扫描第 " + vars.i + " 个元素";
    if (renderMode === "block" && vars.b != null) return "定位到第 " + vars.b + " 块";
    return msg || "查找操作";
  }
  
  /* 栈/队列模式 */
  if (renderMode === "stack" || renderMode === "queue") {
    const vars = step.vars || {};
    if (msg) return msg;
    if (renderMode === "stack" && vars.top != null) return "栈顶指针 top = " + vars.top;
    if (renderMode === "queue") {
      if (vars.front != null && vars.rear != null) return "front = " + vars.front + "，rear = " + vars.rear;
    }
    return "数组操作";
  }
  
  /* 并查集模式 */
  if (renderMode === "unionfind") {
    const vars = step.vars || {};
    const uf = step.uf || {};
    const compressed = uf.compressed || [];
    if (compressed.length > 0) {
      return "路径压缩：节点 " + compressed.join(", ") + " 直接连接到根";
    }
    if (vars.x !== undefined && msg) return msg;
    if (msg) return msg;
    return "并查集操作";
  }
  
  /* DP模式 */
  if (step.dp && (renderMode === "dp01" || renderMode === "dpcomplete")) {
    const dp = step.dp;
    const vars = step.vars || {};
    const phase = dp.phase;
    const weights = dp.weights || [];
    const values = dp.values || [];
    if (phase === 1) {
      return "初始化：将 dp[0.." + dp.W + "] 全部设为 0";
    }
    if (phase === 3) {
      return "完成！最大价值 = dp[" + dp.W + "] = " + (dp.table[dp.W] || 0);
    }
    if (phase === 2 && dp.i !== undefined && dp.j !== undefined) {
      const wi = weights[dp.i] || 0;
      const vi = values[dp.i] || 0;
      if (dp.j < wi) {
        return "物品 #" + dp.i + " 重量 " + wi + " > 容量 " + dp.j + "，跳过";
      }
      const oldVal = dp.table[dp.j] || 0;
      const depVal = (dp.table[dp.prevW] || 0) + vi;
      if (depVal > oldVal) {
        return "选物品 #" + dp.i + "：dp[" + dp.j + "] = max(" + oldVal + ", " + depVal + ") = " + depVal;
      } else {
        return "不选物品 #" + dp.i + "：dp[" + dp.j + "] = max(" + oldVal + ", " + depVal + ") = " + oldVal;
      }
    }
    if (msg) return msg;
    return "动态规划";
  }
  
  /* 基数排序 */
  if (renderMode === "radix") {
    const vars = step.vars || {};
    const exp = vars.exp;
    const i = vars.i;
    const a = step.arr || [];
    if (exp !== undefined && exp <= 100 && i !== undefined && i >= 0 && i < a.length) {
      return "按" + (exp === 1 ? "个位" : exp === 10 ? "十位" : "百位") + "排序：处理 a[" + i + "]=" + a[i];
    }
    if (exp !== undefined && exp > 100) {
      return "完成！三轮排序后数组有序";
    }
    return msg || "基数排序";
  }

  /* KMP 字符串匹配 */
  if (renderMode === "kmp") {
    const vars = step.vars || {};
    const phase = vars.phase;
    const i = vars.i, j = vars.j;
    const t = step.arr || [];
    const p = vars.p || [];
    const CHAR = ["", "A", "B", "C", "D"];
    const ch = (v) => CHAR[v] !== undefined ? CHAR[v] : String(v);
    if (phase === 1) {
      return "构建 next 数组：j=" + j + "（记录前缀与后缀的最长公共长度）";
    }
    if (phase === 2 && i !== undefined && j !== undefined && i < t.length && j >= 0) {
      if (t[i] === p[j]) {
        return "t[" + i + "]=" + ch(t[i]) + " == p[" + j + "]=" + ch(p[j]) + "，匹配继续";
      }
      return "t[" + i + "]=" + ch(t[i]) + " ≠ p[" + j + "]=" + ch(p[j]) + "，失配！j 回退到 next[" + j + "]=" + (p.length ? (vars.next || [])[j] : 0);
    }
    if (phase === 3) {
      return vars.pos >= 0
        ? "匹配成功！模式串出现在主串下标 " + vars.pos + " 处"
        : "匹配结束，未找到模式串";
    }
    return msg || "KMP 字符串匹配";
  }

  /* 计数排序 */
  if (renderMode === "countingsort") {
    const vars = step.vars || {};
    const phase = vars.phase;
    const i = vars.i;
    const a = step.arr || [];
    if (phase === 1 && i !== undefined && i >= 0) {
      return "计数：count[" + a[i] + "] 加 1（值 " + a[i] + " 出现次数 +1）";
    }
    if (phase === 2 && i !== undefined) {
      return "前缀和：count[" + i + "] = count[" + i + "] + count[" + (i - 1) + "]（值 ≤ " + i + " 的个数）";
    }
    if (phase === 3 && i !== undefined && i >= 0) {
      return "放回：把 a[" + i + "]=" + a[i] + " 放入 out 的 count[" + a[i] + "]-1 位置";
    }
    if (phase === 3) {
      return "完成！out 数组已有序";
    }
    return msg || "计数排序";
  }

  /* 汉诺塔 */
  if (renderMode === "hanoi") {
    const vars = step.vars || {};
    const cur = vars.cur;
    if (cur !== undefined && cur !== null && cur >= 1) {
      return "移动盘 " + cur + "（黄色高亮）";
    }
    return msg || "汉诺塔";
  }

  /* Dijkstra 最短路径 */
  if (renderMode === "dijkstra") {
    const vars = step.vars || {};
    const phase = vars.phase;
    const n = vars.n || 0;
    const u = vars.u, v = vars.v;
    if (phase === 1) {
      return "初始化：dist[0]=0，其余顶点 dist 置 ∞（9999），fin 全部置 0";
    }
    if (phase === 3) {
      let parts = [];
      for (let i = 0; i < n; i++) {
        parts.push("0→" + i + "=" + (step.arr && step.arr[i] !== undefined && step.arr[i] < 9999 ? step.arr[i] : "∞"));
      }
      return "完成！各顶点最短距离：" + parts.join("，");
    }
    if (phase === 2 && u !== undefined && v !== undefined) {
      return "松弛：经 " + u + " 更新顶点 " + v + " 的距离";
    }
    if (phase === 2 && u !== undefined) {
      return "选择距离最小的未确定顶点 u=" + u + "，标记为已确定";
    }
    if (phase === 2) {
      return "在未确定顶点中查找距离最小者";
    }
    return msg || "Dijkstra 最短路径";
  }

  /* 爬楼梯：一维递推 dp[i] = dp[i-1] + dp[i-2] */
  if (step.dp && renderMode === "stairs") {
    const dp = step.dp;
    const i = dp.i;
    const phase = dp.phase;
    if (phase === 1) {
      return "初始化：dp[0] = 1（不走），dp[1] = 1（跨 1 步）";
    }
    if (phase === 3) {
      return "完成！爬到第 " + dp.n + " 阶共有 " + (dp.table[dp.n] || 0) + " 种走法";
    }
    if (phase === 2 && i !== undefined && i <= dp.n) {
      const v1 = dp.table[i - 1] || 0;
      const v2 = dp.table[i - 2] || 0;
      return "dp[" + i + "] = dp[" + (i - 1) + "] + dp[" + (i - 2) + "] = " + v1 + " + " + v2 + " = " + (dp.table[i] || 0);
    }
    if (msg) return msg;
    return "爬楼梯";
  }

  /* LIS 最长递增子序列 */
  if (step.dp && renderMode === "lis") {
    const dp = step.dp;
    const vars = step.vars || {};
    const i = dp.i, j = dp.j, phase = dp.phase;
    const seq = dp.weights || [];
    if (phase === 1) {
      return "初始化：每个元素自身构成长度 1 的递增子序列";
    }
    if (phase === 3) {
      let mx = 0;
      for (let c = 0; c < dp.table.length; c++) if ((dp.table[c] || 0) > mx) mx = dp.table[c];
      return "完成！最长递增子序列长度 = " + mx;
    }
    if (phase === 2 && i !== undefined && j !== undefined && j < i) {
      const ai = seq[i], aj = seq[j];
      if (aj < ai) {
        const oldV = dp.table[i] || 1;
        const cand = (dp.table[j] || 1) + 1;
        return "a[" + j + "]=" + aj + " < a[" + i + "]=" + ai + " → dp[" + i + "] = max(" + oldV + ", dp[" + j + "]+1) = " + (cand > oldV ? cand : oldV);
      }
      return "a[" + j + "]=" + aj + " ≥ a[" + i + "]=" + ai + "，不构成递增，跳过";
    }
    if (phase === 2 && i !== undefined) {
      return "处理元素 a[" + i + "]=" + seq[i] + "，扫描左侧元素找更小值";
    }
    if (msg) return msg;
    return "最长递增子序列";
  }

  /* LCS / 编辑距离（2D DP 表） */
  if (step.dp && (renderMode === "lcs" || renderMode === "editdistance")) {
    const dp = step.dp;
    const vars = step.vars || {};
    const phase = dp.phase;
    const isLcs = renderMode === "lcs";
    const seqB = vars.b || vars.t || [];
    const m = vars.m !== undefined ? vars.m : 0;
    const n = dp.n !== undefined ? dp.n : 0;
    const table = dp.table || [];
    if (phase === 1) {
      return isLcs ? "初始化：第 0 行 / 第 0 列全部置 0" : "初始化：第 0 行 / 第 0 列填 i 与 j";
    }
    if (phase === 2 && dp.i !== undefined && dp.j !== undefined) {
      const aVal = (dp.weights || [])[dp.i - 1];
      const bVal = seqB[dp.j - 1];
      const curVal = table[dp.i * (n + 1) + dp.j];
      if (isLcs) {
        if (aVal === bVal) {
          return "A[" + (dp.i-1) + "]=" + aVal + " == B[" + (dp.j-1) + "]=" + bVal +
            "，dp[" + dp.i + "][" + dp.j + "] = dp[" + (dp.i-1) + "][" + (dp.j-1) + "] + 1 = " + curVal;
        }
        return "A[" + (dp.i-1) + "]=" + aVal + " ≠ B[" + (dp.j-1) + "]=" + bVal +
          "，dp[" + dp.i + "][" + dp.j + "] = max(上=" + (table[(dp.i-1) * (n + 1) + dp.j] || 0) +
          ", 左=" + (table[dp.i * (n + 1) + (dp.j-1)] || 0) + ") = " + curVal;
      }
      if (aVal === bVal) {
        return "S[" + (dp.i-1) + "]=" + aVal + " == T[" + (dp.j-1) + "]=" + bVal +
          "，dp[" + dp.i + "][" + dp.j + "] = dp[" + (dp.i-1) + "][" + (dp.j-1) + "] = " + curVal;
      }
      return "S[" + (dp.i-1) + "]=" + aVal + " ≠ T[" + (dp.j-1) + "]=" + bVal +
        "，dp[" + dp.i + "][" + dp.j + "] = min(上+1, 左+1, 左上+1) = " + curVal;
    }
    if (phase === 3) {
      const pathLen = vars.path_len !== undefined ? vars.path_len : 0;
      return isLcs
        ? "回溯：沿依赖方向回走，已标记 " + pathLen + " 个路径格（绿色）"
        : "回溯：反推最小操作路径，已标记 " + pathLen + " 个路径格（绿色）";
    }
    if (phase === 4) {
      const ans = table[m * (n + 1) + n] || 0;
      return isLcs
        ? "完成！最长公共子序列长度 = dp[" + m + "][" + n + "] = " + ans
        : "完成！最小编辑距离 = dp[" + m + "][" + n + "] = " + ans;
    }
    if (msg) return msg;
    return isLcs ? "最长公共子序列" : "编辑距离";
  }
  
  return msg || "";
}

/* 堆排序渲染器：上方显示数组柱状图，下方显示堆的树形结构 */
function renderHeapSort(stage, step) {
  const arr = step.arr;
  const n = arr ? arr.length : 0;
  if (!n) {
    renderSVG(stage, "0 0 400 120",
      [text("empty", 200, 60, "（无数据）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
    return;
  }

  /* 解析消息获取交换的两个索引 */
  var swapI = -1, swapJ = -1;
  if (step.swap && step.msg) {
    var mm = step.msg.match(/a\[(\d+)\].*a\[(\d+)\]/);
    if (mm) { swapI = parseInt(mm[1]); swapJ = parseInt(mm[2]); }
  }

  const maxVal = Math.max.apply(null, arr);
  const barH = 80, barW = Math.min(50, (400 - 20) / n - 4);
  const gap = 4;
  const totalW = n * (barW + gap);
  const offsetX = (400 - totalW) / 2;

  /* ---- 上半部分：数组柱状图 ---- */
  const barSpecs = [];
  for (let i = 0; i < n; i++) {
    const h = Math.max(8, (arr[i] / maxVal) * barH);
    const x = offsetX + i * (barW + gap);
    const y = barH - h + 10;
    const isComp = step.cmp && (step.cmp[0] === i || step.cmp[1] === i);
    const isSwap = (i === swapI || i === swapJ);
    const isDone = step.done && step.done.indexOf(i) >= 0;
    const fill = isSwap ? "#ff6b6b" : isComp ? "#ffd166" : isDone ? "#3ecf8e" : "#4da3ff";
    barSpecs.push(rect("bar-" + i, x, y, barW, h, { fill: fill, rx: 3 }));
    barSpecs.push(text("bval-" + i, x + barW / 2, y - 4, String(arr[i]),
      { "text-anchor": "middle", "font-size": 11, fill: "#e8eef7", "font-weight": "bold" }));
    barSpecs.push(text("bidx-" + i, x + barW / 2, barH + 16, String(i),
      { "text-anchor": "middle", "font-size": 10, fill: "#93a4c2" }));
  }

  /* ---- 下半部分：堆的树形结构 ---- */
  const treeTop = barH + 35;
  const R = 16;
  const treeLevels = Math.ceil(Math.log2(n + 1));
  const treeW = Math.max(totalW, 200);
  const treeGapY = 38;
  const treeSpecs = [];

  for (let i = 0; i < n; i++) {
    const level = Math.floor(Math.log2(i + 1));
    const posInLevel = i - (Math.pow(2, level) - 1);
    const nodesInLevel = Math.min(Math.pow(2, level), n - (Math.pow(2, level) - 1));
    const levelWidth = nodesInLevel * (R * 2 + 8);
    const levelStart = (treeW - levelWidth) / 2;
    const x = levelStart + posInLevel * (R * 2 + 8) + R;
    const y = treeTop + level * treeGapY + R;

    /* 画边到父节点 */
    if (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      const pLevel = Math.floor(Math.log2(parent + 1));
      const pPosInLevel = parent - (Math.pow(2, pLevel) - 1);
      const pNodesInLevel = Math.min(Math.pow(2, pLevel), n - (Math.pow(2, pLevel) - 1));
      const pLevelWidth = pNodesInLevel * (R * 2 + 8);
      const pLevelStart = (treeW - pLevelWidth) / 2;
      const px = pLevelStart + pPosInLevel * (R * 2 + 8) + R;
      const py = treeTop + pLevel * treeGapY + R;
      treeSpecs.push(line("edge-" + parent + "-" + i, px, py + R, x, y - R,
        { stroke: "#3a4c6e", "stroke-width": 1.5 }));
    }

    const isComp = step.cmp && (step.cmp[0] === i || step.cmp[1] === i);
    const isSwap = (i === swapI || i === swapJ);
    const isDone = step.done && step.done.indexOf(i) >= 0;
    const fill = isSwap ? "#ff6b6b" : isComp ? "#ffd166" : isDone ? "#3ecf8e" : "#232c40";
    const stroke = isSwap ? "#ff6b6b" : isComp ? "#ffd166" : isDone ? "#3ecf8e" : "#4da3ff";
    treeSpecs.push(circ("tn-" + i, x, y, R, { fill: fill, stroke: stroke, "stroke-width": isComp || isSwap ? 2.5 : 1.5 }));
    treeSpecs.push(text("tv-" + i, x, y + 4, String(arr[i]),
      { "text-anchor": "middle", "font-size": 11, "font-weight": "bold", fill: isComp || isSwap ? "#1c2433" : "#e8eef7" }));
  }

  /* 分隔线 */
  const sepY = barH + 28;
  treeSpecs.push(line("sep", offsetX, sepY, offsetX + totalW, sepY,
    { stroke: "#2c3a55", "stroke-width": 1, "stroke-dasharray": "4,4" }));

  /* 标签 */
  barSpecs.push(text("arr-label", 5, 8, "数组", { "font-size": 10, fill: "#93a4c2" }));
  treeSpecs.push(text("tree-label", 5, treeTop + 4, "堆结构", { "font-size": 10, fill: "#93a4c2" }));

  const allSpecs = barSpecs.concat(treeSpecs);
  const svgH = treeTop + treeLevels * treeGapY + R + 10;
  renderSVG(stage, "0 0 400 " + svgH, allSpecs);
}

function setupDemo(opts) {
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const stepComment = document.getElementById("step-comment");
  const sample = opts.sample;
  const renderMode = opts.renderMode || "sort";
  const speed = opts.speed || 850;
  let player = null;

  function render(step) {
    status.innerHTML = step.msg || "";
    
    /* 显示步骤注释 */
    if (stepComment) {
      const comment = generateStepComment(step, renderMode);
      if (comment) {
        stepComment.textContent = comment;
        stepComment.classList.add("visible");
      } else {
        stepComment.textContent = "";
        stepComment.classList.remove("visible");
      }
    }
    
    if (step.tree) {
      if (renderMode === "rbtree") {
        /* 红黑树：从 vars.colors 提取颜色信息 */
        var rbColors = {};
        if (step.vars && step.vars.colors) {
          var cArr = step.vars.colors;
          for (var ci = 0; ci < cArr.length; ci++) {
            if (cArr[ci] !== undefined && cArr[ci] !== null) {
              rbColors[ci] = cArr[ci] === 1 ? "red" : "black";
            }
          }
        }
        renderTreeCsim(stage, step.tree, rbColors);
        return;
      }
      renderTreeCsim(stage, step.tree); return;
    }
    if (step.list) {
      if (step.list.minStack) {
        renderArrayStack(stage, { arr: step.list.minStack.data, vars: { top: step.list.minStack.top } });
        return;
      }
      renderList(stage, step.list);
      return;
    }
    if (step.graph) {
      if (renderMode === "hash") { renderHash(stage, step.graph); return; }
      if (renderMode === "topological") { renderTopological(stage, step); return; }
      renderGraphCsim(stage, step.graph);
      return;
    }
    /* 基数排序：两行视图（a/out + 当前位数字） */
    if (renderMode === "radix") {
      renderRadixSort(stage, step);
      return;
    }
    /* KMP 字符串匹配：主串/模式串/next 表 */
    if (renderMode === "kmp") {
      renderKMP(stage, step);
      return;
    }
    /* 计数排序：三行视图（a/count/out） */
    if (renderMode === "countingsort") {
      renderCountingSort(stage, step);
      return;
    }
    /* 汉诺塔：三柱盘片 */
    if (renderMode === "hanoi") {
      renderHanoi(stage, step);
      return;
    }
    /* Dijkstra 最短路径：数组模式驱动（dist/fin/w 在 vars） */
    if (renderMode === "dijkstra") {
      renderDijkstra(stage, step);
      return;
    }
    /* 2D DP 表（LCS/编辑距离）：无条件路由，入口步骤无 dp 快照时也渲染空表格 */
    if (renderMode === "lcs" || renderMode === "editdistance") {
      renderDP2D(stage, step, renderMode);
      return;
    }
    /* 爬楼梯：一维递推 dp[i] = dp[i-1] + dp[i-2] */
    if (renderMode === "stairs") {
      renderStairs(stage, step);
      return;
    }
    /* LIS 最长递增子序列：序列行 + dp 行 */
    if (renderMode === "lis") {
      renderLIS(stage, step);
      return;
    }
    if (step.dp) {
      if (renderMode === "dp01" || renderMode === "dpcomplete") {
        renderDP(stage, step);
        return;
      }
    }
    if (step.uf && renderMode === "unionfind") {
      renderUnionFind(stage, step);
      return;
    }
    if (step.arr) {
      if (renderMode === "unionfind") { renderUnionFind(stage, step); return; }
      if (renderMode === "stack") { renderArrayStack(stage, step); return; }
      if (renderMode === "queue") { renderArrayQueue(stage, step); return; }
      if (renderMode === "linear") { renderLinearSearch(stage, step); return; }
      if (renderMode === "binary") { renderBinarySearch(stage, step); return; }
      if (renderMode === "block") { renderBlockSearch(stage, step); return; }
      if (renderMode === "heap") { renderHeapSort(stage, step); return; }
      const specs = buildSortSpecs(step);
      renderSVG(stage, "0 0 " + SVG_W + " " + SVG_H, specs);
      return;
    }
    renderSVG(stage, "0 0 320 120",
      [text("empty", 160, 60, "（暂无画面）", { "text-anchor": "middle", "font-size": 15, fill: "#5c6a85" })]);
  }

  function run(forceRandom) {
    const src = (forceRandom && opts.randomize) ? opts.randomize() : sample;
    const res = CSim.run(src, { forceRandom: !!forceRandom && !opts.randomize });
    if (!res.ok) {
      status.textContent = "演示代码无法执行：" + (res.error && res.error.msg ? res.error.msg : "未知错误");
      return;
    }
    /* 预计算统计信息 */
    var stats = { comparisons: 0, swaps: 0, visited: 0, writes: 0 };
    var visitedSet = {};
    for (var si = 0; si < res.steps.length; si++) {
      var s = res.steps[si];
      if (s.cmp) stats.comparisons++;
      if (s.swap) stats.swaps++;
      if (s.list && s.list.cur != null && !visitedSet["l" + s.list.cur]) { visitedSet["l" + s.list.cur] = 1; stats.visited++; }
      if (s.tree && s.tree.cur != null && !visitedSet["t" + s.tree.cur]) { visitedSet["t" + s.tree.cur] = 1; stats.visited++; }
      if (s.graph && s.graph.curVertex != null && !visitedSet["g" + s.graph.curVertex]) { visitedSet["g" + s.graph.curVertex] = 1; stats.visited++; }
      if (s.markNode != null) stats.writes++;
    }
    /* 渲染统计面板 */
    var statsEl = document.getElementById("step-stats");
    if (statsEl) {
      var parts = [];
      if (stats.comparisons > 0) parts.push("比较: <b>" + stats.comparisons + "</b>");
      if (stats.swaps > 0) parts.push("交换: <b>" + stats.swaps + "</b>");
      if (stats.visited > 0) parts.push("访问: <b>" + stats.visited + "</b>");
      if (stats.writes > 0) parts.push("写入: <b>" + stats.writes + "</b>");
      statsEl.innerHTML = parts.join("　");
      statsEl.style.display = parts.length ? "" : "none";
    }
    if (!player) {
      player = new StepPlayer({
        steps: [], code: res.lines, render: render, speed: speed,
        onEnd: function () {
          var st = document.getElementById("status");
          if (st && st.textContent && st.textContent.indexOf("播放完成") < 0) {
            st.textContent += "　✅ 播放完成（按 R 或点重置可重新观看）";
          }
        },
      });
      bindPlayer(player);
      window._sortPlayer = player;
    }
    player.code = res.lines;
    player.setSteps(res.steps);
    status.textContent = "已生成 " + res.steps.length + " 步动画，点击 ▶ 播放";
    if (stepComment) {
      stepComment.textContent = "点击播放按钮开始动画演示";
      stepComment.classList.add("visible");
    }
  }

  run(false);

  const btnRandom = document.getElementById("btn-random");
  if (btnRandom && opts.withRandom) {
    btnRandom.addEventListener("click", function () { run(true); });
  }
}
