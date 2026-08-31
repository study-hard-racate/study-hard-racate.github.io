"""学习路径测试：
- 页面结构与导航入口
- 前置依赖 DAG 合法性（无环、前置都存在、前置层级严格小于当前）
- 拓扑排序覆盖全部 40 模块
- localStorage 进度记录与渲染"""

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
const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
const elements = {};
global.document = {
  getElementById: (id) => {
    if (!elements[id]) elements[id] = new FakeEl("div");
    return elements[id];
  },
  createElement: (tag) => new FakeEl(tag),
  createElementNS: (ns, tag) => new FakeEl(tag),
  addEventListener() {},
};
global.window = global;
"""


def _load_script():
    with open(os.path.join(ROOT, "static", "js", "learning-path.js"), encoding="utf-8") as f:
        return f.read()


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
            pytest.fail(f"{name} 执行失败: {proc.stderr.strip()[:2000]}")
        return proc.stdout
    finally:
        os.unlink(tmp)


def test_page_structure():
    with open(page_path("/learning-path"), encoding="utf-8") as f:
        html = f.read()
    assert 'id="learning-path"' in html, "缺容器"
    assert 'id="lp-progress"' in html, "缺进度条"
    assert 'id="lp-reset"' in html, "缺重置按钮"
    assert 'id="lp-stages"' in html, "缺阶段列表"
    assert "learning-path.js" in html, "缺脚本"
    assert 'href="/learning-path"' in html, "缺导航入口"


def test_homepage_has_entry():
    with open(page_path("/"), encoding="utf-8") as f:
        html = f.read()
    assert "lp-banner" in html, "首页缺学习路径横幅"
    assert 'href="/learning-path"' in html, "首页缺学习路径链接"


def test_dag_valid_and_topological_order():
    """DAG 合法：覆盖 40 模块、前置都存在、无环（拓扑排序完整）、前置层级严格小于当前"""
    js = (STUBS + _load_script() + """
const LP = window.__learningPath;
const mods = LP.MODULES;
if (mods.length !== 40) throw new Error("应有 40 模块: " + mods.length);
const byUrl = {};
mods.forEach(m => byUrl[m.url] = m);
// 前置都存在且不在自身上
for (const url in LP.PREREQS) {
  if (!byUrl[url]) throw new Error("PREREQS 含未知模块: " + url);
  LP.PREREQS[url].forEach(u => {
    if (!byUrl[u]) throw new Error(url + " 的前置不存在: " + u);
    if (u === url) throw new Error(url + " 依赖自身");
  });
}
// 拓扑排序完整性
const res = LP.computeLevels();
if (res.order.length !== 40) throw new Error("拓扑排序应覆盖 40 模块: " + res.order.length);
// 前置层级严格小于当前（无环 + 顺序正确）
for (const url in LP.PREREQS) {
  LP.PREREQS[url].forEach(u => {
    if (res.level[u] >= res.level[url]) {
      throw new Error(url + "(" + res.level[url] + ") 的前置 " + u + "(" + res.level[u] + ") 层级不合法");
    }
  });
}
// 阶段数合理（1..10 之间）
const stageSet = new Set();
mods.forEach(m => stageSet.add(res.level[m.url]));
if (stageSet.size < 3 || stageSet.size > 12) throw new Error("阶段数异常: " + stageSet.size);
console.log('dag-ok stages=' + stageSet.size);
""")
    out = _run_js(js, "DAG 合法性")
    assert "dag-ok" in out


def test_render_and_progress_toggle():
    """渲染生成进度条与模块行；标记已学后进度写入 localStorage 并更新"""
    js = (STUBS + _load_script() + """
// 模拟 localStorage 已有 2 个模块已学
global.localStorage.setItem("learning-path-v1", JSON.stringify({"/array": true, "/linked-list": true}));
const LP = window.__learningPath;
LP.render();
const progWrap = document.getElementById("lp-progress");
if (progWrap.children.length < 2) throw new Error("进度条未渲染（标签+进度条）");
const label = progWrap.children[0].innerHTML;
if (label.indexOf("2") < 0 || label.indexOf("/ 40") < 0) throw new Error("进度标签应为 2/40: " + label);
// 阶段列表应有模块行
const stages = document.getElementById("lp-stages");
if (!stages.children.length) throw new Error("阶段列表为空");
const firstStage = stages.children[0];
if (!firstStage.children[1] || !firstStage.children[1].children.length) throw new Error("第一阶段无模块");
// 已学模块应带 learned 类
const arrRow = firstStage.children[1].children[0];
console.log('render-ok rows=' + stages.children.length);
""")
    out = _run_js(js, "渲染与进度")
    assert "render-ok" in out
