/* 生成 sw.js：预缓存清单从站点文件自动枚举 */
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const htmlRoutes = [];
function walk(dir, base) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "site") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, path.join(base, entry.name));
    else if (entry.name === "index.html") {
      htmlRoutes.push("/" + base.split(path.sep).join("/"));
    }
  }
}
walk(ROOT, "");
/* 根目录 index.html 与 404 */
htmlRoutes.push("/", "/404.html");

const assets = [];
for (const f of [
  "static/css/style.css", "static/favicon.svg", "manifest.json",
  "static/icons/icon-192.png", "static/icons/icon-512.png",
]) assets.push("/" + f);
for (const f of fs.readdirSync(path.join(ROOT, "static", "js"))) {
  if (f.endsWith(".js")) assets.push("/static/js/" + f);
}
/* 去重排序 */
const precache = [...new Set([...htmlRoutes, ...assets])].sort();
/* 首页排最前 */
precache.sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : 0));

const list = precache.map((p) => '  "' + p + '"').join(",\n");

const sw = `/* Service Worker：离线缓存
   安装时预缓存全站（${precache.length} 项：所有页面 + 静态资源）；
   页面请求走"网络优先 → 失败回退缓存"（在线自动更新，离线可看）；
   静态资源走"缓存优先 → 未命中再请求"。
   注意：新增/删除页面后需重新生成本文件（node scripts/gen-sw.js）并递增版本号。 */
const CACHE = "dsa-v" + Date.now() + "";

const PRECACHE = [
${list}
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
`;

fs.writeFileSync(path.join(ROOT, "sw.js"), sw, "utf8");
console.log("sw.js written, precache items:", precache.length);
console.log(precache.join("\n"));
