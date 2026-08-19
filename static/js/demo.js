/* 固定演示页初始化：用 csim 引擎跑内置示例代码，生成步骤交给播放器与对应渲染器。
   页面用法：setupDemo({ sample, renderMode, withRandom, speed })
   renderMode: "sort"（排序数组）| "array"（通用数组）| "stack"（竖直数组栈）
               | "queue"（数组队列）| "list"（链表）| "tree"（树形图）| "graph"（图） */

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
  
  return msg || "";
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
    
    if (step.tree) { renderTreeCsim(stage, step.tree); return; }
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
      renderGraphCsim(stage, step.graph);
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
