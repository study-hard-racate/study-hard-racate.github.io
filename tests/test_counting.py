"""计数排序模块测试：从页面提取 C 代码，在 Node 中执行 csim.js，
验证 count 计数、前缀和与最终 out 有序。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

PATH = "/sorting/counting"


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


def test_counting_sort_result_sorted():
    """最终 out = [1,2,2,3,3,4,8] 有序，原数组 a 不变"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.vars || !last.vars.out) throw new Error("最后一步缺 out");
const out = last.vars.out;
const want = [1,2,2,3,3,4,8];
if (JSON.stringify(out) !== JSON.stringify(want)) {
  throw new Error("out 不符: " + JSON.stringify(out) + " 期望 " + JSON.stringify(want));
}
if (JSON.stringify(last.arr) !== JSON.stringify([4,2,2,8,3,3,1])) {
  throw new Error("原数组 a 不应被修改: " + JSON.stringify(last.arr));
}
""", "计数排序结果")
    assert "ok" in out


def test_counting_sort_phases():
    """阶段 1（计数）/2（前缀和）/3（放回）均应出现"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let phases = new Set();
for (const s of res.steps) {
  if (s.vars && s.vars.phase !== undefined) phases.add(s.vars.phase);
}
for (const want of [1,2,3]) {
  if (!phases.has(want)) throw new Error("缺少阶段 " + want + ": " + JSON.stringify([...phases]));
}
""", "计数排序阶段")
    assert "ok" in out


def test_counting_sort_count_correct():
    """放回阶段 count 递减，最终 count 反映剩余未放置的位置数"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.vars || !last.vars.count) throw new Error("最后一步缺 count");
const c = last.vars.count;
// 放回完成后：count = [0,0,1,3,5,6,6,6,6]（8 放到了 out[6] 后 count[8] 减为 6）
const want = [0,0,1,3,5,6,6,6,6];
if (JSON.stringify(c) !== JSON.stringify(want)) {
  throw new Error("count 不符: " + JSON.stringify(c) + " 期望 " + JSON.stringify(want));
}
""", "计数正确性")
    assert "ok" in out


def test_counting_page_structure():
    with open(page_path(PATH), encoding="utf-8") as f:
        html = f.read()
    assert 'id="stage"' in html
    assert "complexity-card" in html
    assert 'renderMode: "countingsort"' in html
