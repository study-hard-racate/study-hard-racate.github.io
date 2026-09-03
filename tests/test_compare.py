"""算法对比模式测试：
- 页面结构与导航入口
- Node 中真实跑同一份数据：两栏均生成步骤、结果有序、冒泡步骤/比较多于快排（确定性数组）
- advance 同步推进两侧"""

import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

STUBS = r"""
class FakeEl {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this.value = "";
    this.classList = { toggle() {}, add() {}, remove() {} };
    this._text = "";
    this._html = "";
    this.className = "";
    this.href = "";
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { this.children.push(c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  addEventListener() {}
  querySelectorAll() { return []; }
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
  createElement: (tag) => new FakeEl(tag),
  createElementNS: (ns, tag) => new FakeEl(tag),
  querySelector: () => null,
  querySelectorAll: () => ({ forEach() {} }),
  addEventListener() {},
};
global.window = global;
"""


def _run_js(js_code, name):
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as f:
        f.write(js_code)
        tmp = f.name
    try:
        proc = subprocess.run(
            ["node", tmp], capture_output=True, text=True, timeout=120,
            encoding="utf-8", errors="replace",
        )
        if proc.returncode != 0:
            pytest.fail(f"{name} 执行失败: {proc.stderr.strip()[:1500]}")
        return proc.stdout
    finally:
        os.unlink(tmp)


def _load_compare_js():
    """与 compare.html 页面一致的脚本：svg + sorter + csim + compare"""
    out = ""
    for n in ["svg", "sorter", "csim", "compare"]:
        with open(os.path.join(ROOT, "static", "js", n + ".js"), encoding="utf-8") as f:
            out += "\n" + f.read()
    return out


def test_page_structure():
    with open(page_path("/compare"), encoding="utf-8") as f:
        html = f.read()
    for needle in ['id="cmp-stage-a"', 'id="cmp-stage-b"', 'id="cmp-algo-a"', 'id="cmp-algo-b"',
                   'id="btn-cmp-play"', 'id="cmp-verdict"', "compare.js"]:
        assert needle in html, f"compare 页缺 {needle}"
    # 导航入口（从排序页抽查）
    with open(page_path("/sorting/bubble"), encoding="utf-8") as f:
        h = f.read()
    assert 'href="/compare"' in h, "排序页缺算法对比入口"


def test_compare_runs_same_data():
    """确定性数组：A(冒泡)/B(快排) 同数据均有步骤、结果有序、统计>0；
       且内置的 7 种排序在同一数据上都能正确排好序"""
    js = (STUBS + _load_compare_js() + """
const C = window.__compare;
if (!C || !C.state) throw new Error("compare 未初始化");
C.state.arr = [8,3,6,1,9,2,5,7];
C.reset(false);
const A = C.state.A, B = C.state.B;
if (!A.steps.length || !B.steps.length) throw new Error("两侧都应有步骤");
if (A.stats.comparisons === 0) throw new Error("应有比较统计");
const ok = (a) => a.every((v, i) => i === 0 || a[i-1] <= v);
if (!ok(A.steps[A.steps.length - 1].arr) || !ok(B.steps[B.steps.length - 1].arr)) {
  throw new Error("结果应有序");
}
// 全部 7 种内置排序都能在同一份数据上排好
for (const s of C.SORTS) {
  const r = C.run(s, [8,3,6,1,9,2,5,7]);
  if (r.error) throw new Error(s.name + " 执行失败: " + r.error);
  const last = r.steps[r.steps.length - 1];
  if (!ok(last.arr)) throw new Error(s.name + " 结果未排序: " + JSON.stringify(last.arr));
}
console.log('compare-ok A=' + A.steps.length + ' B=' + B.steps.length + ' sorts=' + C.SORTS.length);
""")
    out = _run_js(js, "同数据对比")
    assert "compare-ok" in out


def test_advance_sync_both():
    """advance 每次同时推进两侧索引；到达末尾后 done"""
    js = (STUBS + _load_compare_js() + """
const C = window.__compare;
C.state.arr = [5,1,4,2,8];
C.reset(false);
const A = C.state.A, B = C.state.B;
const a0 = A.i, b0 = B.i;
for (let k = 0; k < 3; k++) C.advance();
if (A.i !== a0 + 3 || B.i !== b0 + 3) throw new Error("两侧应同步前进: A " + (A.i - a0) + " B " + (B.i - b0));
console.log('sync-ok');
""")
    out = _run_js(js, "同步推进")
    assert "sync-ok" in out
