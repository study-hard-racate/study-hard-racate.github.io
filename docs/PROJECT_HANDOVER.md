# C 语言数据结构与算法可视化学习网站 —— 项目交接文档

---

## 一、最终目标

一个**面向新手**的 C 语言数据结构与算法可视化学习网站：以「C 代码逐步高亮 + 同步动画」讲解各模块基本实现，全中文界面，固定演示（无自定义代码），部署在 GitHub Pages。

---

## 二、关键背景

| 项 | 内容 |
|---|---|
| 项目类型 | 纯静态站（原 Flask 模板已预渲染）+ 原生 JS + SVG 动画，无前端框架、无外部依赖 |
| 在线地址 | https://study-hard-racate.github.io/ |
| GitHub 仓库 | https://github.com/study-hard-racate/study-hard-racate.github.io |
| 开发目录 | `D:\opencode_demo\dsa-visualizer`（原始源码）或 `D:\deepseek harnes\dsa-visualizer`（当前工作目录，从 GitHub 克隆） |
| 静态站输出 | `D:\opencode_demo\dsa-visualizer\site`（原始）；当前工作目录直接就是部署产物 |
| git 配置 | user: ding-pinjia / 3077767785@qq.com；凭据由 Git Credential Manager 记住；push 偶发网络失败（重试即可）；沙箱环境下无法弹出认证对话框，需手动 push |
| 优化计划书 | `docs/OPTIMIZATION_PLAN.md`（5 阶段 13 周路线图） |

---

## 三、已确认的事实 & 长期偏好

