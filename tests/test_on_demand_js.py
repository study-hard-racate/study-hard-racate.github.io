"""JS 按需加载测试：每个模块页只加载自己声明的脚本，在 Node DOM 桩中执行内联 setupDemo，
确保裁剪后无缺失渲染器（ReferenceError）且动画步骤正常生成。"""

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
  scrollIntoView() {}
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


def _page_scripts(path):
    """页面声明的外部脚本名列表（按出现顺序）"""
    with open(page_path(path), encoding="utf-8") as f:
        html = f.read()
    names = re.findall(r'src="/static/js/([a-z0-9-]+)\.js"', html)
    return names


def _load(names):
    out = ""
    for n in names:
        p = os.path.join(ROOT, "static", "js", n + ".js")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                out += "\n" + f.read()
    return out


def _inline(path):
    with open(page_path(path), encoding="utf-8") as f:
        html = f.read()
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    return "\n".join(s for s in scripts if s.strip())


def test_pruned_script_sets_exist():
    """裁剪后引用的脚本文件都必须存在，且 common/player/svg/csim/demo 齐备"""
    for path in ALGO_PAGES:
        names = _page_scripts(path)
        for n in names:
            assert os.path.isfile(os.path.join(ROOT, "static", "js", n + ".js")), f"{path} 引用了不存在的 {n}.js"
        for need in ["common", "player", "svg", "csim", "demo"]:
            assert need in names, f"{path} 裁剪后缺少 {need}.js"


@pytest.mark.parametrize("path", ALGO_PAGES)
def test_page_runs_with_only_its_own_scripts(path):
    """只加载页面声明的脚本（不含多余渲染器）也能跑出动画步骤"""
    names = _page_scripts(path)
    inline = _inline(path)
    js = (STUBS + _load(names) + "\n" + inline + r"""
if (typeof window._sortPlayer === "undefined" || !window._sortPlayer.steps || !window._sortPlayer.steps.length) {
  throw new Error("未生成步骤");
}
console.log('pruned-ok steps=' + window._sortPlayer.steps.length);
""")
    out = _run_js(js, path)
    assert "pruned-ok" in out, f"{path} 按需加载后执行失败"
