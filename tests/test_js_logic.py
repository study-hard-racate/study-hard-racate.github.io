"""功能级 JS 测试：在 Node 中用 DOM 桩执行每个页面的内联脚本，
验证步骤生成逻辑正确（排序页最后一步数组已有序、行号合法等）。"""

import os
import re
import subprocess
import tempfile

import pytest

from conftest import ALGO_PAGES, ROOT, page_path

STUBS = r"""
class FakeEl {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = {};
    this.dataset = {};
    this.style = {};
    this.value = "";
    this.classList = { toggle() {}, add() {}, remove() {} };
    this._text = "";
    this._html = "";
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  addEventListener() {}
  querySelectorAll() { return { forEach() {} }; }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); this.children = []; }
}
const elements = {};
global.document = {
  getElementById: (id) => {
    if (!elements[id]) elements[id] = new FakeEl("div");
    return elements[id];
  },
  createElementNS: (ns, tag) => new FakeEl(tag),
  addEventListener() {},
};
global.window = global;
"""

VERIFY = r"""
if (typeof window._sortPlayer !== "undefined") {
  const p = window._sortPlayer;
  if (!p.steps || p.steps.length < 3) throw new Error("排序步骤太少: " + (p.steps && p.steps.length));
  const last = p.steps[p.steps.length - 1];
  if (last.arr && !last.tree && !last.list && window.__checkSorted) {
    const sorted = last.arr.every((v, i) => i === 0 || last.arr[i - 1] <= v);
    if (!sorted) throw new Error("排序结果不正确: " + JSON.stringify(last.arr));
  }
  for (const s of p.steps) {
    if (s.line !== -1 && (s.line < 1 || s.line > p.code.length)) {
      throw new Error("非法行号: " + s.line + " (代码共 " + p.code.length + " 行)");
    }
  }
  __result = "sort-ok steps=" + p.steps.length;
} else if (typeof player !== "undefined" && player.steps && player.steps.length) {
  const p = player;
  if (p.steps.length < 5) throw new Error("步骤太少: " + p.steps.length);
  for (const s of p.steps) {
    if (s.line !== -1 && (s.line < 1 || s.line > p.code.length)) {
      throw new Error("非法行号: " + s.line);
    }
  }
  __result = "player-ok steps=" + p.steps.length;
} else {
  throw new Error("未找到播放器实例或步骤");
}
console.log(__result);
"""


def _run_js(js_code, name):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(js_code)
        tmp = f.name
    try:
        proc = subprocess.run(
            ["node", tmp],
            capture_output=True, text=True, timeout=120,
            encoding="utf-8", errors="replace",
        )
        if proc.returncode != 0:
            pytest.fail(f"{name} 执行失败: {proc.stderr.strip()[:2000]}")
        return proc.stdout
    finally:
        os.unlink(tmp)


def _load_js_files():
    """按页面加载顺序拼接全部渲染器 JS（与线上页面 <script> 顺序一致）"""
    out = ""
    for fn in ["player.js", "svg.js", "sorter.js", "csim.js", "list.js", "tree.js",
               "stackqueue.js", "graph.js", "hash.js", "search.js", "unionfind.js",
               "dp.js", "hanoi.js", "string.js", "trie.js", "demo.js"]:
        p = os.path.join(ROOT, "static", "js", fn)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                out += "\n" + f.read()
    return out


@pytest.mark.parametrize("path", ALGO_PAGES)
def test_page_js_logic_runs(path):
    """每个模块页的内联 setupDemo 代码能在 Node DOM 桩中真实生成步骤"""
    with open(page_path(path), encoding="utf-8") as f:
        html = f.read()
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    inline = "\n".join(s for s in scripts if s.strip())
    result = _run_js(
        STUBS + "window.__checkSorted = " +
        ("true" if (path.startswith("/sorting") and "countingsort" not in inline) else "false") + ";\n"
        + _load_js_files() + "\n" + inline + "\n" + VERIFY, path)
    assert "ok" in result, f"{path} 验证失败: {result}"


def test_svg_engine_reuses_elements():
    """渲染引擎应复用已存在的元素，只更新变化的属性，并清理消失的元素"""
    with open(os.path.join(ROOT, "static", "js", "svg.js"), encoding="utf-8") as f:
        svg_js = f.read()
    code = r"""
const stage = document.getElementById("stage");
renderSVG(stage, "0 0 100 100", [
  rect("a", 0, 0, 10, 10, { fill: "red" }),
  text("t", 5, 5, "hi", { fill: "#fff" }),
]);
const svg = stage.__svg;
const first = svg.__specs["a"];
if (svg.children.length !== 2) throw new Error("首次渲染元素数错误: " + svg.children.length);

renderSVG(stage, "0 0 100 100", [
  rect("a", 5, 5, 20, 20, { fill: "blue" }),
  rect("b", 0, 0, 5, 5, {}),
]);
if (svg.__specs["a"] !== first) throw new Error("元素 a 未被复用");
if (first.getAttribute("width") !== "20") throw new Error("width 未更新: " + first.getAttribute("width"));
if (first.getAttribute("fill") !== "blue") throw new Error("fill 未更新");
if (svg.children.length !== 2) throw new Error("渲染后元素数错误: " + svg.children.length);
if (svg.__specs["t"]) throw new Error("text 元素未被删除");
if (!svg.__specs["b"]) throw new Error("rect b 未创建");
console.log("svg-engine-ok");
"""
    result = _run_js(STUBS + svg_js + "\n" + code, "svg.js 引擎")
    assert "svg-engine-ok" in result, result
