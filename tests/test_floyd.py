"""Floyd-Warshall 模块测试：从页面提取 C 代码，验证距离矩阵最终正确、阶段齐全。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

PATH = "/graph/floyd"


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


def test_floyd_matrix_correct():
    """最终距离矩阵：d = [0,2,5,3, 2,0,3,1, 5,3,0,4, 3,1,4,0]"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
const last = res.steps[res.steps.length - 1];
const want = [0,2,5,3, 2,0,3,1, 5,3,0,4, 3,1,4,0];
if (JSON.stringify(last.arr) !== JSON.stringify(want)) {
  throw new Error("距离矩阵不符: " + JSON.stringify(last.arr) + " 期望 " + JSON.stringify(want));
}
// 关键值抽查
if (last.arr[0*4+2] !== 5) throw new Error("d[0][2] 应为 5（经 1 中转）");
if (last.arr[0*4+3] !== 3) throw new Error("d[0][3] 应为 3");
if (last.arr[2*4+3] !== 4) throw new Error("d[2][3] 应为 4");
""", "Floyd 矩阵")
    assert "ok" in out


def test_floyd_phases():
    """阶段 1/2/3 应齐全，且 k 依次取 0..3"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let phases = new Set(), ks = new Set();
for (const s of res.steps) {
  if (s.vars && s.vars.phase !== undefined) phases.add(s.vars.phase);
  if (s.vars && s.vars.phase === 2 && s.vars.k !== undefined && s.vars.k >= 0 && s.vars.k < 4) ks.add(s.vars.k);
}
for (const want of [1,2,3]) if (!phases.has(want)) throw new Error("缺少阶段 " + want);
for (const want of [0,1,2,3]) if (!ks.has(want)) throw new Error("缺少中转 k=" + want);
""", "Floyd 阶段")
    assert "ok" in out


def test_floyd_page_structure():
    with open(page_path(PATH), encoding="utf-8") as f:
        html = f.read()
    assert 'id="stage"' in html
    assert "complexity-card" in html
    assert 'renderMode: "floyd"' in html
