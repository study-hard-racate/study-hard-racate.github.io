"""Prim 模块测试：从页面提取 C 代码，验证 MST 树边与总权重正确。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

PATH = "/graph/prim"


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


def test_prim_mst_edges_and_weight():
    """MST 树边：1-2(1)、0-2(2)、1-3(5)、3-4(2)、4-5(3)，总权重 13"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.vars) throw new Error("最后一步缺 vars");
const parent = last.vars.parent;
const want = [-1,2,0,1,3,4];
if (JSON.stringify(parent) !== JSON.stringify(want)) {
  throw new Error("parent 不符: " + JSON.stringify(parent) + " 期望 " + JSON.stringify(want));
}
const w = last.vars.w;
let total = 0;
for (let i = 0; i < 6; i++) if (parent[i] >= 0) total += w[i*6+parent[i]];
if (total !== 13) throw new Error("MST 总权重应为 13: " + total);
const inMST = last.vars.inMST;
if (!inMST || inMST.some(x => x !== 1)) throw new Error("inMST 应全为 1: " + JSON.stringify(inMST));
""", "Prim MST")
    assert "ok" in out


def test_prim_phases():
    """阶段 1/2/3 齐全，且出现选顶点加入 MST 的步骤"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let phases = new Set(), uSeen = false;
for (const s of res.steps) {
  if (s.vars && s.vars.phase !== undefined) {
    phases.add(s.vars.phase);
    if (s.vars.phase === 2 && s.vars.u !== undefined && s.vars.u >= 0) uSeen = true;
  }
}
for (const want of [1,2,3]) if (!phases.has(want)) throw new Error("缺少阶段 " + want);
if (!uSeen) throw new Error("应出现选顶点加入 MST 的步骤");
""", "Prim 阶段")
    assert "ok" in out


def test_prim_page_structure():
    with open(page_path(PATH), encoding="utf-8") as f:
        html = f.read()
    assert 'id="stage"' in html
    assert "complexity-card" in html
    assert 'renderMode: "prim"' in html