1. **固定演示模式**：每个模块页打开即自动生成动画，无编辑器、无类型校验、无生成按钮
2. **显示 C 代码并高亮同步**：左侧代码面板 + 行高亮跟随（可关闭跟随）
3. **模块清单（28 个页面）**：
   - 列表页：排序算法、查找算法、数据结构、树与图、动态规划
   - 数组、链表、栈、队列、**并查集**
   - 二叉树、BST、树的遍历、**堆/优先队列**、**红黑树**
   - 图 BFS/DFS、**拓扑排序**
   - 排序 7 种：冒泡/选择/插入/快速/归并/希尔/**堆排序**
   - 查找 4 种：线性/二分/哈希/分块
   - **动态规划：0-1背包、完全背包**
4. **数据规模**：排序 8 个元素、树 7 节点、图 6 顶点、并查集 8 元素、DP 背包 4 物品容量 10
5. **查找模块**：随机数据 + 随机目标（🎲 按钮），目标可能命中也可能不命中（含失败路径演示）
6. **颜色约定**：
   - 🟡 黄 = 正在访问 / 比较 / 当前计算
   - 🔴 红 = 写入 / 交换 / 断链重接 / 路径压缩 / 红黑树红色节点
   - 🟢 绿 = 已归位 / 已访问 / 次链 / 根节点 / 已处理
   - 🟣 紫 = 比较节点 / 依赖格 / 依赖方向
   - 青 = 指针 / 普通节点 / 红黑树黑色节点边框
   - 橙虚线 = 游离节点
   - 🔵 蓝 = 已填好（DP）/ 入度为 0（拓扑排序）
   - 🩷 粉 = 初始化阶段（DP）/ 红黑树黑色节点
7. **交互**：▶ 播放 / ⏮⏭ 单步 / 速度滑块（200-2200ms 连续调节）/ 快捷键 Space、←→、R、?、T / **进度条拖拽跳转**
8. **UI 方向**：深色主题 + 浅色主题（☀️/🌙 切换）、渐变背景、毛玻璃顶栏、新手教程（首页 guide 区 + 每页提示条）、每模块定制图例、favicon、导航当前页高亮
9. **需求确认习惯**：用户明确要求「先问清楚问题，90% 把握再执行」
10. **图用邻接表**（链址法），哈希用**链地址法**，树只留基础，图只留遍历
11. **并查集实现**：数组实现（`int parent[]`, `int rank_[]`），find 带路径压缩，unionByRank 按秩合并，csim.js 不支持全局变量所以数组必须在 `main()` 内声明并通过参数传递
12. **列表页模式**：排序算法、查找算法、数据结构、树与图、动态规划均有独立列表页，导航栏点击父菜单跳转列表页，下拉菜单可直接跳转子页面
13. **堆排序渲染**：使用 `renderMode: "heap"`，专用 `renderHeapSort` 函数，上方柱状图 + 下方堆树形结构同步高亮
14. **拓扑排序渲染**：使用 `renderMode: "topological"`，专用 `renderTopological` 函数，显示入度标签 + 结果序列
15. **红黑树渲染**：使用 `renderMode: "rbtree"`，csim.js 扩展捕获 `color` 字段，tree.js 支持 `rbColors` 参数 + 自动读取 `snap.nodes.color`

---

## 四、硬性规则

| # | 规则 | 原因 |
|---|---|---|
| 1 | 部署前必须 `python -m pytest tests/ -q` 全绿（当前 159 个）+ 本地服务器验证 + 用户确认 | 测试依赖核心引擎 |
| 2 | `freeze.py` 前必须备份 `site/.git`（deploy.py 已自动处理） | freeze 会 `shutil.rmtree(site)` 删除整个目录 |
| 3 | deploy.py 备份目录在项目内同盘（`_site_git_backup_<pid>`） | 避免 Windows 跨盘 `shutil.move` 失败（WinError 17） |
| 4 | push 命令在 `site` 目录执行（workdir=site） | site 是独立 git 仓库 |
| 5 | 不随意改 csim.js 核心执行语义 | 159 个测试依赖 |
| 6 | 上线后必须 curl 验证线上各页 200 | 确认部署成功 |
| 7 | 加页面必须同步更新 `freeze.py` 的 ROUTES 表 | 否则静态站缺页 |
| 8 | 加页面必须同步更新 `base.html` 的导航栏 | 否则用户找不到新页面 |
| 9 | 加页面必须同步更新 `index.html` 的首页卡片 | 否则首页入口缺失 |
| 10 | csim.js 不支持全局变量，数组必须在 `main()` 内声明并作为参数传递 | 引擎解析限制 |
| 11 | DP 页面 C 代码必须声明 `phase` 和 `prev_w` 变量 | 渲染器依赖这些变量识别阶段和依赖关系 |
| 12 | demo.js 中 `step.dp` 判断必须在 `step.uf` 之前 | csim.js 的 prevParent 机制会对所有数组模式代码触发 uf 检测 |
| 13 | demo.js 中 `step.uf` 判断必须加 `renderMode === "unionfind"` 条件 | 防止非并查集页面误走 unionfind 渲染器 |
| 14 | 新建页面的 HTML 中按钮 ID 必须用 `btn-play`/`btn-next`/`btn-prev`/`btn-reset`（不是 `play`/`next`/`prev`/`reset`） | player.js 的 bindPlayer 期望这些 ID |
| 15 | 新建页面的动画舞台 div ID 必须用 `id="stage"`（不是 `id="anim-stage"`） | demo.js 的 setupDemo 用 `getElementById("stage")` |
| 16 | 新建页面的 renderMode 必须与 demo.js 中的判断条件匹配 | 例如拓扑排序必须用 `"topological"` 而非 `"graph"` |

---

## 五、输出格式约定

- 各页面统一使用 `_code_panel.html`（只读代码面板 + 行号 + 跟随开关 + 折叠按钮）
- `_player.html`：播放控制条（含速度滑块 + 快捷键提示 + **进度条**）
- `_demo_panel.html`：动画面板（提示条 + 舞台 + 图例 + 状态 + **统计面板** + 步骤注释）
- `_complexity.html`：算法复杂度卡片（时间/空间复杂度表格）
- 所有页面继承 `base.html`（导航 + 页脚 + 毛玻璃顶栏 + 主题切换 + 快捷键浮层）
- 代码面板高度锁定：`.algo-layout { height: calc(100vh - 190px) }`，代码与动画永不分离
- 列表页模板：`sorting.html`、`search.html`、`data_structure.html`、`tree_graph.html`、`dp.html`

---

## 六、已经完成的工作

### 核心引擎
- **csim.js**（~2270 行）：C 子集解释器，4 种模式自动判定——array / list / tree / graph；支持结构体数组字段（MinStack 等）、`obj->top++`、`INT_MIN/MAX`、`free()`、`#define` 跳过；快照含 ids/data/ptrs/edges/side/cmpIds/markNode/minStack 等；**并查集扩展**：`prevParent` 字段 + `ufSnapshot()` 方法；**DP 扩展**：`dpSnapshot()` 方法；**红黑树扩展**：`treeSnapshot()` 捕获 `color` 字段
- **demo.js**：固定演示初始化（`setupDemo({sample, renderMode, withRandom, randomize, speed})`），renderMode 支持 sort/**heap**/stack/queue/list/tree/graph/hash/linear/binary/block/unionfind/**dp01/dpcomplete**/**topological**/**rbtree**；步骤注释生成函数 `generateStepComment(step, renderMode)` 根据操作类型自动生成中文注释（含 DP 阶段识别、拓扑排序、红黑树）；render 函数中 `step.dp` 优先于 `step.uf` 判断，`step.uf` 需 `renderMode === "unionfind"` 条件；**执行统计面板**：在 run() 中预计算比较/交换/访问/写入次数
- **player.js**：播放器（onEnd 回调、跟随开关、代码内容变化时重建 DOM、代码面板折叠、拖拽调整宽度、速度滑块事件）；**goToStep(i) 方法**支持进度条拖拽跳转
- **svg.js**：SVG 持久化渲染引擎（key 复用 + 增量更新）
- **common.js**：公共功能提取（导航高亮、主题切换、快捷键浮层、下拉菜单键盘可访问、ARIA 增强）

### 渲染器
| 文件 | 功能 |
|---|---|
| sorter.js | 排序动画渲染 |
| list.js | 链表（指针标签/游离/真实边方向/次链/Mark 高亮） |
| tree.js | 树形图渲染（支持红黑树 rbColors 参数 + snap.nodes.color 自动着色） |
| graph.js | 图（圆形布局 + visited 着色，动态 viewBox）+ **拓扑排序渲染器 renderTopological** |
| stackqueue.js | 数组栈/队列渲染 |
| search.js | 线性/二分/分块（含 lo/hi/mid 标签） |
| hash.js | 哈希表槽 + 冲突链 |
| unionfind.js | 并查集渲染器：parent 数组 + 森林树形图 + 路径压缩高亮 |
| dp.js | DP 渲染器：一维滚动数组表格 + 依赖高亮（紫色箭头）+ 阶段标签 + 物品处理标记 + 状态转移公式 + 图例 |

### 各模块演示内容
| 模块 | 演示内容 |
|---|---|
| 数组 | 查找 → 删除 → 插入 |
| 链表 | 尾插建链 → 删除 → 反转（红色曲线指回） |
| 栈 | 数组栈 push×3 + pop（竖直 + top 指针） |
| 队列 | enqueue×3 + dequeue（front/rear） |
| 并查集 | 8 元素，union×7 + find×2（路径压缩），数组实现 |
| 二叉树 | BST 插入 7 节点 |
| BST | 查找目标值 |
| 遍历 | 先/中/后序 |
| 堆/优先队列 | 最大堆插入上浮 + 删除最大值下沉 |
| **红黑树** | **7 节点构建演示：根黑子红，展示红黑树性质** |
| 图 BFS/DFS | 6 顶点，visited 绿色扩散 |
| **拓扑排序** | **6 顶点 DAG（课程先修关系），Kahn 算法，入度标签 + 结果序列** |
| 排序 | 7 种（冒泡/选择/插入/快速/归并/希尔/堆排序）+ 随机（🎲） |
| 查找 | 4 种 + 随机数据 + 随机目标（可能未命中） |
| **堆排序** | **柱状图 + 堆树形结构同步高亮，renderMode: "heap"** |
| 0-1 背包 | 4 物品容量 10，phase 变量区分初始化/DP填表/完成，依赖高亮，状态转移公式 |
| 完全背包 | 4 物品容量 10，正序遍历容量（允许重复选择） |

### 列表页
| 列表页 | 路由 | 子页面 |
|---|---|---|
| 排序算法 | /sorting | 冒泡/选择/插入/快速/归并/希尔/堆排序 |
| 查找算法 | /search | 线性/二分/哈希/分块 |
| 数据结构 | /data-structure | 数组/链表/栈/队列/并查集 |
| 树与图 | /tree-graph | 二叉树/BST/遍历/堆/红黑树/图BFS/DFS/拓扑排序 |
| 动态规划 | /dp | 0-1背包/完全背包 |

### UI 功能
| 功能 | 实现 |
|---|---|
| 移动端适配 | 3 个断点（960px/768px/480px）+ 触摸设备 44px 最小触控区 |
| 代码面板折叠 | 代码标题栏 ◀/▶ 按钮，点击隐藏/展开代码区域 |
| 速度滑块 | 200-2200ms 连续调节，渐变轨道 + 缩放动画 |
| 深色/浅色主题 | 顶栏 ☀️/🌙 按钮，按 T 快捷键切换，localStorage 保存偏好 |
| 快捷键提示浮层 | 按 ? 显示完整快捷键列表，按 Esc 关闭 |
| 步骤注释 | status 下方显示操作说明（比较/交换/写入/访问等，含 DP/拓扑/红黑树阶段识别） |
| 浅色主题 SVG 适配 | 动画元素颜色全面覆盖，含 DP 箭头/哈希标签/红黑树节点 |
| **步骤进度条** | **拖拽跳转到任意步骤，播放时自动同步** |
| **执行统计面板** | **显示比较/交换/访问/写入次数** |
| **拖拽手柄** | **竖线纹理指示器 + 悬停缩放动画** |
| **浅色主题代码高亮** | **WCAG AA 对比度：关键字紫色 #7c3aed、字符串蓝色 #1d4ed8** |
| **键盘焦点样式** | **:focus-visible 全局规则 + 按钮/链接增强** |
| **SVG 动画性能** | **精确选择器替代通配符，减少 transition 属性** |
| **减少动画支持** | **@media (prefers-reduced-motion: reduce) 禁用过渡** |
| **SEO** | **29 页面均有 meta description + 统一标题格式** |
| **无障碍** | **ARIA 标签 + 键盘可访问下拉菜单 + role="dialog"** |
| **公共 JS 提取** | **common.js 替代 28 页面内联 JS，减少 ~2100 行重复** |

### 算法复杂度卡片
- **全部 27 个模块页面**已添加复杂度卡片

### 部署
- **deploy.py**：一键部署（备份 .git → freeze → push），已验证工作
- **freeze.py**：预渲染所有路由为静态 HTML（含 404）

### 测试
- 159 个 pytest 全绿（路由 200、播放器/代码面板存在、JS 语法、Node 真实执行、SVG 渲染引擎、csim 仿真器、渲染器单测）

### 优化计划
- `docs/OPTIMIZATION_PLAN.md`：5 阶段 13 周路线图

---

## 七、重要决策及理由

| 决策 | 理由 |
|---|---|
| 用 csim 跑固定示例（而非手写步骤生成器） | 复用引擎，消息/行号/高亮自动，159 个测试覆盖 |
| 树/图/链表模式自动判定 | `left/right` → tree；`GNode* adj[N]` → graph；`next` → list |
| 删除自定义代码模块 | 用户明确要求面向新手简化 |
| 查找随机化走页面端 randomize 回调 | demo.js `opts.randomize` 返回新代码字符串，csim 引擎不动 |
| GitHub Pages 静态化 | `<用户名>.github.io` 根路径托管，freeze.py 预渲染 |
| 一屏内布局 | `.algo-layout` 高度 `calc(100vh - 190px)`，代码/动画永不分离 |
| deploy.py 备份目录用 pid + 项目内同盘 | 避免多次部署冲突 + Windows 跨盘失败 |
| listSnapshot 多候选链主链选择 | 最长 > 外层 > 指针变量 > 非成员（保证建树期主链稳定） |
| graphSnapshot 收集所有可见节点 edges | 反转/头插时红色反向曲线正确显示 |
| MinStack 自动识别 | 快照扫描 scope 找含数组字段 + top 的节点 → 以数组栈渲染 |
| 步骤注释在 demo.js 生成而非 csim.js | 不修改 csim.js 核心语义，保持 159 个测试稳定 |
| 浅色主题动画区域保持深色 SVG 元素覆盖 | 动画数字/指针颜色在浅色背景下需高对比度 |
| 速度控制从 select 改为 range 滑块 | 用户体验更流畅，可连续调节 |
| 代码面板折叠不改变布局结构 | 只是 flex: 0 0 44px 收缩，不影响其他元素 |
| localStorage 用 try-catch 包裹 | Node.js 测试环境无 localStorage，避免测试失败 |
| 并查集用数组实现而非结构体 | 更直观，符合 csim 的 array 模式，可视化简单 |
| 并查集数组放 main() 内通过参数传递 | csim.js 不支持全局变量声明 |
| 并查集路径压缩追踪用 prevParent 比较 | 不修改 csim.js 核心执行语义，只在 pushStep 中添加检测分支 |
| 并查集渲染器无根节点时平铺节点 | 初始化时 parent 随机值导致无根节点，所有 pos=[0,0] 重叠，viewBox 极度扁平不可见 |
| DP 用 phase 变量区分阶段 | 渲染器需要知道当前是初始化/DP填表/完成阶段，以便显示不同提示 |
| DP 用 prev_w 变量记录依赖 | 渲染器需要知道 dp[j-w[i]] 的位置，以便高亮依赖单元格和画箭头 |
| DP step.dp 判断在 step.uf 之前 | csim.js 的 prevParent 机制会对所有数组模式代码触发 uf 检测，必须优先判断 dp |
| DP step.uf 加 renderMode 条件 | 防止非并查集页面误走 unionfind 渲染器 |
| DP dpSnapshot 显式收集 this.main | collectVars 不会收集 this.main 数组（DP 中为 w[]），需单独处理 |
| 列表页与导航栏下拉菜单并存 | 用户要求点击父菜单跳转列表页，下拉菜单仍可直接跳转子页面 |
| csim.js treeSnapshot 捕获 color 字段 | 红黑树需要颜色信息，3 行改动最小侵入 |
| tree.js renderTreeCsim 接受 rbColors 参数 | 支持红黑树着色，同时保持向后兼容 |
| 堆排序用 renderMode: "heap" 而非 "sort" | 需要专用渲染器显示树形结构 |
| 拓扑排序用 renderMode: "topological" 而非 "graph" | demo.js 检查特定模式名来路由到专用渲染器 |
| 按钮 ID 必须用 btn-play 等 | player.js bindPlayer 用 getElementById 查找 |
| 动画舞台 ID 必须用 "stage" | demo.js setupDemo 用 getElementById("stage") |
| 进度条用 goToStep 方法 | 支持拖拽跳转，不中断播放状态 |
| 统计面板在 run() 中预计算 | 一次遍历所有步骤，避免每步重复计算 |

---

## 八、被否定的方案

| 方案 | 否定原因 |
|---|---|
| 手写 JS 步骤生成器 | 选 csim 引擎复用 |
| 合并模块页 | 保留现有首页/导航结构 |
| 纯动画无代码 | 用户要代码+高亮 |
| 排序只留 3 个基础 | 用户要全部 7 种 |
| 图用邻接矩阵 | 用户选链址法 |
| 哈希开放寻址 | 用户选链地址法 |
| 只演示查找成功 | 用户要含失败路径 |
| PythonAnywhere 部署 | 配额满 |
| 独立的"自定义代码"页 | 用户要求彻底删除 |
| 排序页保留"算法入口"模型 | 改为直接执行 main |
| 浅色主题 SVG 用深色背景 | 用户要求浅色主题就要浅色背景 |
| 步骤注释修改 csim.js | 不改核心语义，保持测试稳定 |
| 并查集用结构体实现 | 数组实现更直观，csim 支持更好 |
| 并查集数组放全局作用域 | csim.js 不支持全局变量 |
| 并查集路径压缩追踪修改 csim 执行逻辑 | 用 prevParent 比较方式，不改核心语义 |
| DP 渲染器不用 phase/prev_w 变量 | 渲染器需要阶段信息和依赖位置，C 代码中声明变量是最小侵入方案 |
| 红黑树用 colors 数组传递颜色 | csim.js 不支持全局变量，数组索引与 node._id 不对应 |
| 红黑树实现完整旋转 | csim.js 指针操作有限制，简化为手动构建演示 |

---

## 九、当前进度

- **最新 commit**：`f611ed7`（浅色主题 SVG 修复 + prefers-reduced-motion）
- **总提交数**：21 次
- **模块页面**：28 个（首页 + 5 个列表页 + 22 个模块页）
- **测试**：159 个 pytest 全绿
- **线上版本**：最新代码已推送到 GitHub（需手动 push）

### 已上线功能清单

| 类别 | 内容 |
|---|---|
| 基础模块 | 数组/链表/栈/队列/并查集/二叉树/BST/遍历/堆/红黑树/图BFS·DFS/拓扑排序/7排序/4查找/2DP |
| 体验增强 | 移动端适配/代码面板折叠/速度滑块/深色浅色主题/快捷键浮层/步骤注释 |
| 内容扩展 | 算法复杂度卡片（全部模块）、堆/优先队列、并查集、红黑树、堆排序、拓扑排序、DP模块 |
| 导航优化 | 5 个列表页，导航栏点击父菜单跳转列表页 |
| **第一阶段优化** | **步骤进度条、执行统计面板、浅色主题 SVG 修复、prefers-reduced-motion** |

---

## 十、尚未完成的任务

### 第二阶段（新算法模块，~6 周）
| 模块 | 难度 | 说明 |
|---|---|---|
| LCS 最长公共子序列 | ⭐⭐⭐ | 2D DP，扩展 dp.js |
| 编辑距离 | ⭐⭐⭐ | 2D DP，3 种操作 |
| LIS 最长递增子序列 | ⭐⭐⭐ | 1D DP + 二分 |
| 爬楼梯 | ⭐ | 入门级 DP |
| Dijkstra 最短路径 | ⭐⭐⭐⭐ | 图模式 + 距离数组 |
| Prim MST | ⭐⭐⭐⭐ | 图模式 + 边权重 |
| Kruskal MST | ⭐⭐⭐ | 边排序 + 并查集 |
| Floyd-Warshall | ⭐⭐⭐ | 2D 距离矩阵 |
| 双向链表 | ⭐⭐ | 扩展 list.js |
| 循环队列 | ⭐⭐ | 扩展 stackqueue.js |
| Trie 字典树 | ⭐⭐⭐ | 新建 trie.js |
| 计数排序 | ⭐ | 复用 sorter.js |
| 基数排序 | ⭐⭐ | 扩展 sorter.js |
| KMP 字符串匹配 | ⭐⭐⭐ | 新建 string.js |
| 汉诺塔 | ⭐⭐ | 新建 hanoi.js |

### 第三阶段（交互升级，~2 周）
- 算法对比模式（并排播放）
- 自定义代码编辑器（textarea + 运行）
- 步骤详解模式

### 第四阶段（学习体验，~2 周）
- 学习路径（推荐顺序 + 进度记录）
- 练习题系统
- 算法复杂度对比图表

### 第五阶段（技术优化，~1 周）
- PWA 支持（离线缓存）
- 性能优化（JS 按需加载）
- 英文版本

### 可选 UI 优化
- 移动端进一步适配
- 速度滑块美化

---

## 十一、不能随意修改的内容

| 内容 | 原因 |
|---|---|
| csim.js 的执行/快照语义 | 159 个测试依赖 |
| csim.js 的 pushStep 中 mode 分支（list/tree/graph） | 其他模块测试依赖 |
| csim.js 的 dpSnapshot 方法 | DP 渲染器依赖 |
| csim.js 的 treeSnapshot 方法中的 color 字段捕获 | 红黑树渲染依赖 |
| 各页面 `setupDemo` 调用结构与 renderMode | 整个演示框架依赖 |
| 颜色约定与图例文案 | 新手一致性 |
| 一屏布局 CSS（`.algo-layout` 高度锁定） | 代码/动画分离会破体验 |
| 内置示例代码的数据结构语义 | 引擎按字段自动判定模式 |
| freeze.py 的 ROUTES 表 | 加页面必须同步加 |
| base.html 的导航栏结构 | 加页面必须同步加 |
| index.html 的首页卡片结构 | 加页面必须同步加 |
| list.js 主链选择优先级算法 | 建树期主链稳定性 |
| tree.js 的 renderTreeCsim | 被 tree/bst/traversal/heap/rbtree 五页依赖 |
| `_code_panel.html` 的"跟随高亮"开关 | 用户可选关闭跟随 |
| demo.js 的 generateStepComment 函数 | 步骤注释生成逻辑 |
| demo.js 的 render 函数中 step.dp 判断在 step.uf 之前 | DP 渲染依赖此顺序 |
| demo.js 的 render 函数中 step.uf 需 renderMode === "unionfind" 条件 | 防止非并查集页面误触发 |
| 浅色主题 CSS 覆盖规则（body.light .anim-stage svg ...） | 动画颜色适配 |
| unionfind.js 的无根节点平铺逻辑 | 初始化随机值时防止内容不可见 |
| dp.js 渲染器的颜色约定和图例 | DP 可视化一致性 |
| DP 页面 C 代码中的 phase/prev_w 变量 | 渲染器依赖这些变量 |
| player.js 的 goToStep 方法 | 进度条拖拽跳转依赖 |
| player.js 的 bindPlayer 期望 btn-play 等 ID | 所有页面按钮 ID 必须匹配 |
| demo.js setupDemo 用 getElementById("stage") | 所有页面动画舞台 ID 必须为 "stage" |
| demo.js 中 renderMode === "topological" 检查 | 拓扑排序专用渲染器路由 |
| demo.js 中 renderMode === "rbtree" 检查 | 红黑树专用渲染器路由 |
| demo.js 中 renderMode === "heap" 检查 | 堆排序专用渲染器路由 |
| common.js 中的下拉菜单键盘操作逻辑 | 无障碍功能 |
| common.js 中的 ARIA 标签增强 | 无障碍功能 |

---

## 十二、新会话接下来应该先做什么

### 如果用户无新需求
1. 按 `docs/OPTIMIZATION_PLAN.md` 第二阶段实施新算法模块
2. 优先添加 **LCS / 编辑距离**（扩展 dp.js 即可，工期短）
3. 然后添加 **Dijkstra 最短路径**（最常用的图算法）

### 如果用户报 bug
1. 先本地复现（`python -m http.server 8080` + 浏览器）
2. 检查浏览器控制台错误
3. 修复后 `python -m pytest tests/ -q` + 上线

### 如果用户提新模块/优化
1. **先提问确认需求**（清单、形态、交互、数据规模、渲染偏好），90% 把握再动手
2. 走「测试全绿 → 本地验证 → 用户确认 → 上线」流程

### 常用命令
- `python -m http.server 8080`（本地启动 → http://127.0.0.1:8080）
- `python -m pytest tests/ -q`（全量测试，当前 159）
- `python freeze.py`（仅生成 site/，不推送）
- 部署：`python deploy.py`（自动备份 .git → freeze → commit → push）
- 快捷推送：`cd dsa-visualizer && git add -A && git commit -m "msg" && git push origin main`

### 新建页面的检查清单
1. [ ] 按钮 ID 使用 `btn-play`/`btn-next`/`btn-prev`/`btn-reset`
2. [ ] 动画舞台 ID 使用 `id="stage"`
3. [ ] renderMode 与 demo.js 中的判断条件匹配
4. [ ] 导航栏添加新链接（所有 32+ 个页面）
5. [ ] 首页卡片添加条目
6. [ ] 对应列表页添加卡片
7. [ ] 添加复杂度卡片
8. [ ] 添加 `step-stats` 和 `step-comment` 容器
9. [ ] 添加 `step-progress` 进度条
10. [ ] 测试全绿 + 本地验证

---

**文档生成时间**：2026-08-19 | **测试状态**：159 passed | **最新 commit**：f611ed7 | **模块数量**：28 个页面
