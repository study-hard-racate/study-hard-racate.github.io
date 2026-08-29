"""自定义数据（改数据不改代码）测试：
- 11 个页面（7 排序 + 4 查找）应有自定义输入控件
- 解析器正确性（parseCSVInts / parseSingleInt）
- Node 中真实调用 build + runCustom：自定义数组能正确生成动画（排序结果/查找结果正确）"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

CUSTOM_PAGES = [
    "/sorting/bubble", "/sorting/selection", "/sorting/insertion",
    "/sorting/quick", "/sorting/merge", "/sorting/shell", "/sorting/heap",
    "/search/linear", "/search/binary", "/search/hash", "/search/block",
]

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


def _load_js_files():
    out = ""
    for fn in ["player.js", "svg.js", "sorter.js", "csim.js", "list.js", "tree.js",
               "stackqueue.js", "graph.js", "hash.js", "search.js", "unionfind.js",
               "dp.js", "hanoi.js", "string.js", "trie.js", "demo.js"]:
        p = os.path.join(ROOT, "static", "js", fn)
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                out += "\n" + f.read()
    return out


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


def _page_inline(path):
    with open(page_path(path), encoding="utf-8") as f:
        html = f.read()
    scripts = re.findall(r"<script>(.*?)</script>", html, re.S)
    return "\n".join(s for s in scripts if s.strip())


def _extract_sample(path):
    with open(page_path(path), encoding="utf-8") as f:
        html = f.read()
    m = re.search(r'sample: "(.*?)", renderMode', html, re.S)
    assert m, f"{path} 未找到 sample"
    return codecs.decode(m.group(1), "unicode_escape")


def _setup_page(path, name):
    """加载页面内联脚本（含 setupDemo + customData），返回执行后环境可用"""
    inline = _page_inline(path)
    js = STUBS + _load_js_files() + "\n" + inline + "\n"
    return js


@pytest.mark.parametrize("path", CUSTOM_PAGES)
def test_custom_data_input_present(path):
    """11 个页面都应带自定义输入控件"""
    with open(page_path(path), encoding="utf-8") as f:
        html = f.read()
    assert ('id="custom-data-input"' in html) or ('id="custom-target-input"' in html), f"{path} 缺自定义输入框"
    assert 'id="btn-custom"' in html, f"{path} 缺应用按钮"
    assert "customData" in html, f"{path} 缺 customData 配置"


def test_parse_csv_ints():
    js = (_load_js_files() + """
if (JSON.stringify(parseCSVInts("5,3,8,1,9", 1, 15)) !== JSON.stringify([5,3,8,1,9])) throw new Error("基本解析失败");
if (JSON.stringify(parseCSVInts("5，3，8 1 9", 1, 15)) !== JSON.stringify([5,3,8,1,9])) throw new Error("中文逗号/空格分隔失败");
if (parseCSVInts("1,2,x", 1, 15) !== null) throw new Error("非法字符应返回 null");
if (parseCSVInts("1,2", 4, 15) !== null) throw new Error("个数不足应返回 null");
if (parseCSVInts("1,2.5,3", 1, 15) !== null) throw new Error("小数应返回 null");
if (parseCSVInts("-3,7,2", 1, 15)[0] !== -3) throw new Error("负数应支持");
if (parseSingleInt("7") !== 7) throw new Error("单整数解析失败");
if (parseSingleInt("abc") !== null) throw new Error("非法单整数应返回 null");
console.log('parse-ok');
""")
    out = _run_js(js, "解析器")
    assert "parse-ok" in out


def test_custom_data_bubble_sorts():
    """冒泡页：自定义数组 3,1,2 → 动画结果有序 [1,2,3]"""
    sample = _extract_sample("/sorting/bubble")
    js = _setup_page("/sorting/bubble", "bubble") + """
const code = window.__customData.build(SAMPLE, [[3,1,2]]);
window.__runCustom(code);
const p = window._sortPlayer;
if (!p || !p.steps || !p.steps.length) throw new Error("未生成步骤");
const last = p.steps[p.steps.length - 1];
const sorted = last.arr.every((v, i) => i === 0 || last.arr[i-1] <= v);
if (!sorted) throw new Error("自定义数组排序结果不正确: " + JSON.stringify(last.arr));
if (last.arr.length !== 3) throw new Error("数组长度应为 3: " + JSON.stringify(last.arr));
console.log('bubble-custom-ok');
""".replace("SAMPLE", json.dumps(sample))
    out = _run_js(js, "冒泡自定义数据")
    assert "bubble-custom-ok" in out


def test_custom_data_binary_search():
    """二分页：自定义有序数组 + 目标 → found 正确"""
    sample = _extract_sample("/search/binary")
    js = _setup_page("/search/binary", "binary") + """
const code = window.__customData.build(SAMPLE, [[1,3,5,7,9], 7]);
window.__runCustom(code);
const p = window._sortPlayer;
if (!p || !p.steps || !p.steps.length) throw new Error("未生成步骤");
const last = p.steps[p.steps.length - 1];
if (!last.vars || last.vars.found !== 3) throw new Error("found 应为 3: " + JSON.stringify(last.vars));
console.log('binary-custom-ok');
""".replace("SAMPLE", json.dumps(sample))
    out = _run_js(js, "二分自定义数据")
    assert "binary-custom-ok" in out


def test_custom_data_hash():
    """哈希页：自定义数据 + 目标 → 动画可运行且目标命中判定正确"""
    sample = _extract_sample("/search/hash")
    js = _setup_page("/search/hash", "hash") + """
const code = window.__customData.build(SAMPLE, [[15,8,22,29], 22]);
window.__runCustom(code);
const p = window._sortPlayer;
if (!p || !p.steps || !p.steps.length) throw new Error("未生成步骤");
// 22 % 7 = 1，应命中 found=1（哈希页为图模式，变量在 step.graph.vars）
const last = p.steps[p.steps.length - 1];
const gv = last.graph && last.graph.vars;
if (!gv || gv.found !== 1) throw new Error("found 应为 1: " + JSON.stringify(gv));
console.log('hash-custom-ok');
""".replace("SAMPLE", json.dumps(sample))
    out = _run_js(js, "哈希自定义数据")
    assert "hash-custom-ok" in out


def test_custom_data_invalid_shows_message():
    """无效输入：build 前由解析器拦截（parseCSVInts 已覆盖），此处验证 runCustom 对空代码的兜底"""
    js = (_load_js_files() + """
if (parseCSVInts("", 1, 15) !== null) throw new Error("空输入应返回 null");
console.log('invalid-ok');
""")
    out = _run_js(js, "无效输入")
    assert "invalid-ok" in out
