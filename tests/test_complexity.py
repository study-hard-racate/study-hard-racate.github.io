"""算法复杂度对比图表测试：
- index.html 引入 complexity-chart.js 并含容器
- DATA 覆盖全部 40 个模块且 URL 均指向真实页面
- 柱状图 / 雷达图 / 总览表在 DOM 桩中可正常构建"""

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
    with open(os.path.join(ROOT, "static", "js", "complexity-chart.js"), encoding="utf-8") as f:
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


def test_homepage_includes_chart():
    with open(page_path("/"), encoding="utf-8") as f:
        html = f.read()
    assert "complexity-chart.js" in html, "首页缺少 complexity-chart.js"
    assert 'id="complexity-chart"' in html, "首页缺少图表容器"


def test_data_covers_all_modules_and_urls_exist():
    """DATA 应有 40 个模块，且每个 url 对应真实页面文件"""
    js = (STUBS + _load_script() + """
const total = Object.keys(window.__complexity.DATA).reduce((n, k) => n + window.__complexity.DATA[k].length, 0);
if (total !== 40) throw new Error("DATA 应有 40 项，实际 " + total);
const urls = [];
Object.keys(window.__complexity.DATA).forEach(k =>
  window.__complexity.DATA[k].forEach(x => urls.push(x.url)));
console.log("URLS:" + urls.join("|"));
""")
    out = _run_js(js, "数据完整性")
    m = re.search(r"URLS:(.+)$", out, re.M)
    assert m, "未输出 URLS"
    urls = m.group(1).split("|")
    assert len(urls) == 40
    for u in urls:
        rel = u.lstrip("/") + "/index.html"
        assert os.path.isfile(os.path.join(ROOT, rel)), f"URL {u} 对应的页面不存在"


def test_charts_build_in_dom_stub():
    """柱状图（排序类 9 柱）/ 雷达图（≥9 多边形）/ 总览表（排序类 9 行）可构建"""
    js = (STUBS + _load_script() + """
// 柱状图：切到排序类应有 9 个柱（结构：note, chips, bars-wrap）
const barRoot = new FakeEl("div");
window.__complexity.buildBarChart(barRoot, "sorting");
const bars = barRoot.children[2];
if (!bars || bars.children.length !== 9) throw new Error("排序柱状图应有 9 柱: " + (bars && bars.children.length));

// 雷达图：SVG 内应有 9 个淡色算法多边形（结构：note, select, svgWrap, info）
const radRoot = new FakeEl("div");
window.__complexity.buildRadar(radRoot);
const svg = radRoot.children[2].children[0];
let polys = 0;
for (const c of svg.children) if (c.tag === "polygon" && c.attrs["data-url"]) polys++;
if (polys !== 9) throw new Error("雷达图应有 9 个算法多边形: " + polys);

// 总览表：排序类 9 行（结构：chips, table(thead, tbody)）
const tabRoot = new FakeEl("div");
window.__complexity.buildTable(tabRoot, "sorting");
const tbody = tabRoot.children[1].children[1];
if (!tbody || tbody.children.length !== 9) throw new Error("排序总览表应有 9 行: " + (tbody && tbody.children.length));

// 全部柱状图：40 柱
const allRoot = new FakeEl("div");
window.__complexity.buildBarChart(allRoot, null);
const allBars = allRoot.children[2];
if (!allBars || allBars.children.length !== 40) throw new Error("全部柱状图应有 40 柱: " + (allBars && allBars.children.length));
console.log('charts-ok');
""")
    out = _run_js(js, "图表构建")
    assert "charts-ok" in out
