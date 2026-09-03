/* 一次性脚本：模块页 JS 按需加载 —— 按 renderMode 裁剪 <script> 列表 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

/* renderMode → 需要的渲染器（common/player/svg/csim/demo 始终保留） */
const NEEDED = {
  sort: ["sorter"],
  heap: ["sorter"],
  countingsort: ["sorter"],
  radix: ["sorter"],
  stack: ["stackqueue"],
  queue: ["stackqueue"],
  circularqueue: ["stackqueue"],
  list: ["list"],
  doublylist: ["list"],
  tree: ["tree"],
  rbtree: ["tree"],
  unionfind: ["unionfind"],
  graph: ["graph"],
  topological: ["graph"],
  dijkstra: ["graph"],
  prim: ["graph"],
  kruskal: ["graph"],
  floyd: ["graph"],
  hash: ["hash"],
  linear: ["search"],
  binary: ["search"],
  block: ["search"],
  dp01: ["dp"],
  dpcomplete: ["dp"],
  lcs: ["dp"],
  editdistance: ["dp"],
  stairs: ["dp"],
  lis: ["dp"],
  hanoi: ["hanoi"],
  kmp: ["string"],
  trie: ["trie"],
};

const pages = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "site") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name === "index.html" && full !== path.join(ROOT, "index.html")) pages.push(full);
  }
}
walk(ROOT);

let changed = 0, skipped = 0;
for (const file of pages) {
  const html = fs.readFileSync(file, "utf8");
  const m = html.match(/renderMode: "([a-z0-9]+)"/);
  if (!m) { skipped++; continue; }
  const mode = m[1];
  const extras = NEEDED[mode];
  if (!extras) { console.log("NO MAP for mode:", mode, file); skipped++; continue; }
  const tags = ["player", "svg", ...extras, "csim", "demo"];
  const block = tags.map(t => '<script src="/static/js/' + t + '.js"></script>').join("\n");
  const start = html.indexOf('<script src="/static/js/player.js"></script>');
  const endMark = '<script src="/static/js/demo.js"></script>';
  const end = html.indexOf(endMark);
  if (start < 0 || end < 0) { console.log("FAIL pattern:", file); skipped++; continue; }
  const full = start + block.length;
  const replaced = html.slice(0, start) + block + html.slice(end + endMark.length);
  /* 确认只替换了一处且不破坏结构 */
  const count = (replaced.match(/<script src="\/static\/js\/(player|svg|sorter|csim|list|tree|stackqueue|graph|dp|hanoi|string|trie|hash|search|unionfind|common)\.js"><\/script>/g) || []).length;
  fs.writeFileSync(file, replaced, "utf8");
  changed++;
  console.log("OK", path.relative(ROOT, file), "-> mode:", mode, "js:", tags.join(","), "total-scripts:", count);
}
console.log("changed:", changed, "skipped:", skipped);
