"""Kruskal 模块测试：从页面提取 C 代码，验证 MST 边集与总权重正确。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

PATH = "/graph/kruskal"


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


def test_kruskal_mst_edges_and_weight():
    """MST 应选边 (1,2)(0,2)(3,4)(4,5)(1,3)，总权重 13，跳过成环边"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.vars) throw new Error("最后一步缺 vars");
const inTree = last.vars.inTree;
// 期望加入的边下标：1-2(0), 0-2(1), 3-4(2), 4-5(3), 1-3(5)
const want = [1,1,1,1,0,1,0,0,0];
if (JSON.stringify(inTree) !== JSON.stringify(want)) {
  throw new Error("inTree 不符: " + JSON.stringify(inTree) + " 期望 " + JSON.stringify(want));
}
const ew = last.vars.ew;
let total = 0;
for (let i = 0; i < inTree.length; i++) if (inTree[i] === 1) total += ew[i];
if (total !== 13) throw new Error("MST 总权重应为 13: " + total);
if (last.vars.cnt !== 5) throw new Error("应选 5 条边: " + last.vars.cnt);
""", "Kruskal MST")
    assert "ok" in out


def test_kruskal_phases_and_rejections():
    """阶段齐全，且应出现"成环跳过"的边（inTree=0 且已处理）"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let phases = new Set(), rejected = 0;
for (const s of res.steps) {
  if (s.vars && s.vars.phase !== undefined) phases.add(s.vars.phase);
}
for (const want of [1,2,3]) if (!phases.has(want)) throw new Error("缺少阶段 " + want);
const last = res.steps[res.steps.length - 1];
if (!last.vars) throw new Error("缺 vars");
for (let i = 0; i < last.vars.inTree.length; i++) if (last.vars.inTree[i] !== 1) rejected++;
if (rejected < 4) throw new Error("应至少 4 条边被跳过（成环）: " + rejected);
""", "Kruskal 阶段")
    assert "ok" in out


def test_kruskal_page_structure():
    with open(page_path(PATH), encoding="utf-8") as f:
        html = f.read()
    assert 'id="stage"' in html
    assert "complexity-card" in html
    assert 'renderMode: "kruskal"' in html
