/* Service Worker：离线缓存
   安装时预缓存全站（73 项：所有页面 + 静态资源）；
   页面请求走"网络优先 → 失败回退缓存"（在线自动更新，离线可看）；
   静态资源走"缓存优先 → 未命中再请求"。
   注意：新增/删除页面后需重新生成本文件（node scripts/gen-sw.js）并递增版本号。 */
const CACHE = "dsa-v" + Date.now() + "";

const PRECACHE = [
  "/",
  "/404.html",
  "/array",
  "/circular-queue",
  "/classic",
  "/classic/hanoi",
  "/classic/kmp",
  "/data-structure",
  "/doubly-linked-list",
  "/dp",
  "/dp/01-knapsack",
  "/dp/complete-knapsack",
  "/dp/edit-distance",
  "/dp/lcs",
  "/dp/lis",
  "/dp/stairs",
  "/graph/bfs-dfs",
  "/graph/dijkstra",
  "/graph/floyd",
  "/graph/kruskal",
  "/graph/prim",
  "/graph/topological",
  "/learning-path",
  "/linked-list",
  "/manifest.json",
  "/queue",
  "/search",
  "/search/binary",
  "/search/block",
  "/search/hash",
  "/search/linear",
  "/sorting",
  "/sorting/bubble",
  "/sorting/counting",
  "/sorting/heap",
  "/sorting/insertion",
  "/sorting/merge",
  "/sorting/quick",
  "/sorting/radix",
  "/sorting/selection",
  "/sorting/shell",
  "/stack",
  "/static/css/style.css",
  "/static/favicon.svg",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/js/common.js",
  "/static/js/complexity-chart.js",
  "/static/js/csim.js",
  "/static/js/demo.js",
  "/static/js/dp.js",
  "/static/js/graph.js",
  "/static/js/hanoi.js",
  "/static/js/hash.js",
  "/static/js/learning-path.js",
  "/static/js/list.js",
  "/static/js/player.js",
  "/static/js/search.js",
  "/static/js/sorter.js",
  "/static/js/stackqueue.js",
  "/static/js/string.js",
  "/static/js/svg.js",
  "/static/js/tree.js",
  "/static/js/trie.js",
  "/static/js/unionfind.js",
  "/tree-graph",
  "/tree/binary-tree",
  "/tree/bst",
  "/tree/heap",
  "/tree/rbtree",
  "/tree/traversal",
  "/tree/union-find",
  "/trie"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((m) => m || caches.match("/"))
        )
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((m) =>
      m || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
    )
  );
});
