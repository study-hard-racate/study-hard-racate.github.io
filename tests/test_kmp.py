"""KMP 模块测试：从页面提取 C 代码，在 Node 中执行 csim.js，
验证 next 数组正确、匹配位置正确、阶段齐全。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

PATH = "/classic/kmp"


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


def test_kmp_next_array_correct():
    """next 数组 = [-1,0,0,1,2,0,1,2,3]（模式串 ABABCABAB）"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.vars || !last.vars.next) throw new Error("缺 next 数组");
const want = [-1,0,0,1,2,0,1,2,3];
if (JSON.stringify(last.vars.next) !== JSON.stringify(want)) {
  throw new Error("next 不符: " + JSON.stringify(last.vars.next) + " 期望 " + JSON.stringify(want));
}
""", "next 数组")
    assert "ok" in out


def test_kmp_match_position():
    """模式串在主串下标 10 处匹配成功，pos = 10"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.vars) throw new Error("缺 vars");
if (last.vars.pos !== 10) throw new Error("pos 应为 10: " + last.vars.pos);
if (last.vars.phase !== 3) throw new Error("phase 应为 3: " + last.vars.phase);
""", "匹配位置")
    assert "ok" in out


def test_kmp_phases_present():
    """阶段 1（求 next）/2（匹配）/3（完成）均应出现"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let phases = new Set();
for (const s of res.steps) {
  if (s.vars && s.vars.phase !== undefined) phases.add(s.vars.phase);
}
for (const want of [1, 2, 3]) {
  if (!phases.has(want)) throw new Error("缺少阶段 " + want + ": " + JSON.stringify([...phases]));
}
""", "阶段齐全")
    assert "ok" in out


def test_kmp_page_structure():
    with open(page_path(PATH), encoding="utf-8") as f:
        html = f.read()
    assert 'id="stage"' in html
    assert "complexity-card" in html
    assert 'renderMode: "kmp"' in html
    assert "string.js" in html
