"""Dijkstra 模块测试：从页面提取 C 代码，在 Node 中执行 csim.js，
验证 dist/fin/parent 数组最终正确、阶段齐全。"""

import codecs
import json
import os
import re
import subprocess
import tempfile

import pytest

from conftest import ROOT, page_path

PATH = "/graph/dijkstra"


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


def test_dijkstra_distances_correct():
    """最终 dist = [0,3,2,8,10,13]，parent 最短路径树正确"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.line + "|" + res.error.msg);
const last = res.steps[res.steps.length - 1];
if (!last.vars || !last.arr) throw new Error("最后一步缺 vars/arr");
const dist = last.arr;
const want = [0,3,2,8,10,13];
if (JSON.stringify(dist) !== JSON.stringify(want)) {
  throw new Error("dist 不符: " + JSON.stringify(dist) + " 期望 " + JSON.stringify(want));
}
const fin = last.vars.fin;
if (!fin || fin.some(x => x !== 1)) throw new Error("fin 应全部为 1: " + JSON.stringify(fin));
const parent = last.vars.parent;
// 期望树：源点 0 无父节点（-1），1←2, 2←0, 3←1, 4←3, 5←4
const pw = [-1,2,0,1,3,4];
if (JSON.stringify(parent) !== JSON.stringify(pw)) {
  throw new Error("parent 不符: " + JSON.stringify(parent) + " 期望 " + JSON.stringify(pw));
}
""", "Dijkstra 结果")
    assert "ok" in out


def test_dijkstra_phases_present():
    """阶段 1/2/3 均应出现，且有选择最小顶点的步骤"""
    out = _case("""
if (!res.ok) throw new Error("模拟失败: " + res.error.msg);
let phases = new Set(), uSeen = false, relaxSeen = false;
for (const s of res.steps) {
  if (s.vars && s.vars.phase !== undefined) {
    phases.add(s.vars.phase);
    if (s.vars.phase === 2 && s.vars.u !== undefined && s.vars.u >= 0) uSeen = true;
    if (s.vars.phase === 2 && s.vars.u !== undefined && s.vars.v !== undefined) relaxSeen = true;
  }
}
if (!phases.has(1) || !phases.has(2) || !phases.has(3)) {
  throw new Error("阶段不完整: " + JSON.stringify([...phases]));
}
if (!uSeen) throw new Error("应出现选择最小顶点的步骤");
if (!relaxSeen) throw new Error("应出现松弛步骤");
""", "Dijkstra 阶段")
    assert "ok" in out


def test_dijkstra_page_structure():
    with open(page_path(PATH), encoding="utf-8") as f:
        html = f.read()
    assert 'id="stage"' in html
    assert "complexity-card" in html
    assert 'renderMode: "dijkstra"' in html
    assert "graph.js" in html
