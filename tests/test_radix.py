"""基数排序模块测试：从页面提取 C 代码，在 Node 中执行 csim.js，
验证三轮按位排序后数组有序、exp 位权正确推进。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

PATH = "/sorting/radix"


def _load_csim():
    with open(os.path.join(ROOT, "static", "js", "csim.js"), encoding="utf-8") as f:
        return f.read()


def _extract_sample(path):
    with open(page_path(path), encoding="utf-8") as f:
        html = f.read()
    m = re.search(r'sample: "(.*?)", renderMode', html, re.S)
    assert m, f"{path} 未找到 sample"
    return codecs.decode(m.group(1), "unicode_escape")


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


def _case(assert_js, name):
    code = _extract_sample(PATH)
    js = ("global.window = global;\n" + _load_csim() + "\n"
          + "const res = CSim.run(" + json.dumps(code) + ", {});\n"
          + assert_js + "\nconsole.log('ok');")
    return _run_js(js, name)


def test_radix_sort_result_sorted():
    """三轮按位排序后数组应完全有序"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
const last = res.steps[res.steps.length - 1];
const want = [2,24,45,66,75,90,170,802];
if (JSON.stringify(last.arr) !== JSON.stringify(want)) {
  throw new Error("排序结果不符: " + JSON.stringify(last.arr) + " 期望 " + JSON.stringify(want));
}
""", "基数排序结果")
    assert "ok" in out


def test_radix_exp_progression():
    """exp 应依次经历 1、10、100（个位→十位→百位）"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
const exps = new Set();
for (const s of res.steps) {
  if (s.vars && s.vars.exp !== undefined) exps.add(s.vars.exp);
}
for (const want of [1, 10, 100]) {
  if (!exps.has(want)) throw new Error("缺少位权 " + want + ": " + JSON.stringify([...exps]));
}
""", "位权推进")
    assert "ok" in out


def test_radix_page_structure():
    with open(page_path(PATH), encoding="utf-8") as f:
        html = f.read()
    assert 'id="stage"' in html
    assert "complexity-card" in html
    assert 'renderMode: "radix"' in html
